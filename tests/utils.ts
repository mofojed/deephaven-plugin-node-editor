import test, { expect, type Locator, type Page } from "@playwright/test";

/** A deephaven.ui element panel that has finished rendering. */
const ELEMENT_PANEL =
  ".dh-panel.widget-loader-deephaven\\.ui\\.Element:visible";

/** Path to a node in the editor, matching the ids React Flow renders. */
export type EditorPath = (string | number)[];

/**
 * Go to a page and wait for the initial loading bar to disappear.
 * @param page The page
 * @param url The URL to navigate to, relative to the configured base URL
 */
export async function gotoPage(page: Page, url: string): Promise<void> {
  await test.step(`Go to page (${url})`, async () => {
    await page.goto(url);
    await expect(
      page.getByRole("progressbar", { name: "Loading...", exact: true }),
    ).toHaveCount(0);
  });
}

/**
 * Wait for every loading spinner on the page to disappear.
 * @param page The page
 */
export async function waitForLoad(page: Page): Promise<void> {
  await expect(page.locator(".loading-spinner")).toHaveCount(0);
}

/**
 * Open a panel from the Panels menu.
 * @param page The page
 * @param name The name of the panel or dashboard
 * @param panelLocator The locator for the panel, passed to `page.locator`
 */
export async function openPanel(
  page: Page,
  name: string,
  panelLocator = ELEMENT_PANEL,
): Promise<void> {
  await test.step(`Open panel (${name})`, async () => {
    const appPanels = page.getByRole("button", { name: "Panels", exact: true });
    await expect(appPanels).toBeEnabled();

    const panelCount = await page.locator(panelLocator).count();
    await appPanels.click();

    const search = page.getByRole("searchbox", {
      name: "Find Table, Plot or Widget",
      exact: true,
    });
    await search.fill(name);

    const targetPanel = page.getByRole("button", { name, exact: true });
    await expect(targetPanel).toBeEnabled();
    await targetPanel.click();

    // Reset the mouse so it does not leave a hover state on the menu.
    await page.mouse.move(0, 0);

    await expect(page.locator(panelLocator)).toHaveCount(panelCount + 1, {
      timeout: 30000,
    });
    await waitForLoad(page);
  });
}

/**
 * Open a dashboard from the Panels menu and wait for all of its panels.
 * @param page The page
 * @param name The name of the dashboard
 * @param titles The titles of the panels the dashboard opens
 */
export async function openDashboard(
  page: Page,
  name: string,
  titles: string[],
): Promise<void> {
  await test.step(`Open dashboard (${name})`, async () => {
    const appPanels = page.getByRole("button", { name: "Panels", exact: true });
    await expect(appPanels).toBeEnabled();
    await appPanels.click();

    const search = page.getByRole("searchbox", {
      name: "Find Table, Plot or Widget",
      exact: true,
    });
    await search.fill(name);
    await page.getByRole("button", { name, exact: true }).click();
    await page.mouse.move(0, 0);

    for (const title of titles) {
      await expect(dashboardPanel(page, title)).toBeVisible({ timeout: 30000 });
    }
    await waitForLoad(page);
    await hideMinimap(page);
  });
}

/**
 * Locate a dashboard panel by its title.
 *
 * Golden Layout gives every panel its own stack, but the stack holding the
 * dashboard tab lists every title too, so take the innermost match.
 * @param page The page
 * @param title The panel title
 */
export function dashboardPanel(page: Page, title: string): Locator {
  const exact = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  return page
    .locator(".lm_stack")
    .filter({ has: page.locator(".lm_title", { hasText: exact }) })
    .last();
}

/**
 * Hide the React Flow minimap.
 *
 * The minimap is an overlay pinned to the bottom right of the canvas, so it
 * swallows clicks aimed at whatever node sits underneath it. Nothing the tests
 * assert on depends on it.
 * @param page The page
 */
export async function hideMinimap(page: Page): Promise<void> {
  await page.addStyleTag({
    content: ".react-flow__minimap { display: none; }",
  });
}

/**
 * Open a fixture panel and return a locator scoped to it.
 * @param page The page
 * @param name The name of the fixture in the Panels menu
 */
