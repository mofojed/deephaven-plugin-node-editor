"""
Filter a live Deephaven table from a HOCON config edited as a graph.

Run this in a Deephaven console, then open the `trade_monitor` dashboard. Editing the
config graph on the left re-filters the ticking trades table on the right immediately.

Try it:
  - Change `filter.min_price` to 120 and watch rows drop out.
  - Rename or delete `filter.sides`, or add `SELL` to it with the `+` button.
  - Add a symbol to `filter.symbols` to widen the view.
"""

import json

from deephaven import new_table, time_table, ui
from deephaven.column import string_col
from deephaven.table import Table
from pyhocon import ConfigFactory
from pyhocon.converter import HOCONConverter

from deephaven_plugin_node_editor import node_editor

DEFAULT_CONFIG = """
filter {
  min_price = 80
  symbols = [AAPL, MSFT]
  sides = [BUY]
}
display {
  limit = 25
}
"""

trades = time_table("PT0.5s").update(
    [
        "Symbol = (String) `AAPL,MSFT,GOOG,AMZN`.split(`,`)[(int) (ii % 4)]",
        "Side = ii % 3 == 0 ? `SELL` : `BUY`",
        "Price = 50.0 + (ii * 37) % 150",
        "Size = (int) (10 + (ii * 13) % 90)",
    ]
)


def parse_hocon(document: str) -> dict:
    """Parse a HOCON document into the plain dict the editor works with."""
    return json.loads(HOCONConverter.to_json(ConfigFactory.parse_string(document)))


def _strings(value: object) -> list[str]:
    return (
        [item for item in value if isinstance(item, str)]
        if isinstance(value, list)
        else []
    )


def _number(value: object) -> float | None:
    # bool is an int subclass, so exclude it explicitly.
    return (
        float(value)
        if isinstance(value, (int, float)) and not isinstance(value, bool)
        else None
    )


def apply_config(table: Table, config: dict) -> Table:
    """
    Filter `table` according to `config`.

    Config values come from user input, so they are never interpolated into query
    strings. Text filters go through `where_in` against a table of literals, and
    numbers are coerced before formatting. An empty or missing entry means "no filter".
    """
    filters = config.get("filter") or {}
    result = table

    min_price = _number(filters.get("min_price"))
    if min_price is not None:
        result = result.where(f"Price >= {min_price}")

    for key, column in (("symbols", "Symbol"), ("sides", "Side")):
        values = _strings(filters.get(key))
        if values:
            result = result.where_in(new_table([string_col(column, values)]), column)

    limit = _number((config.get("display") or {}).get("limit"))
    if limit is not None and limit >= 0:
        result = result.tail(int(limit))

    return result


@ui.component
def trade_monitor_layout():
    config, set_config = ui.use_state(lambda: parse_hocon(DEFAULT_CONFIG))
    filtered = ui.use_memo(lambda: apply_config(trades, config), [config])

    return ui.row(
        ui.panel(
            node_editor(value=config, on_change=set_config),
            title="Filter config",
        ),
        ui.panel(ui.table(filtered), title="Trades"),
    )


trade_monitor = ui.dashboard(trade_monitor_layout())
