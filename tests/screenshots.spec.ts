import { test, type Locator, type Page } from "@playwright/test";
import {
  dashboardPanel,
  fillField,
  gotoPage,
  editorNode,
  openDashboard,
  waitForGridRender,
} from "./utils";

/**
 * Regenerates the images the README embeds. Skipped by default so an ordinary
 * test run never rewrites checked in assets.
 *
 *   UPDATE_SCREENSHOTS=1 npx playwright test tests/screenshots.spec.ts
 */
test.skip(
  !process.env.UPDATE_SCREENSHOTS,
  "Set UPDATE_SCREENSHOTS=1 to regenerate the README images",
);

test.use({ viewport: { width: 1600, height: 900 } });

/** The stack holding a whole dashboard, so the console stays out of the shot. */
function dashboardStack(page: Page, name: string): Locator {
  return page
    .locator(".lm_stack")
    .filter({
      has: page.locator(".lm_title", { hasText: new RegExp(`^${name}$`) }),
    })
    .first();
}

/** Zoom the graph in so the node fields are legible in the image. */
async function zoomIn(editor: Locator, times: number): Promise<void> {
  const zoom = editor.getByRole("button", { name: "zoom in" });
  for (let i = 0; i < times; i += 1) {
    await zoom.click();
  }
}

test("algo matrix dashboard", async ({ page }) => {
  await gotoPage(page, "");
  await openDashboard(page, "algo_matrix", [
    "Algo matrix (HOCON)",
    "Nodes",
    "Transitions",
    "Fired transitions",
    "Activity",
  ]);

  const editor = dashboardPanel(page, "Algo matrix (HOCON)");
  await waitForGridRender(dashboardPanel(page, "Fired transitions"));

  // Drop a threshold so the second phase fires too.
  await fillField(
    editorNode(editor, ["matrix", "phases", 1, "transitions", 0, "signal"]),
    "Value",
    "8",
  );
  await waitForGridRender(dashboardPanel(page, "Activity"));

  await zoomIn(editor, 5);
  await page.mouse.move(0, 0);
  await dashboardStack(page, "algo_matrix").screenshot({
    path: "_assets/algo_matrix.png",
  });
});

test("trade filter dashboard", async ({ page }) => {
  await gotoPage(page, "");
  await openDashboard(page, "trade_monitor", ["Filter config", "Trades"]);

  const editor = dashboardPanel(page, "Filter config");
  const trades = dashboardPanel(page, "Trades");
  await waitForGridRender(trades);

  // Narrow the feed so the effect of the config is obvious in the image.
  await editorNode(editor, ["filter", "symbols", 1])
    .getByLabel("Delete", { exact: true })
    .click();
  await fillField(editorNode(editor, ["filter", "min_price"]), "Value", "120");
  await waitForGridRender(trades);

  await zoomIn(editor, 2);
  await page.mouse.move(0, 0);
  await dashboardStack(page, "trade_monitor").screenshot({
    path: "_assets/trade_filter.png",
  });
});
