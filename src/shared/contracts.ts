export type UserRole = "user" | "admin";
export type UserStatus = "active" | "blocked";
export type LinkStatus = "active" | "disabled" | "blocked";
export type OAuthProvider = "google" | "github";
export type AuditSeverity = "info" | "warning" | "critical";
export type LinkSafetyStatus = "clean" | "suspect" | "blocked";

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
  destinationDomain: string;
  title: string | null;
  tags: string[];
  status: LinkStatus;
  expiresAt: string | null;
  redirectCode: 301 | 302;
  passwordProtected: boolean;
  passwordUpdatedAt: string | null;
  clickCount: number;
  clickLimit: number | null;
  inactiveExpiresAfterMinutes: number | null;
  lastClickedAt: string | null;
  countryAllowlist: string[];
  countryBlocklist: string[];
  favorite: boolean;
  pinned: boolean;
  safetyStatus: LinkSafetyStatus;
  safetyReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkSummary extends Link {
  clickCount: number;
  ownerEmail?: string;
}

export interface CreateLinkInput {
  destinationUrl: string;
  alias?: string;
  title?: string;
  tags?: string[];
  expiresAt?: string | null;
  redirectCode?: 301 | 302;
  password?: string | null;
  clickLimit?: number | null;
  inactiveExpiresAfterMinutes?: number | null;
  countryAllowlist?: string[];
  countryBlocklist?: string[];
  favorite?: boolean;
  pinned?: boolean;
}

export interface UpdateLinkInput {
  destinationUrl?: string;
  title?: string | null;
  tags?: string[];
  status?: LinkStatus;
  expiresAt?: string | null;
  redirectCode?: 301 | 302;
  password?: string | null;
  clickLimit?: number | null;
  inactiveExpiresAfterMinutes?: number | null;
  countryAllowlist?: string[];
  countryBlocklist?: string[];
  favorite?: boolean;
  pinned?: boolean;
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

export interface LinkListFilters {
  status?: LinkStatus;
  search?: string;
  domain?: string;
  tag?: string;
  createdFrom?: string;
  createdTo?: string;
  favorite?: boolean;
  pinned?: boolean;
}

export interface BlockedDomainEntry {
  domain: string;
  reason: string;
  createdAt: string;
}

export interface PublicLinkResolution {
  kind: "redirect" | "password_required" | "blocked" | "not_found";
  alias?: string;
  title?: string | null;
  destinationUrl?: string;
  redirectCode?: 301 | 302;
  message?: string;
  safetyStatus?: LinkSafetyStatus;
  safetyReason?: string | null;
}

export interface LinkBulkActionInput {
  ids: string[];
  action: "activate" | "deactivate" | "delete";
}

export interface LinkExportInput {
  ids: string[];
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
