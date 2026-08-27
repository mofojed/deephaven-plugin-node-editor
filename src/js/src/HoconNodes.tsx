import React, { CSSProperties, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useHoconEditor } from "./HoconEditorContext";
import { getValueType, type JsonValue, type ValueType } from "./hoconTree";
import { NODE_WIDTH, type HoconNode } from "./jsonToGraph";

const KIND_COLOR: Record<string, string> = {
  object: "var(--dh-color-visual-blue)",
  array: "var(--dh-color-visual-purple)",
  value: "var(--dh-color-visual-green)",
};

const nodeStyle = (kind: string): CSSProperties => ({
  width: NODE_WIDTH,
  boxSizing: "border-box",
  padding: 8,
  borderRadius: 6,
  border: "1px solid var(--dh-color-border)",
  borderLeft: `4px solid ${KIND_COLOR[kind] ?? "var(--dh-color-border)"}`,
  background: "var(--dh-color-bg)",
  color: "var(--dh-color-fg)",
  fontSize: 12,
});

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid var(--dh-color-input-border)",
  background: "var(--dh-color-input-bg)",
  color: "var(--dh-color-input-fg)",
  fontSize: 12,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  flex: "none",
  width: 78,
};

const iconButtonStyle: CSSProperties = {
  flex: "none",
  width: 22,
  height: 22,
  lineHeight: "20px",
  padding: 0,
  borderRadius: 4,
  border: "1px solid var(--dh-color-border)",
  background: "transparent",
  color: "var(--dh-color-fg)",
  cursor: "pointer",
};

const badgeStyle: CSSProperties = {
  flex: "none",
  padding: "0 6px",
  borderRadius: 8,
  background: "var(--dh-color-subdued-content-bg)",
  color: "var(--dh-color-fg-hint)",
  fontSize: 10,
  textTransform: "uppercase",
};

/** Text input that edits a draft and only commits on blur or Enter. */
function DraftInput({
  value,
  onCommit,
  ariaLabel,
  style,
  type = "text",
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  style?: CSSProperties;
  type?: string;
}): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      className="nodrag"
      type={type}
      aria-label={ariaLabel}
      style={{ ...inputStyle, ...style }}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onCommit(draft);
        } else if (event.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}

function KeyField({
  label,
  isRoot,
  inArray,
  onRename,
}: {
  label: string;
  isRoot: boolean;
  inArray: boolean;
  onRename: (next: string) => void;
}): JSX.Element {
  if (isRoot) {
    return <strong style={{ flex: 1 }}>root</strong>;
  }
  if (inArray) {
    return <strong style={{ flex: 1 }}>[{label}]</strong>;
  }
  return <DraftInput value={label} onCommit={onRename} ariaLabel="Key" />;
}

export function HoconBranchNode({ data }: NodeProps<HoconNode>): JSX.Element {
  const { renameKey, addChild, deleteNode, changeKind } = useHoconEditor();
  const { path, label, kind, isRoot, inArray, childCount } = data;

  return (
    <div style={nodeStyle(kind)}>
      {!isRoot && <Handle type="target" position={Position.Left} />}
      <div style={rowStyle}>
        <KeyField
          label={label}
          isRoot={isRoot}
          inArray={inArray}
          onRename={(next) => renameKey(path, next)}
        />
        <span style={badgeStyle}>{kind}</span>
      </div>
      <div style={{ ...rowStyle, marginTop: 6 }}>
        <span style={{ flex: 1, color: "var(--dh-color-fg-hint)" }}>
          {childCount} {childCount === 1 ? "entry" : "entries"}
        </span>
        <button
          type="button"
          className="nodrag"
          style={iconButtonStyle}
          title="Add child"
          aria-label="Add child"
          onClick={() => addChild(path)}
        >
          +
        </button>
        <button
          type="button"
          className="nodrag"
          style={iconButtonStyle}
          title={kind === "object" ? "Convert to array" : "Convert to object"}
          aria-label="Change type"
          onClick={() =>
            changeKind(path, kind === "object" ? "array" : "object")
          }
        >
          {kind === "object" ? "[ ]" : "{ }"}
        </button>
        {!isRoot && (
          <button
            type="button"
            className="nodrag"
            style={iconButtonStyle}
            title="Delete"
            aria-label="Delete"
            onClick={() => deleteNode(path)}
          >
            ×
          </button>
        )}
      </div>
      {childCount > 0 && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

function ValueField({
  value,
  type,
  onChange,
}: {
  value: JsonValue;
  type: ValueType;
  onChange: (next: JsonValue) => void;
}): JSX.Element {
  if (type === "null") {
    return (
      <span style={{ flex: 1, color: "var(--dh-color-fg-hint)" }}>null</span>
    );
  }
  if (type === "boolean") {
    return (
      <select
        className="nodrag"
        aria-label="Value"
        style={inputStyle}
        value={value === true ? "true" : "false"}
        onChange={(event) => onChange(event.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (type === "number") {
    return (
      <DraftInput
        type="number"
        value={String(value ?? 0)}
        ariaLabel="Value"
        onCommit={(next) => {
          const parsed = Number(next);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
    );
  }
  return (
    <DraftInput
      value={String(value ?? "")}
      ariaLabel="Value"
      onCommit={(next) => onChange(next)}
    />
  );
}

export function HoconValueNode({ data }: NodeProps<HoconNode>): JSX.Element {
  const { setValue, setValueType, renameKey, changeKind, deleteNode } =
    useHoconEditor();
  const { path, label, value, isRoot, inArray } = data;
  const type = getValueType(value);

  return (
    <div style={nodeStyle("value")}>
      {!isRoot && <Handle type="target" position={Position.Left} />}
      <div style={rowStyle}>
        <KeyField
          label={label}
          isRoot={isRoot}
          inArray={inArray}
          onRename={(next) => renameKey(path, next)}
        />
        {!isRoot && (
          <button
            type="button"
            className="nodrag"
            style={iconButtonStyle}
            title="Delete"
            aria-label="Delete"
            onClick={() => deleteNode(path)}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ ...rowStyle, marginTop: 6 }}>
        <ValueField
          value={value}
          type={type}
          onChange={(next) => setValue(path, next)}
        />
      </div>
      <div style={{ ...rowStyle, marginTop: 6 }}>
        <select
          className="nodrag"
          aria-label="Value type"
          style={selectStyle}
          value={type}
          onChange={(event) =>
            setValueType(path, event.target.value as ValueType)
          }
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="null">null</option>
        </select>
        <button
          type="button"
          className="nodrag"
          style={iconButtonStyle}
          title="Convert to object"
          aria-label="Convert to object"
          onClick={() => changeKind(path, "object")}
        >
          {"{ }"}
        </button>
        <button
          type="button"
          className="nodrag"
          style={iconButtonStyle}
          title="Convert to array"
          aria-label="Convert to array"
          onClick={() => changeKind(path, "array")}
        >
          [ ]
        </button>
      </div>
    </div>
  );
}

export const hoconNodeTypes = {
  hoconBranch: HoconBranchNode,
  hoconValue: HoconValueNode,
};
