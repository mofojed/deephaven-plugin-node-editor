import { expect, test } from "@playwright/test";
import {
  configJson,
  expectConfig,
  fillField,
  hoconNode,
  openEditor,
} from "./utils";

/** Matches `CONFIG` in `tests/app.d/hocon_fixtures.py`. */
const CONFIG = {
  name: "prod",
  port: 8080,
  db: { host: "localhost", ssl: true },
  tags: ["alpha", "beta"],
};

test.describe("HOCON editor graph", () => {
  test("renders a node for the root and every entry", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

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
      await expect(hoconNode(panel, path)).toBeVisible();
    }

    await expect(hoconNode(panel, [])).toContainText("root");
    await expect(hoconNode(panel, ["db"])).toContainText("2 entries");
    await expect(hoconNode(panel, ["tags"])).toContainText("array");
    // Array entries are positional, so their keys are shown rather than edited.
    await expect(hoconNode(panel, ["tags", 0])).toContainText("[0]");
    await expect(
      hoconNode(panel, ["tags", 0]).getByLabel("Key", { exact: true }),
    ).toHaveCount(0);
  });

  test("edits a scalar value", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await fillField(hoconNode(panel, ["port"]), "Value", "9090");

    await expectConfig(panel, { ...CONFIG, port: 9090 });
  });

  test("edits a boolean with the value dropdown", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["db", "ssl"])
      .getByLabel("Value", { exact: true })
      .selectOption("false");

    await expectConfig(panel, {
      ...CONFIG,
      db: { host: "localhost", ssl: false },
    });
  });

  test("renames a key and keeps its position", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await fillField(hoconNode(panel, ["name"]), "Key", "environment");

    await expectConfig(panel, {
      environment: "prod",
      port: 8080,
      db: CONFIG.db,
      tags: CONFIG.tags,
    });
    await expect(hoconNode(panel, ["environment"])).toBeVisible();
    await expect(hoconNode(panel, ["name"])).toHaveCount(0);
    expect(Object.keys((await configJson(panel)) as object)).toEqual([
      "environment",
      "port",
      "db",
      "tags",
    ]);
  });

  test("refuses a rename that would overwrite a sibling", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await fillField(hoconNode(panel, ["name"]), "Key", "port");

    // The tree is unchanged, so `port` keeps its number and `name` survives.
    await expectConfig(panel, CONFIG);
    await expect(hoconNode(panel, ["name"])).toBeVisible();
  });

  test("adds a child to an object", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["db"])
      .getByLabel("Add child", { exact: true })
      .click();

    await expect(hoconNode(panel, ["db", "key"])).toBeVisible();
    await fillField(hoconNode(panel, ["db", "key"]), "Key", "port");
    await fillField(hoconNode(panel, ["db", "port"]), "Value", "5432");

    await expectConfig(panel, {
      ...CONFIG,
      db: { host: "localhost", ssl: true, port: "5432" },
    });
  });

  test("appends an entry to an array", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["tags"])
      .getByLabel("Add child", { exact: true })
      .click();

    await fillField(hoconNode(panel, ["tags", 2]), "Value", "gamma");

    await expectConfig(panel, { ...CONFIG, tags: ["alpha", "beta", "gamma"] });
    await expect(hoconNode(panel, ["tags"])).toContainText("3 entries");
  });

  test("deletes an entry and reindexes the array", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["tags", 0])
      .getByLabel("Delete", { exact: true })
      .click();

    await expectConfig(panel, { ...CONFIG, tags: ["beta"] });
    await expect(
      hoconNode(panel, ["tags", 0]).getByLabel("Value", { exact: true }),
    ).toHaveValue("beta");
    await expect(hoconNode(panel, ["tags", 1])).toHaveCount(0);
  });

  test("deletes a whole subtree", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["db"])
      .getByLabel("Delete", { exact: true })
      .click();

    await expectConfig(panel, {
      name: "prod",
      port: 8080,
      tags: CONFIG.tags,
    });
    await expect(hoconNode(panel, ["db", "host"])).toHaveCount(0);
  });

  test("cannot delete the root", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await expect(
      hoconNode(panel, []).getByLabel("Delete", { exact: true }),
    ).toHaveCount(0);
  });

  test("changes the type of a value", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");
    const port = hoconNode(panel, ["port"]);

    await port.getByLabel("Value type", { exact: true }).selectOption("string");
    await expectConfig(panel, { ...CONFIG, port: "8080" });

    await port.getByLabel("Value type", { exact: true }).selectOption("null");
    await expectConfig(panel, { ...CONFIG, port: null });
    await expect(port).toContainText("null");

    await port.getByLabel("Value type", { exact: true }).selectOption("number");
    await expectConfig(panel, { ...CONFIG, port: 0 });
  });

  test("converts a value into an object and back", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["name"])
      .getByLabel("Convert to object", { exact: true })
      .click();
    await expectConfig(panel, { ...CONFIG, name: {} });
    await expect(hoconNode(panel, ["name"])).toContainText("object");

    await hoconNode(panel, ["name"])
      .getByLabel("Add child", { exact: true })
      .click();
    await expectConfig(panel, { ...CONFIG, name: { key: "" } });
  });

  test("converts an object into an array", async ({ page }) => {
    const panel = await openEditor(page, "hocon_controlled");

    await hoconNode(panel, ["db"])
      .getByLabel("Change type", { exact: true })
      .click();

    await expectConfig(panel, { ...CONFIG, db: [] });
    await expect(hoconNode(panel, ["db"])).toContainText("array");
  });

  test("uncontrolled editor owns its own value", async ({ page }) => {
    const panel = await openEditor(page, "hocon_uncontrolled");
    await expect(panel.getByText("Uncontrolled HOCON editor")).toBeVisible();

    await fillField(hoconNode(panel, ["port"]), "Value", "1234");

    // The server never sends the value back, but it still hears about the edit.
    await expectConfig(panel, { ...CONFIG, port: 1234 });
    await expect(
      hoconNode(panel, ["port"]).getByLabel("Value", { exact: true }),
    ).toHaveValue("1234");
  });

  test("resolves HOCON substitutions on the server", async ({ page }) => {
    const panel = await openEditor(page, "hocon_string");

    await expect(hoconNode(panel, ["app", "port"])).toBeVisible();
    await expect(
      hoconNode(panel, ["mirror", "port"]).getByLabel("Value", { exact: true }),
    ).toHaveValue("9000");
  });
});
