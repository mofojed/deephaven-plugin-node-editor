"""
Fixtures for the node editor e2e tests.

Each fixture pairs an editor with a read-only text area holding the current
configuration as JSON. The specs assert on that text area, so they check the
value that actually reached the server rather than what the canvas happens to
draw.
"""

import json

from deephaven import ui

from deephaven_plugin_node_editor import node_editor

CONFIG = {
    "name": "prod",
    "port": 8080,
    "db": {"host": "localhost", "ssl": True},
    "tags": ["alpha", "beta"],
}


def _config_view(editor, config: dict):
    """Stack an editor above the JSON the server currently holds."""
    return ui.flex(
        ui.view(editor, flex=1, min_height=0),
        ui.text_area(
            label="config json",
            value=json.dumps(config),
            is_read_only=True,
            width="100%",
        ),
        direction="column",
        height="100%",
        gap="size-100",
    )


@ui.component
def node_editor_controlled_fixture():
    config, set_config = ui.use_state(CONFIG)
    return _config_view(node_editor(value=config, on_change=set_config), config)


@ui.component
def node_editor_uncontrolled_fixture():
    # The client owns the value, so the text area only reflects `on_change`.
    config, set_config = ui.use_state(CONFIG)
    return _config_view(node_editor(default_value=CONFIG, on_change=set_config), config)


@ui.component
def hocon_string_fixture():
    # `mirror.port` resolves to 9000 through the substitution.
    config, set_config = ui.use_state({})
    return _config_view(
        node_editor(
            default_value="app { port = 9000 }, mirror { port = ${app.port} }",
            on_change=set_config,
        ),
        config,
    )


node_editor_controlled = ui.panel(node_editor_controlled_fixture(), title="Controlled")
node_editor_uncontrolled = ui.panel(
    node_editor_uncontrolled_fixture(), title="Uncontrolled"
)
hocon_string = ui.panel(hocon_string_fixture(), title="HOCON string")
