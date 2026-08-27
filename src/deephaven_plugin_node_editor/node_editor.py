from __future__ import annotations

import json
from typing import Any, Callable

from deephaven import ui
from pyhocon import ConfigFactory
from pyhocon.config_tree import ConfigTree
from pyhocon.converter import HOCONConverter

# Sentinel so we can tell "not provided" apart from an explicitly passed `None`.
_UNSET: Any = object()

ConfigValue = Any


def _normalize(value: ConfigValue) -> Any:
    """Convert nested config data to plain JSON-serializable Python data."""
    if isinstance(value, ConfigTree):
        return json.loads(HOCONConverter.to_json(value))
    if isinstance(value, dict):
        return {str(key): _normalize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    return value


def _to_plain(value: ConfigValue) -> Any:
    """
    Normalize a configuration into plain JSON-serializable Python data.

    Only a top-level string is treated as a HOCON document, which resolves
    substitutions and includes. Strings nested inside a dict or list are ordinary
    values and are left as-is.

    Args:
        value: A dict, ConfigTree, HOCON string, or any JSON-serializable value.

    Returns:
        The equivalent plain Python data.

    Raises:
        pyhocon.exceptions.ConfigException: If a HOCON string cannot be parsed.
    """
    if isinstance(value, str):
        value = ConfigFactory.parse_string(value)
    return _normalize(value)


@ui.component
def node_editor(
    value: ConfigValue = _UNSET,
    default_value: ConfigValue = _UNSET,
    on_change: Callable[[dict], None] = print,
) -> ui.BaseElement:
    """
    A graphical node editor for configuration data.

    The configuration is displayed as a graph of nodes that can be rearranged and edited.
    Every edit produces the updated configuration as a plain JSON-serializable dict.

    Use `value` for a controlled editor, where the server owns the state and must
    update `value` in response to `on_change`. Use `default_value` for an uncontrolled
    editor, where the client owns the state after the initial render.

    HOCON strings are parsed on the server, which resolves substitutions and includes,
    so the editor always operates on the fully resolved configuration.

    Args:
        value: The configuration to display, as a dict, ConfigTree, or HOCON string.
            Providing this makes the editor controlled.
        default_value: The initial configuration for an uncontrolled editor. Defaults
            to an empty configuration when neither `value` nor `default_value` is given.
        on_change: Called with the updated configuration dict whenever the user edits the graph.

    Returns:
        The editor element.

    Raises:
        ValueError: If both `value` and `default_value` are provided.
        pyhocon.exceptions.ConfigException: If a HOCON string cannot be parsed.
    """
    if value is not _UNSET and default_value is not _UNSET:
        raise ValueError(
            "node_editor cannot be both controlled and uncontrolled. "
            "Provide either `value` or `default_value`, not both."
        )

    props: dict[str, Any] = {"on_change": on_change}
    if value is not _UNSET:
        props["value"] = _to_plain(value)
    else:
        props["default_value"] = _to_plain(
            {} if default_value is _UNSET else default_value
        )

    # The name must match the key in the mapping in DeephavenPluginNodeEditorPlugin.ts
    return ui.BaseElement("deephaven_plugin_node_editor.node_editor", **props)
