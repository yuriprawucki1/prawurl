import type {
  CreateLinkInput,
  Link,
  LinkBulkActionInput,
  LinkExportInput,
  LinkListFilters,
  LinkSummary,
  UpdateLinkInput,
  User
} from "../shared/contracts";
import { createLinkSchema, updateLinkSchema } from "../shared/validation";
import { AliasPolicy } from "../domain/alias-policy";
import { UrlPolicy } from "../domain/url-policy";
import type { AuditLogRepository, LinkRepository, RedirectCache } from "../domain/ports";
import { analyzeDestinationSafety, extractDestinationDomain, hashPassword, normalizeCountryCodes } from "../infrastructure/link-security";

export class LinkService {
  constructor(
    private readonly links: LinkRepository,
    private readonly cache: RedirectCache,
    private readonly aliasPolicy: AliasPolicy,
    private readonly urlPolicy: UrlPolicy,
    private readonly auditLogs: AuditLogRepository
  ) {}

  async create(owner: User, input: CreateLinkInput): Promise<Link> {
    const parsed = createLinkSchema.parse(input);
    const alias = await this.aliasPolicy.validate(parsed.alias ?? crypto.randomUUID().slice(0, 8));
    const destinationUrl = await this.urlPolicy.validate(parsed.destinationUrl);
    const destinationDomain = extractDestinationDomain(destinationUrl);
    const safety = analyzeDestinationSafety(destinationUrl);
    const now = new Date().toISOString();
    const password = await this.createPasswordState(parsed.password);

    if (await this.links.findByAlias(alias)) {
      throw new Error("ALIAS_TAKEN");
    }

    const link = await this.links.create(owner.id, {
      id: crypto.randomUUID(),
      alias,
      destinationUrl,
      destinationDomain,
      title: parsed.title ?? undefined,
      tags: parsed.tags ?? [],
      expiresAt: parsed.expiresAt ?? null,
      redirectCode: parsed.redirectCode ?? 302,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      passwordUpdatedAt: password.updatedAt,
      clickLimit: parsed.clickLimit ?? null,
      inactiveExpiresAfterMinutes: parsed.inactiveExpiresAfterMinutes ?? null,
      countryAllowlist: normalizeCountryCodes(parsed.countryAllowlist),
      countryBlocklist: normalizeCountryCodes(parsed.countryBlocklist),
      favorite: parsed.favorite ?? false,
      pinned: parsed.pinned ?? false,
      safetyStatus: safety.status,
      safetyReason: safety.reason,
      now
    });

    if (shouldCache(link)) {
      await this.cache.put(toCacheEntry(link));
    } else {
      await this.cache.delete(link.alias);
    }

    await this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: owner.id,
      action: "link.create",
      entityType: "link",
      entityId: link.id,
      severity: safety.status === "suspect" ? "warning" : "info",
      metadata: {
        alias: link.alias,
        destinationDomain: link.destinationDomain,
        passwordProtected: link.passwordProtected,
        safetyStatus: link.safetyStatus
      },
      occurredAt: now
    });

    return link;
  }

  listForUser(owner: User, filters?: LinkListFilters): Promise<LinkSummary[]> {
    return this.links.listByOwner(owner.id, filters);
  }

  listAll(filters?: LinkListFilters): Promise<LinkSummary[]> {
    return this.links.listAll(filters);
  }

  async bulkAction(actor: User, input: LinkBulkActionInput, adminMode = false): Promise<{ affected: number }> {
    const parsed = input;
    const now = new Date().toISOString();
    const ownerId = adminMode ? null : actor.id;

    if (parsed.action === "delete") {
      const affected = await this.links.bulkDelete(parsed.ids, ownerId);
      await this.auditLogs.insert({
        id: crypto.randomUUID(),
        actorUserId: actor.id,
        action: "link.bulk_delete",
        entityType: "link",
        entityId: null,
        severity: adminMode ? "warning" : "info",
        metadata: { ids: parsed.ids.length, adminMode },
        occurredAt: now
      });
      return { affected };
    }

    const status = parsed.action === "activate" ? "active" : "disabled";
    const affected = await this.links.bulkUpdateStatus(parsed.ids, status, ownerId, now);
    await this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      action: "link.bulk_status",
      entityType: "link",
      entityId: null,
      severity: adminMode ? "warning" : "info",
      metadata: { ids: parsed.ids.length, status, adminMode },
      occurredAt: now
    });
    return { affected };
  }

  async exportSelected(actor: User, input: LinkExportInput, adminMode = false): Promise<LinkSummary[]> {
    const links = await this.links.findManyByIds(input.ids);
    return adminMode ? links : links.filter((link) => link.ownerId === actor.id);
  }

  async update(actor: User, id: string, input: UpdateLinkInput, adminMode = false): Promise<Link> {
    const parsed = updateLinkSchema.parse(input);
    const now = new Date().toISOString();
    const ownerId = adminMode ? null : actor.id;
    const current = await this.links.findById(id);

    if (!current || (!adminMode && current.ownerId !== actor.id)) {
      throw new Error("LINK_NOT_FOUND");
    }

    const destinationUrl = parsed.destinationUrl ? await this.urlPolicy.validate(parsed.destinationUrl) : undefined;
    const destinationDomain = destinationUrl ? extractDestinationDomain(destinationUrl) : undefined;
    const safety = destinationUrl ? analyzeDestinationSafety(destinationUrl) : { status: current.safetyStatus, reason: current.safetyReason };
    const password = await this.updatePasswordState(parsed.password);

    const link = await this.links.update(
      id,
      ownerId,
      {
        ...parsed,
        destinationUrl,
        destinationDomain,
        tags: parsed.tags,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordIterations: password.iterations,
        passwordUpdatedAt: password.updatedAt,
        countryAllowlist: parsed.countryAllowlist === undefined ? undefined : normalizeCountryCodes(parsed.countryAllowlist),
        countryBlocklist: parsed.countryBlocklist === undefined ? undefined : normalizeCountryCodes(parsed.countryBlocklist),
        safetyStatus: safety.status,
        safetyReason: safety.reason
      },
      now
    );

    if (!link) {
      throw new Error("LINK_NOT_FOUND");
    }

    if (shouldCache(link)) {
      await this.cache.put(toCacheEntry(link));
    } else {
      await this.cache.delete(link.alias);
    }

    await this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      action: "link.update",
      entityType: "link",
      entityId: link.id,
      severity: adminMode || safety.status === "suspect" ? "warning" : "info",
      metadata: {
        alias: link.alias,
        adminMode,
        passwordProtected: link.passwordProtected,
        safetyStatus: link.safetyStatus
      },
      occurredAt: now
    });

    return link;
  }

  async delete(actor: User, id: string, adminMode = false): Promise<void> {
    const link = await this.links.findById(id);

    if (!link || (!adminMode && link.ownerId !== actor.id)) {
      throw new Error("LINK_NOT_FOUND");
    }

    const deleted = await this.links.delete(id, adminMode ? null : actor.id);
    if (!deleted) {
      throw new Error("LINK_NOT_FOUND");
    }

    await this.cache.delete(link.alias);
    await this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      action: "link.delete",
      entityType: "link",
      entityId: link.id,
      severity: adminMode ? "warning" : "info",
      metadata: { alias: link.alias, adminMode },
      occurredAt: new Date().toISOString()
    });
  }

  private async createPasswordState(password: string | null | undefined): Promise<{
    hash: string | null;
    salt: string | null;
    iterations: number | null;
    updatedAt: string | null;
  }> {
    if (!password) {
      return { hash: null, salt: null, iterations: null, updatedAt: null };
    }

    const now = new Date().toISOString();
    const hashed = await hashPassword(password);
    return {
      hash: hashed.hash,
      salt: hashed.salt,
      iterations: hashed.iterations,
      updatedAt: now
    };
  }

  private async updatePasswordState(password: string | null | undefined): Promise<{
    hash?: string | null;
    salt?: string | null;
    iterations?: number | null;
    updatedAt?: string | null;
  }> {
    if (password === undefined) {
      return {};
    }

    if (password === null) {
      return {
        hash: null,
        salt: null,
        iterations: null,
        updatedAt: new Date().toISOString()
      };
    }

    const hashed = await hashPassword(password);
    return {
      hash: hashed.hash,
      salt: hashed.salt,
      iterations: hashed.iterations,
      updatedAt: new Date().toISOString()
    };
  }
}

function shouldCache(link: Link): boolean {
  return (
    link.status === "active" &&
    !link.passwordProtected &&
    link.clickLimit === null &&
    link.inactiveExpiresAfterMinutes === null &&
    link.countryAllowlist.length === 0 &&
    link.countryBlocklist.length === 0
  );
}

function toCacheEntry(link: Link): { id: string; alias: string; destinationUrl: string; status: Link["status"]; expiresAt: string | null; redirectCode: 301 | 302 } {
  return {
    id: link.id,
    alias: link.alias,
    destinationUrl: link.destinationUrl,
    status: link.status,
    expiresAt: link.expiresAt,
    redirectCode: link.redirectCode
  };
}
