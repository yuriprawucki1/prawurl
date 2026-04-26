import { describe, expect, it } from "vitest";
import { UrlPolicy } from "./url-policy";
import type { BlockedDomainRepository } from "./ports";

class MemoryBlockedDomains implements BlockedDomainRepository {
  constructor(private readonly values: string[]) {}

  async isBlocked(hostname: string): Promise<boolean> {
    return this.values.includes(hostname);
  }

  async list(): Promise<never[]> {
    return [];
  }

  async add(): Promise<void> {
    return;
  }

  async remove(): Promise<boolean> {
    return false;
  }
}

describe("UrlPolicy", () => {
  it("accepts http and https destinations", async () => {
    await expect(new UrlPolicy(new MemoryBlockedDomains([])).validate("https://example.com/a")).resolves.toBe("https://example.com/a");
  });

  it("rejects self-referential and blocked destinations", async () => {
    await expect(new UrlPolicy(new MemoryBlockedDomains([])).validate("https://prawurl.com/test")).rejects.toThrow("DESTINATION_SELF_REFERENTIAL");
    await expect(new UrlPolicy(new MemoryBlockedDomains(["bad.test"])).validate("https://bad.test")).rejects.toThrow("DESTINATION_BLOCKED");
  });
});
