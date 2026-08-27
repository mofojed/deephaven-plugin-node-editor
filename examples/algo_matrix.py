"""
Edit an algo matrix as a HOCON graph and drive live tables from it.

The matrix is a set of phases, each holding nodes (states with an action) and
transitions between them that fire once an incoming signal crosses a threshold.
Editing the graph rebuilds the derived tables, which re-filters the live feed.

Run this in a Deephaven console, then open the `algo_matrix` dashboard.

Try it:
  - Change a transition's `signal` threshold and watch `fired` rows appear or drop out.
  - Rename `Node3` in both the node list and a transition to rewire the matrix.
  - Add a node with the `+` button on a `nodes` array, then give it a `label` and `action`.
  - Add a whole phase by pressing `+` on the `phases` array and converting the entry to an object.
"""

import json
from typing import Any

from deephaven import agg, new_table, time_table, ui
from deephaven.column import double_col, string_col
from deephaven.table import Table
from pyhocon import ConfigFactory
from pyhocon.converter import HOCONConverter

from deephaven_plugin_node_editor import node_editor

DEFAULT_MATRIX = """
matrix {
  name = SampleMatrix
  phases = [
    {
      name = Phase1
      nodes = [
        { label = Node2, action = "warmUp()" }
        { label = Node3, action = "doSomething()" }
        { label = Node5, action = "unwind()" }
      ]
      transitions = [
        { from = Node2, to = Node3, signal = 10 }
        { from = Node3, to = Node5, signal = 5 }
      ]
    }
    {
      name = Phase2
      nodes = [
        { label = Node7, action = "hedge()" }
        { label = Node9, action = "flatten()" }
      ]
      transitions = [
        { from = Node7, to = Node9, signal = 15 }
      ]
    }
  ]
}
"""

# A synthetic feed standing in for whatever drives the matrix in production.
# The node cycle and the signal cycle are coprime, so every pairing shows up.
signals = time_table("PT1s").update(
    [
        "Source = (String) `Node2,Node3,Node7`.split(`,`)[(int) (ii % 3)]",
        "Signal = (double) (ii % 23)",
    ]
)


def parse_hocon(document: str) -> dict:
    """Parse a HOCON document into the plain dict the editor works with."""
    return json.loads(HOCONConverter.to_json(ConfigFactory.parse_string(document)))


def _entries(value: Any) -> list[dict]:
    """The dict entries of `value` when it is a list, ignoring anything else."""
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _number(value: Any) -> float:
    # bool is an int subclass, so exclude it explicitly.
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return 0.0


def node_table(config: dict) -> Table:
    """One row per node in the matrix, in phase order."""
    phases: list[str] = []
    labels: list[str] = []
    actions: list[str] = []

    for phase in _entries((config.get("matrix") or {}).get("phases")):
        name = _text(phase.get("name"))
        for node in _entries(phase.get("nodes")):
            phases.append(name)
            labels.append(_text(node.get("label")))
            actions.append(_text(node.get("action")))

    return new_table(
        [
            string_col("Phase", phases),
            string_col("Label", labels),
            string_col("Action", actions),
        ]
    )


def transition_table(config: dict) -> Table:
    """One row per transition, with the threshold that makes it fire."""
    phases: list[str] = []
    sources: list[str] = []
    targets: list[str] = []
    thresholds: list[float] = []

    for phase in _entries((config.get("matrix") or {}).get("phases")):
        name = _text(phase.get("name"))
        for transition in _entries(phase.get("transitions")):
            phases.append(name)
            sources.append(_text(transition.get("from")))
            targets.append(_text(transition.get("to")))
            thresholds.append(_number(transition.get("signal")))

    return new_table(
        [
            string_col("Phase", phases),
            string_col("Source", sources),
            string_col("Target", targets),
            double_col("Threshold", thresholds),
        ]
    )


def fired_table(feed: Table, transitions: Table) -> Table:
    """
    Every transition the live feed has triggered.

    Config values never reach a query string. The cross join pairs each tick with
    each transition and the filter compares columns only, so a renamed node or a
    retyped threshold can only change the data, not the query.
    """
    return (
        feed.join(transitions, on=["Source"])
        .where("Signal >= Threshold")
        .view(["Timestamp", "Phase", "Source", "Target", "Signal", "Threshold"])
        .reverse()
    )


@ui.component
def algo_matrix_layout():
    config, set_config = ui.use_state(lambda: parse_hocon(DEFAULT_MATRIX))

    nodes = ui.use_memo(lambda: node_table(config), [config])
    transitions = ui.use_memo(lambda: transition_table(config), [config])
    fired = ui.use_memo(lambda: fired_table(signals, transitions), [transitions])
    activity = ui.use_memo(
        lambda: fired.agg_by([agg.count_("Fires")], by=["Phase", "Source", "Target"]),
        [fired],
    )

    return ui.row(
        ui.panel(
            node_editor(value=config, on_change=set_config),
            title="Algo matrix (HOCON)",
        ),
        ui.column(
            ui.row(
                ui.panel(ui.table(nodes), title="Nodes"),
                ui.panel(ui.table(transitions), title="Transitions"),
            ),
            ui.row(
                ui.panel(ui.table(fired), title="Fired transitions"),
                ui.panel(ui.table(activity), title="Activity"),
            ),
        ),
    )


algo_matrix = ui.dashboard(algo_matrix_layout())
