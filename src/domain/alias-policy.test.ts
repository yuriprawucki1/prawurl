import { describe, expect, it } from "vitest";
import { AliasPolicy } from "./alias-policy";
import type { AliasRepository } from "./ports";

class MemoryAliases implements AliasRepository {
  constructor(private readonly values: string[]) {}

  async isReserved(alias: string): Promise<boolean> {
    return this.values.includes(alias);
  }
}

describe("AliasPolicy", () => {
  it("normalizes valid aliases", async () => {
    await expect(new AliasPolicy(new MemoryAliases([])).validate("Launch-01")).resolves.toBe("launch-01");
    await expect(new AliasPolicy(new MemoryAliases([])).validate("cv")).resolves.toBe("cv");
  });

  it("rejects reserved aliases", async () => {
    await expect(new AliasPolicy(new MemoryAliases([])).validate("api")).rejects.toThrow("ALIAS_RESERVED");
    await expect(new AliasPolicy(new MemoryAliases(["vip"])).validate("vip")).rejects.toThrow("ALIAS_RESERVED");
  });
});