export async function openEditor(page: Page, name: string): Promise<Locator> {
  await gotoPage(page, "");
  await openPanel(page, name);
  const panel = page.locator(ELEMENT_PANEL).last();
  await expect(panel.locator(".react-flow__node").first()).toBeVisible();
  await hideMinimap(page);
  return panel;
}

/**
 * Locate a graph node by its path from the root.
 *
 * React Flow puts the node id in `data-id`, and the editor ids nodes with the
 * JSON encoded path, e.g. `["db","host"]`.
 * @param panel The panel containing the editor
 * @param path The path from the root, e.g. `['db', 'host']`
 */
export function editorNode(panel: Locator, path: EditorPath): Locator {
  return panel.locator(`.react-flow__node[data-id='${JSON.stringify(path)}']`);
}

/**
 * Read the configuration the server currently holds for a fixture.
 * @param panel The panel containing the editor
 */
export async function configJson(panel: Locator): Promise<unknown> {
  const text = await panel.getByLabel("config json").inputValue();
  return JSON.parse(text);
}

/**
 * Wait until the server side configuration matches `expected`.
 * @param panel The panel containing the editor
 * @param expected The expected configuration
 */
export async function expectConfig(
  panel: Locator,
  expected: unknown,
): Promise<void> {
  await expect
    .poll(async () => configJson(panel), { timeout: 15000 })
    .toEqual(expected);
}

/**
 * Wait for a grid to paint before continuing.
 *
 * The grid draws to a `<canvas>`, so the loading spinner disappearing does not
 * mean any data has been painted. This polls until the canvas is no longer a
 * single uniform color.
 * @param gridContainer Locator containing a grid canvas
 * @param timeout How long to wait, in ms
 */
export async function waitForGridRender(
  gridContainer: Locator,
  timeout = 30000,
): Promise<void> {
  await test.step("Wait for grid to render", async () => {
    const canvas = gridContainer.locator("canvas.grid-canvas").first();
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => isGridBodyBlank(canvas), { timeout })
      .toBe(false);
  });
}

/**
 * Wait for a grid to hold no rows.
 *
 * Only the area below the column headers is checked, so the headers a filtered
 * out table still draws do not count as content.
 * @param gridContainer Locator containing a grid canvas
 * @param timeout How long to wait, in ms
 */
export async function expectGridEmpty(
  gridContainer: Locator,
  timeout = 30000,
): Promise<void> {
  await test.step("Wait for grid to empty", async () => {
    const canvas = gridContainer.locator("canvas.grid-canvas").first();
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => isGridBodyBlank(canvas), { timeout })
      .toBe(true);
  });
}

/** True when everything below the column headers is a single flat color. */
function isGridBodyBlank(canvas: Locator): Promise<boolean> {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext("2d");
    const cssWidth = el.getBoundingClientRect().width;
    if (ctx == null || el.width === 0 || el.height === 0 || cssWidth === 0) {
      return true;
    }
    // Ignore the header row and the scroll bar gutters, all of which are drawn
    // even when the table has no rows.
    const scale = el.width / cssWidth;
    const top = Math.round(40 * scale);
    const gutter = Math.round(20 * scale);
    const width = el.width - gutter;
    const height = el.height - top - gutter;
    if (width <= 0 || height <= 0) {
      return true;
    }
    const { data } = ctx.getImageData(0, top, width, height);
    for (let i = 4; i < data.length; i += 4) {
      if (
        data[i] !== data[0] ||
        data[i + 1] !== data[1] ||
        data[i + 2] !== data[2] ||
        data[i + 3] !== data[3]
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * A fingerprint of what a grid has painted, for spotting that it redrew.
 * @param gridContainer Locator containing a grid canvas
 */
export function gridSignature(gridContainer: Locator): Promise<string> {
  return gridContainer
    .locator("canvas.grid-canvas")
    .first()
    .evaluate((el: HTMLCanvasElement) => el.toDataURL());
}

/**
 * Type into one of a node's fields and commit it with Enter.
 * @param node The node locator
 * @param label The aria-label of the field, e.g. `Key` or `Value`
 * @param text The text to enter
 */
export async function fillField(
  node: Locator,
  label: string,
  text: string,
): Promise<void> {
  const field = node.getByLabel(label, { exact: true });
  await field.fill(text);
  await field.press("Enter");
}
