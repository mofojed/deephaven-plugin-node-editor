import { expect, test } from "@playwright/test";
import {
  configJson,
  expectConfig,
  fillField,
  editorNode,
  openEditor,
} from "./utils";

/** Matches `CONFIG` in `tests/app.d/node_editor_fixtures.py`. */
const CONFIG = {
  name: "prod",
  port: 8080,
  db: { host: "localhost", ssl: true },
  tags: ["alpha", "beta"],
};

test.describe("Node editor graph", () => {
  test("renders a node for the root and every entry", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    for (const path of [
      [],
      ["name"],
      ["port"],
      ["db"],
      ["db", "host"],
      ["db", "ssl"],
      ["tags"],
      ["tags", 0],
      ["tags", 1],
    ]) {
      await expect(editorNode(panel, path)).toBeVisible();
    }

    await expect(editorNode(panel, [])).toContainText("root");
    await expect(editorNode(panel, ["db"])).toContainText("2 entries");
    await expect(editorNode(panel, ["tags"])).toContainText("array");
    // Array entries are positional, so their keys are shown rather than edited.
    await expect(editorNode(panel, ["tags", 0])).toContainText("[0]");
    await expect(
      editorNode(panel, ["tags", 0]).getByLabel("Key", { exact: true }),
    ).toHaveCount(0);
  });

  test("edits a scalar value", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await fillField(editorNode(panel, ["port"]), "Value", "9090");

    await expectConfig(panel, { ...CONFIG, port: 9090 });
  });

  test("edits a boolean with the value dropdown", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["db", "ssl"])
      .getByLabel("Value", { exact: true })
      .selectOption("false");

    await expectConfig(panel, {
      ...CONFIG,
      db: { host: "localhost", ssl: false },
    });
  });

  test("renames a key and keeps its position", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await fillField(editorNode(panel, ["name"]), "Key", "environment");

    await expectConfig(panel, {
      environment: "prod",
      port: 8080,
      db: CONFIG.db,
      tags: CONFIG.tags,
    });
    await expect(editorNode(panel, ["environment"])).toBeVisible();
    await expect(editorNode(panel, ["name"])).toHaveCount(0);
    expect(Object.keys((await configJson(panel)) as object)).toEqual([
      "environment",
      "port",
      "db",
      "tags",
    ]);
  });

  test("refuses a rename that would overwrite a sibling", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await fillField(editorNode(panel, ["name"]), "Key", "port");

    // The tree is unchanged, so `port` keeps its number and `name` survives.
    await expectConfig(panel, CONFIG);
    await expect(editorNode(panel, ["name"])).toBeVisible();
  });

  test("adds a child to an object", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["db"])
      .getByLabel("Add child", { exact: true })
      .click();

    await expect(editorNode(panel, ["db", "key"])).toBeVisible();
    await fillField(editorNode(panel, ["db", "key"]), "Key", "port");
    await fillField(editorNode(panel, ["db", "port"]), "Value", "5432");

    await expectConfig(panel, {
      ...CONFIG,
      db: { host: "localhost", ssl: true, port: "5432" },
    });
  });

  test("appends an entry to an array", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["tags"])
      .getByLabel("Add child", { exact: true })
      .click();

    await fillField(editorNode(panel, ["tags", 2]), "Value", "gamma");

    await expectConfig(panel, { ...CONFIG, tags: ["alpha", "beta", "gamma"] });
    await expect(editorNode(panel, ["tags"])).toContainText("3 entries");
  });

  test("deletes an entry and reindexes the array", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["tags", 0])
      .getByLabel("Delete", { exact: true })
      .click();

    await expectConfig(panel, { ...CONFIG, tags: ["beta"] });
    await expect(
      editorNode(panel, ["tags", 0]).getByLabel("Value", { exact: true }),
    ).toHaveValue("beta");
    await expect(editorNode(panel, ["tags", 1])).toHaveCount(0);
  });

  test("deletes a whole subtree", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["db"])
      .getByLabel("Delete", { exact: true })
      .click();

    await expectConfig(panel, {
      name: "prod",
      port: 8080,
      tags: CONFIG.tags,
    });
    await expect(editorNode(panel, ["db", "host"])).toHaveCount(0);
  });

  test("cannot delete the root", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await expect(
      editorNode(panel, []).getByLabel("Delete", { exact: true }),
    ).toHaveCount(0);
  });

  test("changes the type of a value", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");
    const port = editorNode(panel, ["port"]);

    await port.getByLabel("Value type", { exact: true }).selectOption("string");
    await expectConfig(panel, { ...CONFIG, port: "8080" });

    await port.getByLabel("Value type", { exact: true }).selectOption("null");
    await expectConfig(panel, { ...CONFIG, port: null });
    await expect(port).toContainText("null");

    await port.getByLabel("Value type", { exact: true }).selectOption("number");
    await expectConfig(panel, { ...CONFIG, port: 0 });
  });

  test("converts a value into an object and back", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["name"])
      .getByLabel("Convert to object", { exact: true })
      .click();
    await expectConfig(panel, { ...CONFIG, name: {} });
    await expect(editorNode(panel, ["name"])).toContainText("object");

    await editorNode(panel, ["name"])
      .getByLabel("Add child", { exact: true })
      .click();
    await expectConfig(panel, { ...CONFIG, name: { key: "" } });
  });

  test("converts an object into an array", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_controlled");

    await editorNode(panel, ["db"])
      .getByLabel("Change type", { exact: true })
      .click();

    await expectConfig(panel, { ...CONFIG, db: [] });
    await expect(editorNode(panel, ["db"])).toContainText("array");
  });

  test("uncontrolled editor owns its own value", async ({ page }) => {
    const panel = await openEditor(page, "node_editor_uncontrolled");
    await expect(panel.getByText("Uncontrolled node editor")).toBeVisible();

    await fillField(editorNode(panel, ["port"]), "Value", "1234");

    // The server never sends the value back, but it still hears about the edit.
    await expectConfig(panel, { ...CONFIG, port: 1234 });
    await expect(
      editorNode(panel, ["port"]).getByLabel("Value", { exact: true }),
    ).toHaveValue("1234");
  });

  test("resolves HOCON substitutions on the server", async ({ page }) => {
    const panel = await openEditor(page, "hocon_string");

    await expect(editorNode(panel, ["app", "port"])).toBeVisible();
    await expect(
      editorNode(panel, ["mirror", "port"]).getByLabel("Value", {
        exact: true,
      }),
    ).toHaveValue("9000");
  });
});
