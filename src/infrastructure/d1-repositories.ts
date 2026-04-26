import type {
  AuditLog,
  BlockedDomainEntry,
  Link,
  LinkListFilters,
  LinkStatus,
  LinkSummary,
  OAuthProvider,
  PlatformSummary,
  SessionUser,
  User,
  UserRole,
  UserStatus
} from "../shared/contracts";
import { normalizeDomain } from "../shared/validation";
import type {
  AliasRepository,
  AuditLogRepository,
  BlockedDomainRepository,
  LinkAccessRecord,
  LinkRepository,
  MetricsRepository,
  SessionRepository,
  UserRepository
} from "../domain/ports";

type LinkRow = {
  id: string;
  owner_id: string;
  alias: string;
  destination_url: string;
  destination_domain: string;
  title: string | null;
  tags_json: string;
  status: LinkStatus;
  expires_at: string | null;
  redirect_code: 301 | 302;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
  password_updated_at: string | null;
  click_count: number;
  click_limit: number | null;
  inactive_expires_after_minutes: number | null;
  last_clicked_at: string | null;
  country_allowlist_json: string;
  country_blocklist_json: string;
  favorite: number;
  pinned: number;
  safety_status: string;
  safety_reason: string | null;
  created_at: string;
  updated_at: string;
};

type LinkSummaryRow = LinkRow & {
  owner_email?: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  severity: "info" | "warning" | "critical";
  metadata_json: string;
  occurred_at: string;
};

interface LinkListQuery {
  ownerId?: string;
  ids?: string[];
  filters?: LinkListFilters;
  limit?: number;
}

export class D1LinkRepository implements LinkRepository {
  constructor(private readonly db: D1Database) {}

