import type {
  AppEvent,
  AuditLog,
  AuditSeverity,
  CreateLinkInput,
  Link,
  LinkSummary,
  OAuthProvider,
  PlatformSummary,
  RedirectCacheEntry,
  SessionUser,
  UpdateLinkInput,
  User
} from "../shared/contracts";

export interface LinkRepository {
  create(ownerId: string, input: CreateLinkInput & { alias: string; id: string; now: string; destinationUrl: string; redirectCode: 301 | 302 }): Promise<Link>;
  findByAlias(alias: string): Promise<Link | null>;
  findById(id: string): Promise<Link | null>;
  listByOwner(ownerId: string): Promise<LinkSummary[]>;
  listAll(): Promise<LinkSummary[]>;
  update(id: string, ownerId: string | null, input: UpdateLinkInput, now: string): Promise<Link | null>;
  delete(id: string, ownerId: string | null): Promise<boolean>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listAll(): Promise<User[]>;
  upsertOAuthUser(input: {
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    bootstrapAdminEmail: string | null;
    now: string;
  }): Promise<User>;
  updateStatus(id: string, status: "active" | "blocked", now: string): Promise<User | null>;
  updateRole(id: string, role: "user" | "admin", now: string): Promise<User | null>;
}

export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: string, now: string): Promise<void>;
  findByTokenHash(tokenHash: string, now: string): Promise<SessionUser | null>;
  revoke(tokenHash: string, now: string): Promise<void>;
}

export interface RedirectCache {
  get(alias: string): Promise<RedirectCacheEntry | null>;
  put(entry: RedirectCacheEntry): Promise<void>;
  delete(alias: string): Promise<void>;
}

export interface AliasRepository {
  isReserved(alias: string): Promise<boolean>;
}

export interface BlockedDomainRepository {
  isBlocked(hostname: string): Promise<boolean>;
}

export interface AuditLogRepository {
  insert(input: {
    id: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    severity: AuditSeverity;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }): Promise<void>;
  listRecent(limit: number): Promise<AuditLog[]>;
}

export interface MetricsRepository {
  summary(): Promise<PlatformSummary>;
}

export interface EventPublisher {
  publish(event: AppEvent): Promise<void>;
}
