import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import QRCode from "qrcode";

async function bounds(page: Page) {
  const width = await page.evaluate(() => ({ body: document.body.scrollWidth, root: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(Math.max(width.body, width.root)).toBeLessThanOrEqual(width.viewport + 1);
}
async function navigation(page: Page, name: string) {
  const item = page.getByRole("button", { name, exact: true });
  if (!(await item.isVisible())) await page.getByRole("button", { name: "Alternar sidebar" }).click();
  await item.click();
}
async function action(page: Page, name: string) {
  await expect(page.getByTestId("links-list").getByRole("link").first()).toBeVisible();
  const direct = page.getByRole("button", { name, exact: true }).first();
  if (await direct.isVisible()) await direct.click();
  else {
    await page.getByRole("button", { name: "Abrir ações do link" }).first().click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
}
async function fillEditor(page: Page, alias: string, title: string) {
  await page.getByPlaceholder("https://...").fill("https://example.com/browser");
  await page.getByPlaceholder("Opcional", { exact: true }).nth(0).fill(alias);
  await page.getByPlaceholder("Opcional", { exact: true }).nth(1).fill(title);
}

test("screens and responsive bounds", async ({ page, context }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PrawURL", exact: true })).toBeVisible();
  await bounds(page);
  await page.screenshot({ path: `test-results/e2e/public-${info.project.name}.png`, fullPage: true });
  await context.clearCookies();
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Entre para gerenciar seus links." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
  await bounds(page);
  await page.screenshot({ path: `test-results/e2e/login-${info.project.name}.png`, fullPage: true });
  await context.addCookies([{ name: "prawurl_session", value: "admin-token", domain: "127.0.0.1", path: "/", httpOnly: true }]);
  await page.goto("/app");
  for (const name of ["Links", "Analytics", "Admin", "Auditoria"]) {
    await navigation(page, name);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await bounds(page);
    await page.screenshot({ path: `test-results/e2e/${name.toLowerCase()}-${info.project.name}.png`, fullPage: true });
  }
  await page.goto("/status");
  await expect(page.getByText("Status do PrawURL", { exact: true })).toBeVisible();
  await expect(page.getByText("API operacional", { exact: true })).toBeVisible();
  await bounds(page);
});

test("theme persists after reload", async ({ page }) => {
  await page.goto("/");
  const previous = await page.locator("html").evaluate((element) => element.classList.contains("dark"));
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(!previous);
  await page.reload();
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(!previous);
});

test("creates edits and deletes persisted links", async ({ page, runtime }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Novo link", exact: true }).click();
  await fillEditor(page, "browser-crud", "Created in browser");
  await page.getByRole("button", { name: "Criar link", exact: true }).click();
  await expect(page.getByText("Created in browser", { exact: true }).filter({ visible: true })).toBeVisible();
  expect(await runtime.db.prepare("SELECT title FROM links WHERE alias='browser-crud'").first("title")).toBe("Created in browser");
  await action(page, "Editar");
  await page.getByPlaceholder("https://...").fill("https://example.com/edited");
  await page.getByPlaceholder("Opcional", { exact: true }).nth(1).fill("Edited in browser");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Edited in browser", { exact: true }).filter({ visible: true })).toBeVisible();
  expect(await runtime.db.prepare("SELECT destination_url FROM links WHERE alias='browser-crud'").first("destination_url")).toBe("https://example.com/edited");
  await action(page, "Excluir");
  await expect(page.getByRole("heading", { name: "Excluir link?" })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText("Edited in browser", { exact: true })).toHaveCount(0);
  expect(await runtime.db.prepare("SELECT id FROM links WHERE alias='browser-crud'").first()).toBeNull();
});

test("bulk actions and CSV selection", async ({ page, runtime }) => {
  for (const alias of ["bulk-selected", "bulk-other"]) {
    const response = await page.request.post(`${runtime.apiUrl}/links`, { data: { alias, destinationUrl: `https://example.com/${alias}` } });
    expect(response.status()).toBe(201);
  }
  await page.goto("/app");
  // The mobile list uses cards rather than table rows.
  const select = page.getByRole("link", { name: /\/bulk-selected$/ }).locator("xpath=ancestor::tr | ancestor::label").getByRole("checkbox");
  await select.click();
  // The baseline checked control uses the primary token for both fill and border.
  const primaryColor = await select.evaluate(() => {
    const swatch = document.createElement("span");
    swatch.style.color = "hsl(var(--primary))";
    document.body.appendChild(swatch);
    const primary = getComputedStyle(swatch).color;
    swatch.remove();
    return primary;
  });
  await expect(select).toHaveCSS("background-color", primaryColor);
  await expect(select).toHaveCSS("border-color", primaryColor);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar selecionados" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("bulk-selected");
  expect(csv).not.toContain("bulk-other");
  await page.getByRole("button", { name: "Desativar selecionados" }).click();
  await expect.poll(() => runtime.db.prepare("SELECT status FROM links WHERE alias='bulk-selected'").first("status")).toBe("disabled");
  expect(await runtime.db.prepare("SELECT status FROM links WHERE alias='bulk-other'").first("status")).toBe("active");
  // Make the unselected link disabled too, so an accidental activation of all links is observable.
  const otherId = await runtime.db.prepare("SELECT id FROM links WHERE alias='bulk-other'").first<string>("id");
  expect((await page.request.patch(`${runtime.apiUrl}/links/${otherId}`, { data: { status: "disabled" } })).status()).toBe(200);
  expect(await runtime.db.prepare("SELECT status FROM links WHERE alias='bulk-other'").first("status")).toBe("disabled");
  await select.click();
  await page.getByRole("button", { name: "Ativar selecionados", exact: true }).click();
  await expect.poll(() => runtime.db.prepare("SELECT status FROM links WHERE alias='bulk-selected'").first("status")).toBe("active");
  expect(await runtime.db.prepare("SELECT status FROM links WHERE alias='bulk-other'").first("status")).toBe("disabled");
});

test("empty and loading states", async ({ page }) => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/links?*", async (route) => { await barrier; await route.continue(); });
  await page.route("**/links", async (route) => { if (route.request().method() === "GET") await barrier; await route.continue(); });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Links", exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo link", exact: true })).toBeVisible();
  release();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await expect(page.getByTestId("links-list").getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Links", exact: true })).toBeVisible();
  await bounds(page);
});

test("operation failures allow retry", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Novo link", exact: true }).click();
  await fillEditor(page, "retry-link", "Retry link");
  for (const mode of ["http", "network"] as const) {
    await page.route("**/links", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      if (mode === "http") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "TEST_UNAVAILABLE" }) });
      else await route.abort("failed");
    });
    await page.getByRole("button", { name: "Criar link", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Novo link", exact: true })).toBeVisible();
    await expect(page.getByText(mode === "http" ? "TEST_UNAVAILABLE" : "Não foi possível conectar à API. Verifique sua conexão e tente novamente.").first()).toBeVisible();
    await page.unroute("**/links");
  }
  await page.getByRole("button", { name: "Criar link", exact: true }).click();
  await expect(page.getByText("Retry link", { exact: true }).filter({ visible: true })).toBeVisible();
});

test("QR encodes selected public URL", async ({ page, runtime, baseURL }) => {
  expect((await page.request.post(`${runtime.apiUrl}/links`, { data: { alias: "qr-link", destinationUrl: "https://example.com/qr" } })).status()).toBe(201);
  await page.goto("/app");
  await action(page, "QR Code");
  await expect(page.getByRole("heading", { name: "QR Code", exact: true })).toBeVisible();
  const image = page.getByRole("img", { name: "QR Code de qr-link" });
  await expect(image).toBeVisible();
  const expected = QRCode.create(`${baseURL}/qr-link`).modules;
  const actual = await image.evaluate((element, size) => {
    const img = element as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const scale = img.naturalWidth / (size + 2);
    return Array.from({ length: size * size }, (_, index) => {
      const x = Math.floor((index % size + 1.5) * scale);
      const y = Math.floor((Math.floor(index / size) + 1.5) * scale);
      return ctx.getImageData(x, y, 1, 1).data[0] < 128 ? 1 : 0;
    });
  }, expected.size);
  // Compare actual encoded modules, independent of browser/Node PNG compression.
  expect(actual).toEqual(Array.from(expected.data));
});
