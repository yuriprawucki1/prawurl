import { test as base, expect } from "@playwright/test";
import { startLocalWorkers, type LocalWorkers } from "../helpers/local-workers.mjs";

export const test = base.extend<{}, { runtime: LocalWorkers }>({
  runtime: [async ({}, use) => {
    const runtime = await startLocalWorkers({ apiPort: Number(new URL(process.env.E2E_API_ORIGIN ?? "http://127.0.0.1:4910").port) });
    try { await use(runtime); } finally { await runtime.stop(); }
  }, { scope: "worker", timeout: 120000 }],
  page: async ({ page, context, runtime }, use) => {
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await runtime.db.exec("DELETE FROM links; DELETE FROM click_events; DELETE FROM audit_logs;");
    for (const key of (await runtime.kv.list()).keys) await runtime.kv.delete(key.name);
    await context.addCookies([{ name: "prawurl_session", value: runtime.tokens.admin, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await use(page);
    await test.info().attach("browser-errors", { body: JSON.stringify({ errors, consoleErrors }, null, 2), contentType: "application/json" });
    expect(errors).toEqual([]);
  }
});
export { expect };