  async create(ownerId: string, input: Parameters<LinkRepository["create"]>[1]): Promise<Link> {
    await this.db
      .prepare(
        `INSERT INTO links (
          id,
          owner_id,
          alias,
          destination_url,
          destination_domain,
          title,
          tags_json,
          status,
          expires_at,
          redirect_code,
          password_hash,
          password_salt,
          password_iterations,
          password_updated_at,
          click_count,
          click_limit,
          inactive_expires_after_minutes,
          last_clicked_at,
          country_allowlist_json,
          country_blocklist_json,
          favorite,
          pinned,
          safety_status,
          safety_reason,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        ownerId,
        input.alias,
        input.destinationUrl,
        input.destinationDomain,
        input.title ?? null,
        JSON.stringify(input.tags ?? []),
        input.expiresAt ?? null,
        input.redirectCode,
        input.passwordHash,
        input.passwordSalt,
        input.passwordIterations,
        input.passwordUpdatedAt,
        input.clickLimit ?? null,
        input.inactiveExpiresAfterMinutes ?? null,
        null,
        JSON.stringify(input.countryAllowlist ?? []),
        JSON.stringify(input.countryBlocklist ?? []),
        input.favorite ? 1 : 0,
        input.pinned ? 1 : 0,
        input.safetyStatus,
        input.safetyReason,
        input.now,
        input.now
      )
      .run();

    const link = await this.findById(input.id);
    if (!link) {
      throw new Error("LINK_CREATE_FAILED");
    }
    return link;
  }

  async findByAlias(alias: string): Promise<Link | null> {
    const row = await this.db.prepare("SELECT * FROM links WHERE alias = ?").bind(alias).first<LinkRow>();
    return row ? mapLink(row) : null;
  }

  async findById(id: string): Promise<Link | null> {
    const row = await this.db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<LinkRow>();
    return row ? mapLink(row) : null;
  }

  async findAccessByAlias(alias: string): Promise<LinkAccessRecord | null> {
    const row = await this.db.prepare("SELECT * FROM links WHERE alias = ?").bind(alias).first<LinkRow>();
    return row ? mapAccessLink(row) : null;
  }

  async findAccessById(id: string): Promise<LinkAccessRecord | null> {
    const row = await this.db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<LinkRow>();
    return row ? mapAccessLink(row) : null;
  }

  async listByOwner(ownerId: string, filters?: LinkListFilters): Promise<LinkSummary[]> {
    return this.listLinks({ ownerId, filters, limit: 500 });
  }

  async listAll(filters?: LinkListFilters): Promise<LinkSummary[]> {
    return this.listLinks({ filters, limit: 1000 });
  }

  async findManyByIds(ids: string[]): Promise<LinkSummary[]> {
    return this.listLinks({ ids, limit: ids.length });
  }

  async exportByIds(ids: string[]): Promise<LinkSummary[]> {
    return this.listLinks({ ids, limit: ids.length });
  }

  async update(
    id: string,
    ownerId: string | null,
    input: Parameters<LinkRepository["update"]>[2],
    now: string
  ): Promise<Link | null> {
    const current = await this.getRowById(id);
    if (!current || (ownerId && current.owner_id !== ownerId)) {
      return null;
    }

    const nextDestinationUrl = input.destinationUrl ?? current.destination_url;
    const nextDestinationDomain = input.destinationDomain ?? normalizeDomain(new URL(nextDestinationUrl).hostname);
    const nextPasswordHash = input.passwordHash === undefined ? current.password_hash : input.passwordHash;
    const nextPasswordSalt = input.passwordSalt === undefined ? current.password_salt : input.passwordSalt;
    const nextPasswordIterations = input.passwordIterations === undefined ? current.password_iterations : input.passwordIterations;
    const nextPasswordUpdatedAt = input.passwordUpdatedAt === undefined ? current.password_updated_at : input.passwordUpdatedAt;

    await this.db
      .prepare(
        `UPDATE links
         SET destination_url = ?,
             destination_domain = ?,
             title = ?,
             tags_json = ?,
             status = ?,
             expires_at = ?,
             redirect_code = ?,
             password_hash = ?,
             password_salt = ?,
             password_iterations = ?,
             password_updated_at = ?,
             click_limit = ?,
             inactive_expires_after_minutes = ?,
             country_allowlist_json = ?,
             country_blocklist_json = ?,
             favorite = ?,
             pinned = ?,
             safety_status = ?,
             safety_reason = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        nextDestinationUrl,
        nextDestinationDomain,
        input.title === undefined ? current.title : input.title,
        JSON.stringify(input.tags ?? parseTags(current.tags_json)),
        input.status ?? current.status,
        input.expiresAt === undefined ? current.expires_at : input.expiresAt,
        input.redirectCode ?? current.redirect_code,
        nextPasswordHash,
        nextPasswordSalt,
        nextPasswordIterations,
        nextPasswordUpdatedAt,
        input.clickLimit === undefined ? current.click_limit : input.clickLimit,
        input.inactiveExpiresAfterMinutes === undefined ? current.inactive_expires_after_minutes : input.inactiveExpiresAfterMinutes,
        JSON.stringify(input.countryAllowlist ?? parseCountries(current.country_allowlist_json)),
        JSON.stringify(input.countryBlocklist ?? parseCountries(current.country_blocklist_json)),
        input.favorite === undefined ? current.favorite : input.favorite ? 1 : 0,
        input.pinned === undefined ? current.pinned : input.pinned ? 1 : 0,
        input.safetyStatus ?? current.safety_status,
        input.safetyReason === undefined ? current.safety_reason : input.safetyReason,
        now,
        id
      )
      .run();

    return this.findById(id);
  }

  async delete(id: string, ownerId: string | null): Promise<boolean> {
    const existing = await this.getRowById(id);
    if (!existing || (ownerId && existing.owner_id !== ownerId)) {
      return false;
    }
    await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    return true;
  }

