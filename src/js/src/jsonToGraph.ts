import type { Edge, Node } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import {
  getKind,
  isPlainObject,
  pathToId,
  ROOT_PATH,
  type JsonValue,
  type NodeKind,
  type Path,
} from "./editorTree";

export const NODE_WIDTH = 240;
const OBJECT_NODE_HEIGHT = 76;
const VALUE_NODE_HEIGHT = 116;

export type EditorNodeData = {
  path: Path;
  label: string;
  kind: NodeKind;
  value: JsonValue;
  isRoot: boolean;
  /** Keys of array entries are positional and cannot be renamed. */
  inArray: boolean;
  childCount: number;
};

export type EditorNode = Node<EditorNodeData>;

export type Graph = {
  nodes: EditorNode[];
  edges: Edge[];
};

function nodeHeight(kind: NodeKind): number {
  return kind === "value" ? VALUE_NODE_HEIGHT : OBJECT_NODE_HEIGHT;
}

function nodeTypeFor(kind: NodeKind): string {
  return kind === "value" ? "valueNode" : "branchNode";
}

function walk(
  value: JsonValue,
  path: Path,
  label: string,
  inArray: boolean,
  nodes: EditorNode[],
  edges: Edge[],
): void {
  const kind = getKind(value);
  const id = pathToId(path);
  const children: { value: JsonValue; path: Path; label: string }[] = [];

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      children.push({
        value: child,
        path: [...path, index],
        label: `${index}`,
      });
    });
  } else if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, child]) => {
      children.push({ value: child, path: [...path, key], label: key });
    });
  }

  nodes.push({
    id,
    type: nodeTypeFor(kind),
    position: { x: 0, y: 0 },
    data: {
      path,
      label,
      kind,
      value,
      isRoot: path.length === 0,
      inArray,
      childCount: children.length,
    },
  });

  children.forEach((child) => {
    const childId = pathToId(child.path);
    edges.push({
      id: `${id}->${childId}`,
      source: id,
      target: childId,
      type: "smoothstep",
    });
    walk(child.value, child.path, child.label, kind === "array", nodes, edges);
  });
}

function layout(graph: Graph): Graph {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 16,
    ranksep: 90,
    marginx: 24,
    marginy: 24,
  });

  graph.nodes.forEach((node) => {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: nodeHeight(node.data.kind),
    });
  });
  graph.edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    edges: graph.edges,
    nodes: graph.nodes.map((node) => {
      const { x, y } = g.node(node.id);
      // dagre positions nodes by their center, React Flow by their top-left corner.
      return {
        ...node,
        position: {
          x: x - NODE_WIDTH / 2,
          y: y - nodeHeight(node.data.kind) / 2,
        },
      };
    }),
  };
}

/**
 * Build the graph for a configuration tree.
 *
 * `positionOverrides` keeps nodes the user has dragged where they left them.
 */
export function jsonToGraph(
  root: JsonValue,
  positionOverrides: Record<string, { x: number; y: number }> = {},
): Graph {
  const nodes: EditorNode[] = [];
  const edges: Edge[] = [];
  walk(root, ROOT_PATH, "root", false, nodes, edges);

  const laidOut = layout({ nodes, edges });
  return {
    edges: laidOut.edges,
    nodes: laidOut.nodes.map((node) =>
      positionOverrides[node.id] != null
        ? { ...node, position: positionOverrides[node.id] }
        : node,
    ),
  };
}
