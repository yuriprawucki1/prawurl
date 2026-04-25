export type UserRole = "user" | "admin";
export type UserStatus = "active" | "blocked";
export type LinkStatus = "active" | "disabled" | "blocked";
export type OAuthProvider = "google" | "github";
export type AuditSeverity = "info" | "warning" | "critical";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  id: string;
  ownerId: string;
  alias: string;
  destinationUrl: string;
  title: string | null;
  tags: string[];
  status: LinkStatus;
  expiresAt: string | null;
  redirectCode: 301 | 302;
  createdAt: string;
  updatedAt: string;
}

export interface LinkSummary extends Link {
  clickCount: number;
}

export interface CreateLinkInput {
  destinationUrl: string;
  alias?: string;
  title?: string;
  tags?: string[];
  expiresAt?: string | null;
  redirectCode?: 301 | 302;
}

export interface UpdateLinkInput {
  destinationUrl?: string;
  title?: string | null;
  status?: LinkStatus;
  expiresAt?: string | null;
  redirectCode?: 301 | 302;
}

export interface SessionUser {
  user: User;
  expiresAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  severity: AuditSeverity;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface PlatformSummary {
  users: number;
  activeUsers: number;
  links: number;
  activeLinks: number;
  clicks: number;
  auditEvents: number;
}

export interface RedirectCacheEntry {
  id: string;
  alias: string;
  destinationUrl: string;
  status: LinkStatus;
  expiresAt: string | null;
  redirectCode: 301 | 302;
}

export type AppEvent =
  | {
      type: "click";
      linkId: string | null;
      alias: string;
      occurredAt: string;
      country: string | null;
      region: string | null;
      referrer: string | null;
      userAgent: string | null;
      ipHash: string | null;
    }
  | {
      type: "audit";
      actorUserId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      severity: AuditSeverity;
      metadata: Record<string, unknown>;
      occurredAt: string;
    };
