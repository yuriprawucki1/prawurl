import { expect, test, type Page } from "@playwright/test";

async function expectNoGlobalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));

  expect(Math.max(metrics.body, metrics.document)).toBeLessThanOrEqual(metrics.client + 1);
}

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).last().boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (!box || !viewport) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectHorizontallyInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).last().boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (!box || !viewport) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function openNavigationItem(page: Page, name: string) {
  const item = page.getByRole("button", { name, exact: true });

  if (!(await item.isVisible())) {
    await page.getByRole("button", { name: "Alternar sidebar" }).click();
  }

  await item.click();
}

async function saveScreenshot(page: Page, name: string) {
  await page.screenshot({ fullPage: true, path: `test-results/layout-${test.info().project.name}-${name}.png` });
}

test("estados principais permanecem alinhados em desktop e mobile", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Links" })).toBeVisible();
  await expectNoGlobalOverflow(page);
  await saveScreenshot(page, "links");

  const listBeforeSelection = await page.locator("[data-testid='links-list']").boundingBox();
  await page.getByRole("checkbox").first().click();
  await expect(page.locator("[data-testid='bulk-actions-bar']")).toBeVisible();
  await expectHorizontallyInsideViewport(page, "[data-testid='bulk-actions-bar']");
  const listAfterSelection = await page.locator("[data-testid='links-list']").boundingBox();
  expect(listBeforeSelection).not.toBeNull();
  expect(listAfterSelection).not.toBeNull();
  if (listBeforeSelection && listAfterSelection) {
    expect(Math.abs(listBeforeSelection.y - listAfterSelection.y)).toBeLessThanOrEqual(1);
  }
  await saveScreenshot(page, "bulk-actions");
  await page.getByRole("button", { name: "Limpar seleção" }).click();

  await page.getByRole("button", { name: "Novo link" }).click();
  await expect(page.getByRole("heading", { name: "Novo link" })).toBeVisible();
  await page.getByRole("combobox").filter({ hasText: "Sem expiração" }).click();
  await page.getByRole("option", { name: "Personalizado" }).click();
  await page.getByText("Expira em").locator("..").getByRole("button").first().click();
  if (await page.locator("[data-slot='popover-content']").isVisible()) {
    await expectInsideViewport(page, "[data-slot='popover-content']");
  } else {
    await expectHorizontallyInsideViewport(page, "[data-testid='date-time-picker-panel']");
  }
  await expectNoGlobalOverflow(page);
  await saveScreenshot(page, "editor-datepicker");
  await page.locator("[data-testid='date-time-picker-panel']").getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await openNavigationItem(page, "Admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expectNoGlobalOverflow(page);
  await saveScreenshot(page, "admin");

  const actionTrigger = page.locator("button[aria-label='Abrir ações do link']").first();
  if (await actionTrigger.isVisible()) {
    const scrollXBefore = await page.evaluate(() => window.scrollX);
    const before = await actionTrigger.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    await actionTrigger.click();
    await expect(page.locator("[data-slot='dropdown-menu-content']")).toBeVisible();
    const after = await actionTrigger.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });

    expect(Math.abs(before.x - after.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(scrollXBefore);

    await expectInsideViewport(page, "[data-slot='dropdown-menu-content']");
    await saveScreenshot(page, "admin-actions");
    await page.getByRole("menuitem", { name: "Editar" }).click();
  } else {
    await page.getByRole("button", { name: "Editar" }).first().click();
  }

  await expect(page.getByRole("heading", { name: "Editar link" })).toBeVisible();
  await expect(page.getByText("Senha definida")).toBeVisible();
  await page.getByPlaceholder("Adicionar país").first().fill("Portugal");
  await page.keyboard.press("Enter");
  await expect(page.getByText("PT · Portugal")).toBeVisible();
  await expectNoGlobalOverflow(page);
  await saveScreenshot(page, "editor-password-countries");
  await page.getByRole("button", { name: "Cancelar" }).click();

  await openNavigationItem(page, "Auditoria");
  await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
  await expect(page.locator("text=...")).toHaveCount(0);
  await expectNoGlobalOverflow(page);
  await saveScreenshot(page, "audit");
});
