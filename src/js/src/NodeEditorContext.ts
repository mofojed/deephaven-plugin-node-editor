import { createContext, useContext } from "react";
import type { JsonValue, NodeKind, Path, ValueType } from "./editorTree";

export type NodeEditorActions = {
  setValue: (path: Path, value: JsonValue) => void;
  setValueType: (path: Path, type: ValueType) => void;
  renameKey: (path: Path, newKey: string) => void;
  changeKind: (path: Path, kind: NodeKind) => void;
  addChild: (path: Path) => void;
  deleteNode: (path: Path) => void;
};

const noop = (): void => undefined;

export const NodeEditorContext = createContext<NodeEditorActions>({
  setValue: noop,
  setValueType: noop,
  renameKey: noop,
  changeKind: noop,
  addChild: noop,
  deleteNode: noop,
});

export function useNodeEditor(): NodeEditorActions {
  return useContext(NodeEditorContext);
}
