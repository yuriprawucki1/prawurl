import type { Link, User } from "../../src/shared/contracts";

export const now = "2026-10-02T12:00:00.000Z";
export const user: User = {
  id: "test-owner", email: "owner@example.test", name: "Test Owner", avatarUrl: null,
  role: "user", status: "active", createdAt: now, updatedAt: now
};

export function link(overrides: Partial<Link> = {}): Link {
  return {
    id: "test-link", ownerId: user.id, alias: "sample", destinationUrl: "https://example.com/first",
    destinationDomain: "example.com", title: "Sample", tags: [], status: "active", expiresAt: null,
    redirectCode: 302, passwordProtected: false, passwordUpdatedAt: null, clickCount: 0,
    clickLimit: null, inactiveExpiresAfterMinutes: null, lastClickedAt: null,
    countryAllowlist: [], countryBlocklist: [], favorite: false, pinned: false,
    safetyStatus: "clean", safetyReason: null, createdAt: "2026-10-02T11:00:00.000Z", updatedAt: now,
    ...overrides
  };
}
