import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startLocalWorkers, type LocalWorkers } from "../../tests/helpers/local-workers.mjs";
import type { Link } from "../shared/contracts";

const readJson = (response: Response) => response.json() as Promise<{ link: Link; kind: string; destinationUrl?: string }>;

let runtime: LocalWorkers;
async function api(path: string, token?: string, method = "GET", body?: unknown) {
  return fetch(`${runtime.apiUrl}${path}`, { method, redirect: "manual", headers: {
    ...(token ? { cookie: `prawurl_session=${token}` } : {}), "content-type": "application/json"
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function create(alias: string, options = {}) {
  const response = await api("/links", runtime.tokens.owner, "POST", { alias, destinationUrl: "https://example.com/first", ...options });
  expect(response.status).toBe(201);
  return (await readJson(response)).link;
}

describe("local Workers HTTP contracts", () => {
  beforeAll(async () => { runtime = await startLocalWorkers(); }, 120000);
  afterAll(async () => { await runtime?.stop(); }, 30000);

  it("health and anonymous session", async () => {
    const health = await api("/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: "prawurl-api" });
    const session = await api("/auth/session");
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({ session: null });
  });

  it("unauthenticated requests return 401", async () => {
    for (const token of [undefined, runtime.tokens.expired, runtime.tokens.revoked]) {
      const response = await api("/links", token);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHENTICATED" });
    }
  });

  it("authorization returns 403", async () => {
    const regular = await api("/admin/users", runtime.tokens.owner);
    expect(regular.status).toBe(403);
    expect(await regular.json()).toEqual({ error: "FORBIDDEN" });
    const blocked = await api("/links", runtime.tokens.blocked);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: "USER_BLOCKED" });
  });

  it("duplicate alias returns 409", async () => {
    await create("duplicate");
    const duplicate = await api("/links", runtime.tokens.owner, "POST", { alias: "duplicate", destinationUrl: "https://example.org" });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: "ALIAS_TAKEN" });
    const reserved = await api("/links", runtime.tokens.owner, "POST", { alias: "app", destinationUrl: "https://example.org" });
    expect(reserved.status).toBe(409);
    expect(await reserved.json()).toEqual({ error: "ALIAS_RESERVED" });
    expect((await runtime.db.prepare("SELECT COUNT(*) AS n FROM links WHERE alias='duplicate'").first<{ n: number }>())?.n).toBe(1);
  });

  it("persists CRUD and cache lifecycle", async () => {
    const created = await create("lifecycle");
    expect(await runtime.db.prepare("SELECT destination_url FROM links WHERE id=?").bind(created.id).first("destination_url")).toBe("https://example.com/first");
    await expect.poll(() => runtime.kv.get("lifecycle", "json")).toMatchObject({ destinationUrl: "https://example.com/first" });
    const updated = await api(`/links/${created.id}`, runtime.tokens.owner, "PATCH", { destinationUrl: "https://example.com/second", title: "Updated" });
    expect(updated.status).toBe(200);
    expect((await readJson(updated)).link).toMatchObject({ destinationUrl: "https://example.com/second", title: "Updated" });
    await expect.poll(() => runtime.kv.get("lifecycle", "json")).toMatchObject({ destinationUrl: "https://example.com/second" });
    const disabled = await api(`/links/${created.id}`, runtime.tokens.owner, "PATCH", { status: "disabled" });
    expect(disabled.status).toBe(200);
    await expect.poll(() => runtime.kv.get("lifecycle")).toBeNull();
    expect(await runtime.db.prepare("SELECT status FROM links WHERE id=?").bind(created.id).first("status")).toBe("disabled");
    expect((await api(`/links/${created.id}`, runtime.tokens.owner, "PATCH", { status: "active" })).status).toBe(200);
    await expect.poll(() => runtime.kv.get("lifecycle", "json")).toMatchObject({ status: "active" });
    expect((await api(`/links/${created.id}`, runtime.tokens.owner, "DELETE")).status).toBe(200);
    expect(await runtime.db.prepare("SELECT id FROM links WHERE id=?").bind(created.id).first()).toBeNull();
    await expect.poll(() => runtime.kv.get("lifecycle")).toBeNull();
  });

  it("ownership guards preserve data", async () => {
    const created = await create("ownership");
    for (const [method, body] of [["PATCH", { title: "Hijacked" }], ["DELETE", undefined]] as const) {
      const denied = await api(`/links/${created.id}`, runtime.tokens.other, method, body);
      expect(denied.status).toBe(404);
      expect(await denied.json()).toEqual({ error: "LINK_NOT_FOUND" });
    }
    expect(await runtime.db.prepare("SELECT destination_url FROM links WHERE id=?").bind(created.id).first("destination_url")).toBe("https://example.com/first");
  });

  it.each([301, 302])("redirect codes and persisted clicks %s", async (redirectCode) => {
    const created = await create(`redirect-${redirectCode}`, { redirectCode });
    const response = await fetch(`${runtime.redirectUrl}/${created.alias}`, { redirect: "manual" });
    expect(response.status).toBe(redirectCode);
    expect(response.headers.get("location")).toBe("https://example.com/first");
    expect(await runtime.db.prepare("SELECT click_count FROM links WHERE id=?").bind(created.id).first("click_count")).toBe(1);
    await expect.poll(async () => (await runtime.db.prepare("SELECT COUNT(*) AS n FROM click_events WHERE link_id=?").bind(created.id).first<{ n: number }>())?.n).toBe(1);
  });

  it("public restrictions", async () => {
    const cases = [
      ["disabled", {}, { status: "disabled" }, "blocked"],
      ["blocked", {}, { status: "blocked" }, "blocked"],
      ["expired", { expiresAt: "2020-01-01T00:00:00.000Z" }, {}, "blocked"],
      ["inactivity", { inactiveExpiresAfterMinutes: 1 }, {}, "blocked"],
      ["allowlist", { countryAllowlist: ["ZZ"] }, {}, "blocked"],
      ["blocklist", { countryBlocklist: ["US", "XX", "T1"] }, {}, "blocked"],
      ["quota", { clickLimit: 1 }, {}, "blocked"],
      ["password", { password: "test-password" }, {}, "password_required"]
    ] as const;
    for (const [name, options, update, kind] of cases) {
      // Blocklist uses the runtime's local country; the own-layer proof separately covers all country decisions.
      const localOptions = name === "blocklist" ? { countryBlocklist: ["US", "XX"] } : options;
      const created = await create(`restriction-${name}`, localOptions);
      if (Object.keys(update).length) expect((await api(`/links/${created.id}`, runtime.tokens.owner, "PATCH", update)).status).toBe(200);
      if (name === "inactivity") await runtime.db.prepare("UPDATE links SET created_at='2020-01-01T00:00:00.000Z' WHERE id=?").bind(created.id).run();
      if (name === "quota") await api(`/public/resolve/${created.alias}`);
      const response = await api(`/public/resolve/${created.alias}`);
      expect(response.status).toBe(200);
      const result = await readJson(response);
      expect(result.kind).toBe(kind);
      expect(result.destinationUrl).toBeUndefined();
    }
  });

  it("concurrent click limit", async () => {
    const created = await create("concurrent", { clickLimit: 1 });
    const results = await Promise.all([api(`/public/resolve/${created.alias}`), api(`/public/resolve/${created.alias}`)]);
    const bodies = await Promise.all(results.map(readJson));
    expect(bodies.map((result) => result.kind).sort()).toEqual(["blocked", "redirect"]);
    expect(await runtime.db.prepare("SELECT click_count FROM links WHERE id=?").bind(created.id).first("click_count")).toBe(1);
  });

  it("password unlock", async () => {
    const created = await create("protected", { password: "test-password" });
    const wrong = await api("/public/resolve/protected/unlock", undefined, "POST", { password: "wrong" });
    expect((await readJson(wrong)).kind).toBe("password_required");
    expect(await runtime.db.prepare("SELECT click_count FROM links WHERE id=?").bind(created.id).first("click_count")).toBe(0);
    const valid = await api("/public/resolve/protected/unlock", undefined, "POST", { password: "test-password" });
    expect(valid.status).toBe(200);
    expect((await readJson(valid)).kind).toBe("redirect");
    expect(valid.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Lax; Max-Age=900");
    const cookie = valid.headers.get("set-cookie")!.split(";")[0];
    const resolved = await fetch(`${runtime.apiUrl}/public/resolve/protected`, { headers: { cookie } });
    expect((await readJson(resolved)).kind).toBe("redirect");
  });
});
