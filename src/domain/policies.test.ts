import { describe, expect, it, vi } from "vitest";
import { AliasPolicy } from "./alias-policy";
import { UrlPolicy } from "./url-policy";
import { AdminPolicy } from "./admin-policy";
import type { BlockedDomainRepository } from "./ports";
import { user } from "../../tests/helpers/contracts";

describe("policy decisions", () => {
  it("rejects forbidden destinations", async () => {
    const blocked = { isBlocked: vi.fn(async (host: string) => host === "bad.test") } as unknown as BlockedDomainRepository;
    const policy = new UrlPolicy(blocked);
    for (const url of ["https://prawurl.com/test", "http://app.prawurl.com/", "https://a.b.prawurl.com/"])
      await expect(policy.validate(url)).rejects.toThrow("DESTINATION_SELF_REFERENTIAL");
    await expect(policy.validate("https://bad.test/")).rejects.toThrow("DESTINATION_BLOCKED");
    await expect(policy.validate("https://notprawurl.com/")).resolves.toBe("https://notprawurl.com/");
  });

  it("reserved aliases", async () => {
    const policy = new AliasPolicy({ isReserved: async (alias) => alias === "custom" });
    for (const alias of ["app", " STATUS ", "custom"])
      await expect(policy.validate(alias)).rejects.toThrow("ALIAS_RESERVED");
    await expect(policy.validate(" My-Alias ")).resolves.toBe("my-alias");
  });

  it("admin and active guards", () => {
    const policy = new AdminPolicy();
    expect(() => policy.assertAdmin(user)).toThrow("FORBIDDEN");
    expect(() => policy.assertAdmin({ ...user, role: "admin" })).not.toThrow();
    expect(() => policy.assertActive({ ...user, status: "blocked" })).toThrow("USER_BLOCKED");
    expect(() => policy.assertActive(user)).not.toThrow();
  });
});
