import type {
  AuditLog,
  Link,
  LinkStatus,
  LinkSummary,
  OAuthProvider,
  PlatformSummary,
  SessionUser,
  User,
  UserRole,
  UserStatus
} from "../shared/contracts";
import type {
  AliasRepository,
  AuditLogRepository,
  BlockedDomainRepository,
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
  title: string | null;
  status: LinkStatus;
  expires_at: string | null;
  redirect_code: 301 | 302;
  created_at: string;
  updated_at: string;
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

export class D1LinkRepository implements LinkRepository {
  constructor(private readonly db: D1Database) {}

  async create(ownerId: string, input: Parameters<LinkRepository["create"]>[1]): Promise<Link> {
    await this.db
      .prepare(
        `INSERT INTO links (id, owner_id, alias, destination_url, title, status, expires_at, redirect_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
      )
      .bind(input.id, ownerId, input.alias, input.destinationUrl, input.title || null, input.expiresAt, input.redirectCode, input.now, input.now)
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

  async listByOwner(ownerId: string): Promise<LinkSummary[]> {
    const result = await this.db
      .prepare(
        `SELECT l.*, COUNT(c.id) AS click_count
         FROM links l
         LEFT JOIN click_events c ON c.link_id = l.id
         WHERE l.owner_id = ?
         GROUP BY l.id
         ORDER BY l.created_at DESC`
      )
      .bind(ownerId)
      .all<LinkRow & { click_count: number }>();
    return (result.results ?? []).map((row) => ({ ...mapLink(row), clickCount: row.click_count }));
  }

  async listAll(): Promise<LinkSummary[]> {
    const result = await this.db
      .prepare(
        `SELECT l.*, COUNT(c.id) AS click_count
         FROM links l
         LEFT JOIN click_events c ON c.link_id = l.id
         GROUP BY l.id
         ORDER BY l.created_at DESC
         LIMIT 500`
      )
      .all<LinkRow & { click_count: number }>();
    return (result.results ?? []).map((row) => ({ ...mapLink(row), clickCount: row.click_count }));
  }

  async update(id: string, ownerId: string | null, input: Parameters<LinkRepository["update"]>[2], now: string): Promise<Link | null> {
    const current = await this.findById(id);
    if (!current || (ownerId && current.ownerId !== ownerId)) {
      return null;
    }

    const next = {
      destinationUrl: input.destinationUrl ?? current.destinationUrl,
      title: input.title === undefined ? current.title : input.title,
      status: input.status ?? current.status,
      expiresAt: input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
      redirectCode: input.redirectCode ?? current.redirectCode
    };

    await this.db
      .prepare(
        `UPDATE links
         SET destination_url = ?, title = ?, status = ?, expires_at = ?, redirect_code = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(next.destinationUrl, next.title, next.status, next.expiresAt, next.redirectCode, now, id)
      .run();

    return this.findById(id);
  }

  async delete(id: string, ownerId: string | null): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing || (ownerId && existing.ownerId !== ownerId)) {
      return false;
    }
    await this.db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
    return true;
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
      count(this.db, "SELECT COUNT(*) AS value FROM links WHERE status = 'active'"),
      count(this.db, "SELECT COUNT(*) AS value FROM click_events"),
      count(this.db, "SELECT COUNT(*) AS value FROM audit_logs")
    ]);
    return { users, activeUsers, links, activeLinks, clicks, auditEvents };
  }
}

export async function insertClickEvent(db: D1Database, event: {
  linkId: string | null;
  alias: string;
  occurredAt: string;
  country: string | null;
  region: string | null;
  referrer: string | null;
  userAgent: string | null;
  ipHash: string | null;
}): Promise<void> {
  await db
    .prepare(
      `INSERT INTO click_events (id, link_id, alias, occurred_at, country, region, referrer, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), event.linkId, event.alias, event.occurredAt, event.country, event.region, event.referrer, event.userAgent, event.ipHash)
    .run();
}

function mapLink(row: LinkRow): Link {
  return {
    id: row.id,
    ownerId: row.owner_id,
    alias: row.alias,
    destinationUrl: row.destination_url,
    title: row.title,
    status: row.status,
    expiresAt: row.expires_at,
    redirectCode: row.redirect_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
