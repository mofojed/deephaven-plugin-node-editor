import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type NodeChange,
} from "@xyflow/react";
import flowStyles from "@xyflow/react/dist/style.css?inline";
import { NodeEditorContext, type NodeEditorActions } from "./NodeEditorContext";
import { editorNodeTypes } from "./EditorNodes";
import {
  addChildAtPath,
  changeKindAtPath,
  coerceValue,
  deleteAtPath,
  getAtPath,
  idToPath,
  isPathWithin,
  pathToId,
  renameKeyAtPath,
  setAtPath,
  type JsonValue,
  type NodeKind,
  type Path,
  type ValueType,
} from "./editorTree";
import { jsonToGraph, type EditorNode } from "./jsonToGraph";

type Position = { x: number; y: number };
type PositionOverrides = Record<string, Position>;

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
  minHeight: 0,
  background: "var(--dh-color-bg)",
  color: "var(--dh-color-fg)",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 8px",
  borderBottom: "1px solid var(--dh-color-border)",
  fontSize: 12,
};

const toolbarButtonStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 4,
  border: "1px solid var(--dh-color-border)",
  background: "transparent",
  color: "var(--dh-color-fg)",
  cursor: "pointer",
  fontSize: 12,
};

// React Flow's stylesheet assumes a light background, so follow the Deephaven theme.
const themeOverrides = `
.react-flow__controls-button {
  background: var(--dh-color-bg);
  border-bottom: 1px solid var(--dh-color-border);
  fill: var(--dh-color-fg);
}
.react-flow__controls-button:hover {
  background: var(--dh-color-input-bg);
}
.react-flow__minimap {
  background: var(--dh-color-bg);
  border: 1px solid var(--dh-color-border);
}
.react-flow__minimap-mask {
  fill: var(--dh-color-bg);
  fill-opacity: 0.6;
}
.react-flow__minimap-node {
  fill: var(--dh-color-border);
}
`;

/** Move position overrides for a subtree when its path changes. */
function remapOverrides(
  overrides: PositionOverrides,
  from: Path,
  to: Path,
): PositionOverrides {
  const next: PositionOverrides = {};
  Object.entries(overrides).forEach(([id, position]) => {
    const path = idToPath(id);
    if (isPathWithin(path, from)) {
      next[pathToId([...to, ...path.slice(from.length)])] = position;
    } else {
      next[id] = position;
    }
  });
  return next;
}

/** Forget position overrides for a subtree that no longer exists. */
function dropOverrides(
  overrides: PositionOverrides,
  path: Path,
): PositionOverrides {
  const next: PositionOverrides = {};
  Object.entries(overrides).forEach(([id, position]) => {
    if (!isPathWithin(idToPath(id), path)) {
      next[id] = position;
    }
  });
  return next;
}

function NodeEditorFlow({
  value,
  defaultValue,
  onChange,
}: {
  value?: JsonValue;
  defaultValue?: JsonValue;
  onChange?: (value: JsonValue) => void | Promise<void>;
}): JSX.Element {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<JsonValue>(
    () => defaultValue ?? {},
  );
  const config = isControlled ? (value as JsonValue) : uncontrolledValue;

  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>(
    {},
  );

  // Keeps edits based on the latest tree when several land before a controlled update.
  const configRef = useRef(config);
  configRef.current = config;

  const commit = useCallback(
    (next: JsonValue) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      configRef.current = next;
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const actions = useMemo<NodeEditorActions>(
    () => ({
      setValue: (path: Path, newValue: JsonValue) => {
        commit(setAtPath(configRef.current, path, newValue));
      },
      setValueType: (path: Path, type: ValueType) => {
        const current = getAtPath(configRef.current, path) ?? null;
        commit(setAtPath(configRef.current, path, coerceValue(current, type)));
      },
      renameKey: (path: Path, newKey: string) => {
        const next = renameKeyAtPath(configRef.current, path, newKey);
        if (next === configRef.current) {
          return;
        }
        setPositionOverrides((overrides) =>
          remapOverrides(overrides, path, [...path.slice(0, -1), newKey]),
        );
        commit(next);
      },
      changeKind: (path: Path, kind: NodeKind) => {
        const next = changeKindAtPath(configRef.current, path, kind);
        if (next === configRef.current) {
          return;
        }
        setPositionOverrides((overrides) => dropOverrides(overrides, path));
        commit(next);
      },
      addChild: (path: Path) => {
        const result = addChildAtPath(configRef.current, path, "");
        if (result != null) {
          commit(result.root);
        }
      },
      deleteNode: (path: Path) => {
        setPositionOverrides((overrides) => dropOverrides(overrides, path));
        commit(deleteAtPath(configRef.current, path));
      },
    }),
    [commit],
  );

  const graph = useMemo(
    () => jsonToGraph(config, positionOverrides),
    [config, positionOverrides],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(
    graph.nodes,
  );
  const [edges, setEdges] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<EditorNode>[]) => {
      onNodesChange(changes);
      const moved = changes.filter(
        (change) => change.type === "position" && change.dragging === false,
      );
      if (moved.length > 0) {
        setPositionOverrides((overrides) => {
          const next = { ...overrides };
          moved.forEach((change) => {
            if (change.type === "position" && change.position != null) {
              next[change.id] = change.position;
            }
          });
          return next;
        });
      }
    },
    [onNodesChange],
  );

  return (
    <div style={containerStyle}>
      <style>
        {flowStyles}
        {themeOverrides}
      </style>
      <div style={toolbarStyle}>
        <span style={{ color: "var(--dh-color-fg-hint)" }}>
          {isControlled ? "Controlled" : "Uncontrolled"} node editor
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={toolbarButtonStyle}
          onClick={() => setPositionOverrides({})}
        >
          Reset layout
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NodeEditorContext.Provider value={actions}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={editorNodeTypes}
            onNodesChange={handleNodesChange}
            nodesConnectable={false}
            fitView
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </NodeEditorContext.Provider>
      </div>
    </div>
  );
}

/**
 * Graphical node editor for a configuration tree.
 *
 * Controlled when `value` is provided, uncontrolled when only `defaultValue` is.
 *
 * @param value The configuration to display, owned by the server.
 * @param defaultValue The initial configuration for an uncontrolled editor.
 * @param onChange Called with the updated configuration after every edit.
 */
export default function DeephavenPluginNodeEditorView(props: {
  value?: JsonValue;
  defaultValue?: JsonValue;
  onChange?: (value: JsonValue) => void | Promise<void>;
}): JSX.Element {
  return (
    <ReactFlowProvider>
      <NodeEditorFlow {...props} />
    </ReactFlowProvider>
  );
}
