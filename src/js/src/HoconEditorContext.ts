import { createContext, useContext } from "react";
import type { JsonValue, NodeKind, Path, ValueType } from "./hoconTree";

export type HoconEditorActions = {
  setValue: (path: Path, value: JsonValue) => void;
  setValueType: (path: Path, type: ValueType) => void;
  renameKey: (path: Path, newKey: string) => void;
  changeKind: (path: Path, kind: NodeKind) => void;
  addChild: (path: Path) => void;
  deleteNode: (path: Path) => void;
};

const noop = (): void => undefined;

export const HoconEditorContext = createContext<HoconEditorActions>({
  setValue: noop,
  setValueType: noop,
  renameKey: noop,
  changeKind: noop,
  addChild: noop,
  deleteNode: noop,
});

export function useHoconEditor(): HoconEditorActions {
  return useContext(HoconEditorContext);
}
