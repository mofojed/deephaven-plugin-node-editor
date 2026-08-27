import { expect, test } from "@playwright/test";
import {
  dashboardPanel,
  expectGridEmpty,
  fillField,
  gotoPage,
  gridSignature,
  hoconNode,
  openDashboard,
  waitForGridRender,
} from "./utils";

test.describe("trade_filter example", () => {
  const PANELS = ["Filter config", "Trades"];

  test("filters the live table from the config graph", async ({ page }) => {
    await gotoPage(page, "");
    await openDashboard(page, "trade_monitor", PANELS);

    const editor = dashboardPanel(page, "Filter config");
    const trades = dashboardPanel(page, "Trades");

    // The graph mirrors the HOCON the example starts from.
    await expect(
      hoconNode(editor, ["filter", "min_price"]).getByLabel("Value", {
        exact: true,
      }),
    ).toHaveValue("80");
    await expect(
      hoconNode(editor, ["filter", "symbols", 0]).getByLabel("Value", {
        exact: true,
      }),
    ).toHaveValue("AAPL");
    await expect(hoconNode(editor, ["filter", "sides"])).toContainText(
      "1 entry",
    );
    await waitForGridRender(trades);

    // A symbol nothing matches filters every row out.
    await hoconNode(editor, ["filter", "symbols", 1])
      .getByLabel("Delete", { exact: true })
      .click();
    await fillField(
      hoconNode(editor, ["filter", "symbols", 0]),
      "Value",
      "NOSUCH",
    );
    await expectGridEmpty(trades);

    // Widening the filter brings rows back.
    await fillField(
      hoconNode(editor, ["filter", "symbols", 0]),
      "Value",
      "AAPL",
    );
    await waitForGridRender(trades);
  });

  test("a price floor nothing clears empties the table", async ({ page }) => {
    await gotoPage(page, "");
    await openDashboard(page, "trade_monitor", PANELS);

    const editor = dashboardPanel(page, "Filter config");
    const trades = dashboardPanel(page, "Trades");
    await waitForGridRender(trades);

    await fillField(
      hoconNode(editor, ["filter", "min_price"]),
      "Value",
      "100000",
    );
    await expectGridEmpty(trades);
  });
});

test.describe("algo_matrix example", () => {
  const PANELS = [
    "Algo matrix (HOCON)",
    "Nodes",
    "Transitions",
    "Fired transitions",
    "Activity",
  ];

  /** Path to the first transition of the first phase. */
  const FIRST_TRANSITION = ["matrix", "phases", 0, "transitions", 0];

  test("renders the matrix as a graph", async ({ page }) => {
    await gotoPage(page, "");
    await openDashboard(page, "algo_matrix", PANELS);

    const editor = dashboardPanel(page, "Algo matrix (HOCON)");

    await expect(
      hoconNode(editor, ["matrix", "name"]).getByLabel("Value", {
        exact: true,
      }),
    ).toHaveValue("SampleMatrix");
    await expect(hoconNode(editor, ["matrix", "phases"])).toContainText(
      "2 entries",
    );
    await expect(
      hoconNode(editor, ["matrix", "phases", 0, "nodes"]),
    ).toContainText("3 entries");
    await expect(
      hoconNode(editor, [...FIRST_TRANSITION, "signal"]).getByLabel("Value", {
        exact: true,
      }),
    ).toHaveValue("10");

    for (const title of ["Nodes", "Transitions", "Fired transitions"]) {
      await waitForGridRender(dashboardPanel(page, title));
    }
  });

  test("rebuilds the transitions table when a threshold changes", async ({
    page,
  }) => {
    await gotoPage(page, "");
    await openDashboard(page, "algo_matrix", PANELS);

    const editor = dashboardPanel(page, "Algo matrix (HOCON)");
    const transitions = dashboardPanel(page, "Transitions");
    await waitForGridRender(transitions);
    const before = await gridSignature(transitions);

    await fillField(
      hoconNode(editor, [...FIRST_TRANSITION, "signal"]),
      "Value",
      "3",
    );

    await expect
      .poll(async () => gridSignature(transitions), { timeout: 30000 })
      .not.toEqual(before);
  });

  test("adding a node adds a row to the nodes table", async ({ page }) => {
    await gotoPage(page, "");
    await openDashboard(page, "algo_matrix", PANELS);

    const editor = dashboardPanel(page, "Algo matrix (HOCON)");
    const nodes = dashboardPanel(page, "Nodes");
    await waitForGridRender(nodes);
    const before = await gridSignature(nodes);

    const phaseNodes = ["matrix", "phases", 0, "nodes"];
    await hoconNode(editor, phaseNodes)
      .getByLabel("Add child", { exact: true })
      .click();
    await hoconNode(editor, [...phaseNodes, 3])
      .getByLabel("Convert to object", { exact: true })
      .click();
    await hoconNode(editor, [...phaseNodes, 3])
      .getByLabel("Add child", { exact: true })
      .click();
    await fillField(
      hoconNode(editor, [...phaseNodes, 3, "key"]),
      "Key",
      "label",
    );
    await fillField(
      hoconNode(editor, [...phaseNodes, 3, "label"]),
      "Value",
      "Node11",
    );

    await expect
      .poll(async () => gridSignature(nodes), { timeout: 30000 })
      .not.toEqual(before);
  });

  test("thresholds nothing reaches stop the transitions firing", async ({
    page,
  }) => {
    await gotoPage(page, "");
    await openDashboard(page, "algo_matrix", PANELS);

    const editor = dashboardPanel(page, "Algo matrix (HOCON)");
    const fired = dashboardPanel(page, "Fired transitions");
    await waitForGridRender(fired);

    for (const [phase, transition] of [
      [0, 0],
      [0, 1],
      [1, 0],
    ]) {
      await fillField(
        hoconNode(editor, [
          "matrix",
          "phases",
          phase,
          "transitions",
          transition,
          "signal",
        ]),
        "Value",
        "100000",
      );
    }

    await expectGridEmpty(fired);
  });
});
