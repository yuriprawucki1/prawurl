import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectService } from "./redirect-service";
import { hashPassword, signUnlockToken } from "../infrastructure/link-security";
import type { LinkRepository } from "../domain/ports";
import { link, now } from "../../tests/helpers/contracts";
import type { Link } from "../shared/contracts";

function harness(overrides: Partial<Link> = {}) {
  const current = { ...link(overrides), passwordHash: null as string | null, passwordSalt: null as string | null, passwordIterations: null as number | null };
  const repository = { findAccessByAlias: vi.fn(async () => current), recordSuccessfulClick: vi.fn(async () => true) };
  const cache = { get: vi.fn(async () => null), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) };
  return { current, repository, cache, service: new RedirectService(repository as unknown as LinkRepository, cache, "test-secret", null) };
}
const context = { now, country: "BR", unlockToken: null };

describe("redirect obligations", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["active", {}, "redirect"],
    ["disabled", { status: "disabled" }, "blocked"],
    ["blocked", { status: "blocked" }, "blocked"],
    ["expired", { expiresAt: now }, "blocked"],
    ["inactivity", { inactiveExpiresAfterMinutes: 59 }, "blocked"],
    ["inactivity-bound", { inactiveExpiresAfterMinutes: 60 }, "redirect"],
    ["allowlist", { countryAllowlist: ["US"] }, "blocked"],
    ["allowlist-accepted", { countryAllowlist: ["BR"] }, "redirect"],
    ["blocklist", { countryBlocklist: ["BR"] }, "blocked"],
    ["blocklist-accepted", { countryBlocklist: ["AR"] }, "redirect"],
    ["click-limit", { clickLimit: 1, clickCount: 1 }, "blocked"],
    ["click-below-limit", { clickLimit: 1, clickCount: 0 }, "redirect"],
    ["password", { passwordProtected: true, passwordUpdatedAt: now }, "password_required"]
  ] as [string, Partial<Link>, string][])("access decisions %s", async (_name, overrides, kind) => {
    const { service, repository } = harness(overrides);
    const result = await service.resolve("sample", context);
    expect(result.kind).toBe(kind);
    if (kind === "redirect") expect(result.destinationUrl).toBe("https://example.com/first");
    else { expect(result.destinationUrl).toBeUndefined(); expect(repository.recordSuccessfulClick).not.toHaveBeenCalled(); }
  });

  it("access decisions missing country and missing link", async () => {
    for (const restriction of [{ countryAllowlist: ["BR"] }, { countryBlocklist: ["AR"] }])
      expect((await harness(restriction).service.resolve("sample", { ...context, country: null })).kind).toBe("blocked");
    const { service, repository } = harness();
    repository.findAccessByAlias.mockResolvedValue(null as never);
    expect((await service.resolve("missing", context)).kind).toBe("not_found");
  });

  it("access decisions concurrent quota rejection and stale cache", async () => {
    const { service, repository, cache } = harness();
    cache.get.mockResolvedValue({ id: "test-link", alias: "sample", status: "active", expiresAt: now, destinationUrl: "https://stale.test/", redirectCode: 302 } as never);
    expect((await service.resolve("sample", context)).destinationUrl).toBe("https://example.com/first");
    repository.recordSuccessfulClick.mockResolvedValue(false);
    const denied = await service.resolve("sample", context);
    expect(denied.kind).toBe("blocked");
    expect(denied.destinationUrl).toBeUndefined();
  });

  it("unlock authorization", async () => {
    const { service, current, repository } = harness({ passwordProtected: true, passwordUpdatedAt: now });
    const hashed = await hashPassword("test-password");
    Object.assign(current, { passwordHash: hashed.hash, passwordSalt: hashed.salt, passwordIterations: hashed.iterations });
    expect((await service.unlock("sample", "wrong", context)).kind).toBe("password_required");
    expect(repository.recordSuccessfulClick).not.toHaveBeenCalled();
    const unlocked = await service.unlock("sample", "test-password", context);
    expect(unlocked.kind).toBe("redirect");
    expect(unlocked.setCookie).toContain("HttpOnly; Secure; SameSite=Lax; Max-Age=900");
    const payload = { linkId: current.id, passwordVersion: now, expiresAt: "2026-10-02T12:15:00.000Z" };
    const valid = await signUnlockToken(payload, "test-secret");
    expect(await service.canUseUnlockToken(current, valid)).toBe(true);
    const invalid = [
      valid.slice(0, -1) + (valid.endsWith("a") ? "b" : "a"),
      await signUnlockToken({ ...payload, expiresAt: now }, "test-secret"),
      await signUnlockToken({ ...payload, passwordVersion: "old" }, "test-secret"),
      await signUnlockToken({ ...payload, linkId: "different" }, "test-secret")
    ];
    for (const token of invalid) {
      expect(await service.canUseUnlockToken(current, token)).toBe(false);
      expect((await service.resolve("sample", { ...context, unlockToken: token })).kind).toBe("password_required");
    }
  });
});