  async bulkUpdateStatus(ids: string[], status: "active" | "disabled", ownerId: string | null, now: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const placeholders = ids.map(() => "?").join(",");
    const params: unknown[] = [status, now, ...ids];
    let sql = `UPDATE links SET status = ?, updated_at = ? WHERE id IN (${placeholders})`;
    if (ownerId) {
      sql += " AND owner_id = ?";
      params.push(ownerId);
    }

    const result = await this.db.prepare(sql).bind(...params).run();
    return result.meta.changes ?? 0;
  }

  async bulkDelete(ids: string[], ownerId: string | null): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const placeholders = ids.map(() => "?").join(",");
    const params: unknown[] = [...ids];
    let sql = `DELETE FROM links WHERE id IN (${placeholders})`;
    if (ownerId) {
      sql += " AND owner_id = ?";
      params.push(ownerId);
    }

    const result = await this.db.prepare(sql).bind(...params).run();
    return result.meta.changes ?? 0;
  }

  async recordSuccessfulClick(id: string, now: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE links
         SET click_count = click_count + 1,
             last_clicked_at = ?,
             updated_at = ?
         WHERE id = ?
           AND status = 'active'
           AND (click_limit IS NULL OR click_count < click_limit)`
      )
      .bind(now, now, id)
      .run();

    return (result.meta.changes ?? 0) > 0;
  }

  private async listLinks(query: LinkListQuery): Promise<LinkSummary[]> {
    const { sql, params } = buildLinkListQuery(query);
    const result = await this.db.prepare(sql).bind(...params).all<LinkSummaryRow>();
    return (result.results ?? []).map(mapLinkSummary);
  }

  private async getRowById(id: string): Promise<LinkRow | null> {
    return this.db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<LinkRow>();
  }
}

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first<UserRow>();
    return row ? mapUser(row) : null;
  }

  async listAll(): Promise<User[]> {
    const result = await this.db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 500").all<UserRow>();
    return (result.results ?? []).map(mapUser);
  }

  async upsertOAuthUser(input: {
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    bootstrapAdminEmail: string | null;
    now: string;
  }): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await this.findByEmail(email);
    const userId = existing?.id ?? crypto.randomUUID();
    const role: UserRole = existing?.role ?? (input.bootstrapAdminEmail?.toLowerCase() === email ? "admin" : "user");

    await this.db
      .prepare(
        `INSERT INTO users (id, email, name, avatar_url, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
         ON CONFLICT(email) DO UPDATE SET name = excluded.name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at`
      )
      .bind(userId, email, input.name, input.avatarUrl, role, input.now, input.now)
      .run();

    await this.db
      .prepare(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_account_id) DO UPDATE SET email = excluded.email`
      )
      .bind(crypto.randomUUID(), userId, input.provider, input.providerAccountId, email, input.now)
      .run();

    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error("USER_CREATE_FAILED");
    }
    return user;
  }

  async updateStatus(id: string, status: UserStatus, now: string): Promise<User | null> {
    await this.db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
    return this.findById(id);
  }

  async updateRole(id: string, role: UserRole, now: string): Promise<User | null> {
    await this.db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(role, now, id).run();
    return this.findById(id);
  }
}

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(userId: string, tokenHash: string, expiresAt: string, now: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), userId, tokenHash, expiresAt, now)
      .run();
  }

  async findByTokenHash(tokenHash: string, now: string): Promise<SessionUser | null> {
    const row = await this.db
      .prepare(
        `SELECT u.*, s.expires_at AS session_expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`
      )
      .bind(tokenHash, now)
      .first<UserRow & { session_expires_at: string }>();

    return row ? { user: mapUser(row), expiresAt: row.session_expires_at } : null;
  }

  async revoke(tokenHash: string, now: string): Promise<void> {
    await this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?").bind(now, tokenHash).run();
  }
}

export class D1AliasRepository implements AliasRepository {
  constructor(private readonly db: D1Database) {}

