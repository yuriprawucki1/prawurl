import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkService } from "./link-service";
import { AliasPolicy } from "../domain/alias-policy";
import { UrlPolicy } from "../domain/url-policy";
import type { AuditLogRepository, BlockedDomainRepository, LinkRepository } from "../domain/ports";
import { link, user } from "../../tests/helpers/contracts";

function harness() {
  const current = link();
  const repository = {
    findByAlias: vi.fn(async () => null), findById: vi.fn(async () => current),
    create: vi.fn(async () => current), update: vi.fn(async () => current), delete: vi.fn(async () => true)
  };
  const cache = { get: vi.fn(async () => null), put: vi.fn(async () => {}), delete: vi.fn(async () => {}) };
  const audit = { insert: vi.fn(async () => {}) };
  const service = new LinkService(repository as unknown as LinkRepository, cache,
    new AliasPolicy({ isReserved: async () => false }),
    new UrlPolicy({ isBlocked: async () => false } as unknown as BlockedDomainRepository),
    audit as unknown as AuditLogRepository);
  return { service, repository, cache, current, audit };
}

describe("link service obligations", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("duplicate alias", async () => {
    const { service, repository, current, cache } = harness();
    repository.findByAlias.mockResolvedValue(current as never);
    await expect(service.create(user, { destinationUrl: "https://example.com", alias: "sample" })).rejects.toThrow("ALIAS_TAKEN");
    expect(repository.create).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("cache lifecycle", async () => {
    const { service, repository, current, cache, audit } = harness();
    await service.create(user, { destinationUrl: "https://example.com/first", alias: "sample" });
    expect(cache.put).toHaveBeenCalledWith(expect.objectContaining({ alias: "sample", destinationUrl: "https://example.com/first", status: "active" }));
    cache.put.mockClear();
    repository.update.mockResolvedValue(link({ destinationUrl: "https://example.com/edited", title: "Edited" }));
    await service.update(user, current.id, { destinationUrl: "https://example.com/edited", title: "Edited" });
    expect(cache.put).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active", destinationUrl: "https://example.com/edited" }));
    cache.put.mockClear();
    repository.update.mockResolvedValue(link({ status: "disabled" }));
    await service.update(user, current.id, { status: "disabled" });
    expect(cache.delete).toHaveBeenCalledWith("sample");
    expect(cache.put).not.toHaveBeenCalled();
    repository.update.mockResolvedValue(link({ status: "active", destinationUrl: "https://example.com/second" }));
    await service.update(user, current.id, { status: "active", destinationUrl: "https://example.com/second" });
    expect(cache.put).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active", destinationUrl: "https://example.com/second" }));
    await service.delete(user, current.id);
    expect(repository.delete).toHaveBeenCalledWith(current.id, user.id);
    expect(cache.delete).toHaveBeenLastCalledWith("sample");
    expect(audit.insert).toHaveBeenCalledTimes(5);
  });

  it.each([
    { passwordProtected: true }, { clickLimit: 2 }, { inactiveExpiresAfterMinutes: 5 },
    { countryAllowlist: ["BR"] }, { countryBlocklist: ["AR"] }, { status: "blocked" as const }
  ])("cache lifecycle restricted %j", async (restriction) => {
    const { service, repository, cache } = harness();
    repository.create.mockResolvedValue(link(restriction));
    await service.create(user, { destinationUrl: "https://example.com", alias: "sample" });
    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith("sample");
  });

  it("ownership guards", async () => {
    const { service, repository, current, cache } = harness();
    const stranger = { ...user, id: "stranger" };
    await expect(service.update(stranger, current.id, { title: "changed" })).rejects.toThrow("LINK_NOT_FOUND");
    await expect(service.delete(stranger, current.id)).rejects.toThrow("LINK_NOT_FOUND");
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(current.title).toBe("Sample");
  });

  it("persistence failure propagates", async () => {
    const { service, repository, cache, audit } = harness();
    repository.create.mockRejectedValue(new Error("D1_UNAVAILABLE"));
    await expect(service.create(user, { destinationUrl: "https://example.com", alias: "sample" })).rejects.toThrow("D1_UNAVAILABLE");
    expect(cache.put).not.toHaveBeenCalled();
    expect(audit.insert).not.toHaveBeenCalled();
  });
});
