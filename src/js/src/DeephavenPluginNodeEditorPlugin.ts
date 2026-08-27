import { type ElementPlugin, PluginType } from "@deephaven/plugin";
import DeephavenPluginNodeEditorView from "./DeephavenPluginNodeEditorView";

type ElementPluginWithEvents = ElementPlugin & {
  eventMapping: Record<string, (params: Record<string, unknown>) => void>;
};

// Register the plugin with Deephaven
export const DeephavenPluginNodeEditorPlugin: ElementPluginWithEvents = {
  name: "deephaven-plugin-node-editor",
  type: PluginType.ELEMENT_PLUGIN,
  // Keys must match the element names used by the Python components.
  mapping: {
    "deephaven_plugin_node_editor.node_editor": DeephavenPluginNodeEditorView,
  },
  eventMapping: {},
};

export default DeephavenPluginNodeEditorPlugin;
