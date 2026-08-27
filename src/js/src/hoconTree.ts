/**
 * Immutable tree model backing the HOCON editor.
 *
 * The parsed configuration is the source of truth; the graph is derived from it.
 * Nodes are addressed by their path from the root, e.g. `['servers', 0, 'port']`.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type PathSegment = string | number;
export type Path = readonly PathSegment[];

export type NodeKind = "object" | "array" | "value";

export const ROOT_PATH: Path = [];

export function pathToId(path: Path): string {
  return JSON.stringify(path);
}

export function idToPath(id: string): Path {
  return JSON.parse(id) as Path;
}

export function isPlainObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getKind(value: JsonValue): NodeKind {
  if (Array.isArray(value)) {
    return "array";
  }
  if (isPlainObject(value)) {
    return "object";
  }
  return "value";
}

/** True when `path` is `prefix` or sits underneath it. */
export function isPathWithin(path: Path, prefix: Path): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, index) => path[index] === segment)
  );
}

export function getAtPath(root: JsonValue, path: Path): JsonValue | undefined {
  let current: JsonValue | undefined = root;
  for (const segment of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    if (Array.isArray(current)) {
      if (typeof segment !== "number") {
        return undefined;
      }
      current = current[segment];
    } else {
      current = (current as JsonObject)[String(segment)];
    }
  }
  return current;
}

export function setAtPath(
  root: JsonValue,
  path: Path,
  value: JsonValue,
): JsonValue {
  if (path.length === 0) {
    return value;
  }
  const [head, ...rest] = path;
  if (Array.isArray(root) && typeof head === "number") {
    const next = [...root];
    next[head] = setAtPath(root[head] ?? null, rest, value);
    return next;
  }
  const parent = isPlainObject(root) ? root : {};
  const key = String(head);
  return { ...parent, [key]: setAtPath(parent[key] ?? null, rest, value) };
}

export function deleteAtPath(root: JsonValue, path: Path): JsonValue {
  if (path.length === 0) {
    return root;
  }
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getAtPath(root, parentPath);
  if (Array.isArray(parent) && typeof key === "number") {
    return setAtPath(
      root,
      parentPath,
      parent.filter((_, index) => index !== key),
    );
  }
  if (parent != null && isPlainObject(parent)) {
    const next = { ...parent };
    delete next[String(key)];
    return setAtPath(root, parentPath, next);
  }
  return root;
}

/**
 * Rename a key while preserving key order.
 *
 * Returns the tree unchanged when the new key is empty or already taken, so an
 * existing entry is never silently overwritten.
 */
export function renameKeyAtPath(
  root: JsonValue,
  path: Path,
  newKey: string,
): JsonValue {
  if (path.length === 0) {
    return root;
  }
  const parentPath = path.slice(0, -1);
  const oldKey = String(path[path.length - 1]);
  const parent = getAtPath(root, parentPath);
  if (parent == null || !isPlainObject(parent)) {
    return root;
  }
  if (newKey === oldKey || newKey === "" || newKey in parent) {
    return root;
  }
  const next: JsonObject = {};
  Object.entries(parent).forEach(([key, value]) => {
    next[key === oldKey ? newKey : key] = value;
  });
  return setAtPath(root, parentPath, next);
}

export function uniqueKey(parent: JsonObject, base = "key"): string {
  if (!(base in parent)) {
    return base;
  }
  let index = 2;
  while (`${base}${index}` in parent) {
    index += 1;
  }
  return `${base}${index}`;
}

/**
 * Append a child to the object or array at `path`.
 *
 * Returns the updated tree and the path of the new child, or `undefined` when the
 * target cannot hold children.
 */
export function addChildAtPath(
  root: JsonValue,
  path: Path,
  child: JsonValue,
): { root: JsonValue; path: Path } | undefined {
  const parent = getAtPath(root, path);
  if (Array.isArray(parent)) {
    const childPath = [...path, parent.length];
    return { root: setAtPath(root, path, [...parent, child]), path: childPath };
  }
  if (parent != null && isPlainObject(parent)) {
    const key = uniqueKey(parent);
    return {
      root: setAtPath(root, path, { ...parent, [key]: child }),
      path: [...path, key],
    };
  }
  return undefined;
}

/**
 * Replace the value at `path`, converting between kinds.
 *
 * Switching to an object or array discards the previous value.
 */
export function changeKindAtPath(
  root: JsonValue,
  path: Path,
  kind: NodeKind,
): JsonValue {
  const current = getAtPath(root, path);
  if (getKind(current ?? null) === kind) {
    return root;
  }
  if (kind === "object") {
    return setAtPath(root, path, {});
  }
  if (kind === "array") {
    return setAtPath(root, path, []);
  }
  return setAtPath(root, path, "");
}

export type ValueType = "string" | "number" | "boolean" | "null";

export function getValueType(value: JsonValue): ValueType {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "string";
}

/** Convert a primitive to `type`, keeping the existing value where it makes sense. */
export function coerceValue(value: JsonValue, type: ValueType): JsonPrimitive {
  switch (type) {
    case "number": {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case "boolean":
      return Boolean(value) && value !== "false";
    case "null":
      return null;
    default:
      return value == null || typeof value === "object" ? "" : String(value);
  }
}