  async isReserved(alias: string): Promise<boolean> {
    const row = await this.db.prepare("SELECT value FROM reserved_aliases WHERE value = ?").bind(alias).first<{ value: string }>();
    return Boolean(row);
  }
}

export class D1BlockedDomainRepository implements BlockedDomainRepository {
  constructor(private readonly db: D1Database) {}

  async isBlocked(hostname: string): Promise<boolean> {
    const parts = hostname.split(".");
    const candidates = parts.map((_, index) => parts.slice(index).join("."));
    const placeholders = candidates.map(() => "?").join(",");
    const row = await this.db.prepare(`SELECT domain FROM blocked_domains WHERE domain IN (${placeholders}) LIMIT 1`).bind(...candidates).first();
    return Boolean(row);
  }

  async list(): Promise<BlockedDomainEntry[]> {
    const result = await this.db
      .prepare("SELECT domain, reason, created_at FROM blocked_domains ORDER BY created_at DESC")
      .all<{ domain: string; reason: string; created_at: string }>();
    return (result.results ?? []).map((row) => ({
      domain: row.domain,
      reason: row.reason,
      createdAt: row.created_at
    }));
  }

  async add(input: BlockedDomainEntry): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO blocked_domains (domain, reason, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(domain) DO UPDATE SET reason = excluded.reason`
      )
      .bind(normalizeDomain(input.domain), input.reason, input.createdAt)
      .run();
  }

  async remove(domain: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM blocked_domains WHERE domain = ?").bind(normalizeDomain(domain)).run();
    return (result.meta.changes ?? 0) > 0;
  }
}

export class D1AuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: D1Database) {}

  async insert(input: Parameters<AuditLogRepository["insert"]>[0]): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, severity, metadata_json, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId,
        input.severity,
        JSON.stringify(input.metadata),
        input.occurredAt
      )
      .run();
  }

  async listRecent(limit: number): Promise<AuditLog[]> {
    const result = await this.db.prepare("SELECT * FROM audit_logs ORDER BY occurred_at DESC LIMIT ?").bind(limit).all<AuditRow>();
    return (result.results ?? []).map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      severity: row.severity,
      metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
      occurredAt: row.occurred_at
    }));
  }
}

export class D1MetricsRepository implements MetricsRepository {
  constructor(private readonly db: D1Database) {}

  async summary(): Promise<PlatformSummary> {
    const [users, activeUsers, links, activeLinks, clicks, auditEvents] = await Promise.all([
      count(this.db, "SELECT COUNT(*) AS value FROM users"),
      count(this.db, "SELECT COUNT(*) AS value FROM users WHERE status = 'active'"),
      count(this.db, "SELECT COUNT(*) AS value FROM links"),
      count(this.db, "SELECT COUNT(*) AS value FROM links WHERE status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"),
      count(this.db, "SELECT COUNT(*) AS value FROM click_events"),
      count(this.db, "SELECT COUNT(*) AS value FROM audit_logs")
    ]);
    return { users, activeUsers, links, activeLinks, clicks, auditEvents };
  }
}

export async function insertClickEvent(
  db: D1Database,
  event: {
    linkId: string | null;
    alias: string;
    occurredAt: string;
    country: string | null;
    region: string | null;
    referrer: string | null;
    userAgent: string | null;
    ipHash: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO click_events (id, link_id, alias, occurred_at, country, region, referrer, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), event.linkId, event.alias, event.occurredAt, event.country, event.region, event.referrer, event.userAgent, event.ipHash)
    .run();
}

function buildLinkListQuery(query: LinkListQuery): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.ownerId) {
    where.push("l.owner_id = ?");
    params.push(query.ownerId);
  }

  if (query.ids && query.ids.length > 0) {
    where.push(`l.id IN (${query.ids.map(() => "?").join(",")})`);
    params.push(...query.ids);
  }

  const filters = query.filters;
  if (filters?.status) {
    where.push("l.status = ?");
    params.push(filters.status);
  }
  if (filters?.search) {
    const search = `%${filters.search.trim().toLowerCase()}%`;
    where.push("(LOWER(l.alias) LIKE ? OR LOWER(l.destination_url) LIKE ? OR LOWER(COALESCE(l.title, '')) LIKE ?)");
    params.push(search, search, search);
  }
  if (filters?.domain) {
    const domain = normalizeDomain(filters.domain);
    where.push("(l.destination_domain = ? OR l.destination_domain LIKE ?)");
    params.push(domain, `%.${domain}`);
  }
  if (filters?.tag) {
    const tag = filters.tag.trim().toLowerCase();
    where.push("EXISTS (SELECT 1 FROM json_each(l.tags_json) WHERE LOWER(value) = ?)");
    params.push(tag);
  }
  if (filters?.createdFrom) {
    where.push("l.created_at >= ?");
    params.push(filters.createdFrom);
  }
  if (filters?.createdTo) {
    where.push("l.created_at <= ?");
    params.push(filters.createdTo);
  }
  if (filters?.favorite !== undefined) {
    where.push("l.favorite = ?");
    params.push(filters.favorite ? 1 : 0);
  }
  if (filters?.pinned !== undefined) {
    where.push("l.pinned = ?");
    params.push(filters.pinned ? 1 : 0);
  }

  const sql = `
    SELECT
      l.*,
      u.email AS owner_email,
      COUNT(c.id) AS click_count
    FROM links l
    INNER JOIN users u ON u.id = l.owner_id
    LEFT JOIN click_events c ON c.link_id = l.id
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY l.id, u.email
    ORDER BY l.pinned DESC, l.favorite DESC, l.updated_at DESC
    ${query.limit ? "LIMIT ?" : ""}
  `;

  if (query.limit) {
    params.push(query.limit);
  }

  return { sql, params };
}

function mapLink(row: LinkRow): Link {
  return {
    id: row.id,
    ownerId: row.owner_id,
    alias: row.alias,
    destinationUrl: row.destination_url,
    destinationDomain: row.destination_domain || new URL(row.destination_url).hostname.toLowerCase(),
    title: row.title,
    tags: parseTags(row.tags_json),
    status: row.status,
    expiresAt: row.expires_at,
    redirectCode: row.redirect_code,
    passwordProtected: Boolean(row.password_hash),
    passwordUpdatedAt: row.password_updated_at,
    clickCount: row.click_count,
    clickLimit: row.click_limit,
    inactiveExpiresAfterMinutes: row.inactive_expires_after_minutes,
    lastClickedAt: row.last_clicked_at,
    countryAllowlist: parseCountries(row.country_allowlist_json),
    countryBlocklist: parseCountries(row.country_blocklist_json),
    favorite: row.favorite === 1,
    pinned: row.pinned === 1,
    safetyStatus: normalizeSafetyStatus(row.safety_status),
    safetyReason: row.safety_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAccessLink(row: LinkRow): LinkAccessRecord {
  return {
    ...mapLink(row),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordIterations: row.password_iterations
  };
}

function mapLinkSummary(row: LinkSummaryRow): LinkSummary {
  const status = row.status === "active" && row.expires_at !== null && Date.parse(row.expires_at) <= Date.now() ? "blocked" : row.status;
  return {
    ...mapLink(row),
    status,
    clickCount: row.click_count,
    ownerEmail: row.owner_email ?? undefined
  };
}

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseCountries(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.toUpperCase()) : [];
  } catch {
    return [];
  }
}

function normalizeSafetyStatus(value: string): "clean" | "suspect" | "blocked" {
  if (value === "suspect" || value === "blocked") {
    return value;
  }
  return "clean";
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function count(db: D1Database, query: string): Promise<number> {
  const row = await db.prepare(query).first<{ value: number }>();
  return row?.value ?? 0;
}
