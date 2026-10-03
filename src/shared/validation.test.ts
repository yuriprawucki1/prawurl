import { describe, expect, it } from "vitest";
import { aliasSchema, bulkLinkActionSchema, countryCodeSchema, createLinkSchema, destinationUrlSchema, exportLinkSchema, updateLinkSchema } from "./validation";

describe("validation contracts", () => {
  it.each([
    ["https://example.com/path?q=1", "https://example.com/path?q=1"],
    ["http://example.com/path", "http://example.com/path"],
    [" example.com ", "https://example.com/"]
  ])("normalizes destination %s", (input, expected) => {
    expect(destinationUrlSchema.parse(input)).toBe(expected);
  });

  it("alias boundaries", () => {
    for (const valid of ["ab", "a".repeat(48), "ABC_123-test"]) expect(aliasSchema.safeParse(valid).success).toBe(true);
    for (const invalid of ["a", "a".repeat(49), "_start", "-start", "has space", "áá", "a/b", "a.b"])
      expect(aliasSchema.safeParse(invalid).success).toBe(false);
  });

  const base = { destinationUrl: "https://example.com" };
  it.each([
    ["password", ["abcd", "a".repeat(128)], ["abc", "a".repeat(129)]],
    ["tags", [[], Array(10).fill("tag"), ["a".repeat(32)]], [Array(11).fill("tag"), [""], ["a".repeat(33)]]],
    ["countryAllowlist", [[], Array(20).fill("br")], [Array(21).fill("BR"), ["BRA"], ["1A"]]],
    ["countryBlocklist", [[], ["pt"]], [["P"], Array(21).fill("PT")]],
    ["clickLimit", [1, 1000000], [0, -1, 1000001, 1.5]],
    ["inactiveExpiresAfterMinutes", [1, 1000000], [0, -1, 1000001, 1.5]]
  ] as const)("option boundaries %s", (field, valid, invalid) => {
    for (const value of valid) expect(createLinkSchema.safeParse({ ...base, [field]: value }).success).toBe(true);
    for (const value of invalid) expect(createLinkSchema.safeParse({ ...base, [field]: value }).success).toBe(false);
  });

  it("option boundaries batch ids and redirect codes", () => {
    for (const schema of [exportLinkSchema, bulkLinkActionSchema]) {
      for (const size of [1, 100]) expect(schema.safeParse({ ids: Array(size).fill("id"), action: "delete" }).success).toBe(true);
      for (const ids of [[], Array(101).fill("id"), [""]]) expect(schema.safeParse({ ids, action: "delete" }).success).toBe(false);
    }
    for (const code of [301, 302]) expect(createLinkSchema.safeParse({ ...base, redirectCode: code }).success).toBe(true);
    expect(createLinkSchema.safeParse({ ...base, redirectCode: 307 }).success).toBe(false);
    expect(countryCodeSchema.parse(" br ")).toBe("BR");
    expect(createLinkSchema.parse({ ...base, password: " abcd ", countryAllowlist: ["pt"] })).toMatchObject({ password: "abcd", countryAllowlist: ["PT"] });
  });

  it("optional and nullable contracts", () => {
    expect(createLinkSchema.parse(base)).toEqual({ destinationUrl: "https://example.com/" });
    expect(updateLinkSchema.parse({})).toEqual({});
    for (const field of ["expiresAt", "password", "clickLimit", "inactiveExpiresAfterMinutes"]) {
      expect(createLinkSchema.parse({ ...base, [field]: null })[field as "password"]).toBeNull();
      expect(updateLinkSchema.parse({ [field]: null })[field as "password"]).toBeNull();
    }
    expect(updateLinkSchema.parse({ title: null })).toEqual({ title: null });
    for (const field of ["alias", "title", "tags", "countryAllowlist", "favorite", "pinned"])
      expect(createLinkSchema.safeParse({ ...base, [field]: null }).success).toBe(false);
  });
});
