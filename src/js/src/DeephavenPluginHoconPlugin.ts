import { type ElementPlugin, PluginType } from "@deephaven/plugin";
import DeephavenPluginHoconView from "./DeephavenPluginHoconView";

type ElementPluginWithEvents = ElementPlugin & {
  eventMapping: Record<string, (params: Record<string, unknown>) => void>;
};

// Register the plugin with Deephaven
export const DeephavenPluginHoconPlugin: ElementPluginWithEvents = {
  name: "deephaven-plugin-hocon",
  type: PluginType.ELEMENT_PLUGIN,
  // Keys must match the element names used by the Python components.
  mapping: {
    "deephaven_plugin_hocon.hocon_editor": DeephavenPluginHoconView,
  },
  eventMapping: {},
};

export default DeephavenPluginHoconPlugin;
