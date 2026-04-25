import type { CreateLinkInput, Link, LinkSummary, RedirectCacheEntry, UpdateLinkInput, User } from "../shared/contracts";
import { createLinkSchema, updateLinkSchema } from "../shared/validation";
import { AliasPolicy } from "../domain/alias-policy";
import { UrlPolicy } from "../domain/url-policy";
import type { AuditLogRepository, LinkRepository, RedirectCache } from "../domain/ports";

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
    const now = new Date().toISOString();

    if (await this.links.findByAlias(alias)) {
      throw new Error("ALIAS_TAKEN");
    }

    const link = await this.links.create(owner.id, {
      id: crypto.randomUUID(),
      alias,
      destinationUrl,
      title: parsed.title ?? "",
      expiresAt: parsed.expiresAt ?? null,
      redirectCode: parsed.redirectCode ?? 302,
      now
    });

    await this.cache.put(toCacheEntry(link));
    await this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: owner.id,
      action: "link.create",
      entityType: "link",
      entityId: link.id,
      severity: "info",
      metadata: { alias: link.alias },
      occurredAt: now
    });

    return link;
  }

  listForUser(owner: User): Promise<LinkSummary[]> {
    return this.links.listByOwner(owner.id);
  }

  listAll(): Promise<LinkSummary[]> {
    return this.links.listAll();
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
    const link = await this.links.update(id, ownerId, { ...parsed, destinationUrl }, now);

    if (!link) {
      throw new Error("LINK_NOT_FOUND");
    }

    if (link.status === "active") {
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
      severity: adminMode ? "warning" : "info",
      metadata: { alias: link.alias, adminMode },
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
}

function toCacheEntry(link: Link): RedirectCacheEntry {
  return {
    id: link.id,
    alias: link.alias,
    destinationUrl: link.destinationUrl,
    status: link.status,
    expiresAt: link.expiresAt,
    redirectCode: link.redirectCode
  };
}
