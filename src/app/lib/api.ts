import type {
  AuditLog,
  BlockedDomainEntry,
  CreateLinkInput,
  Link,
  LinkBulkActionInput,
  LinkExportInput,
  LinkListFilters,
  LinkSummary,
  PlatformSummary,
  PublicLinkResolution,
  SessionUser,
  User
} from "../../shared/contracts";
import { resolveOrigins } from "./origins";

const { apiOrigin } = resolveOrigins();
const mockApi = import.meta.env.VITE_MOCK_API === "true";

const mockUser: User = {
  id: "dev-user",
  email: "dev@prawurl.local",
  name: "Dev PrawURL",
  avatarUrl: null,
  role: "admin",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockLinks: LinkSummary[] = [
  {
    id: "dev-link-1",
    ownerId: mockUser.id,
    alias: "cv",
    destinationUrl: "https://cv.yuriprawucki1.workers.dev/",
    destinationDomain: "cv.yuriprawucki1.workers.dev",
    title: "Currículo",
    tags: ["portfolio"],
    status: "active",
    expiresAt: null,
    redirectCode: 302,
    passwordProtected: true,
    passwordUpdatedAt: new Date().toISOString(),
    clickCount: 42,
    clickLimit: null,
    inactiveExpiresAfterMinutes: null,
    lastClickedAt: null,
    countryAllowlist: ["BR", "US"],
    countryBlocklist: ["AR"],
    favorite: true,
    pinned: true,
    safetyStatus: "clean",
    safetyReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerEmail: mockUser.email
  }
];

const mockBlockedDomains: BlockedDomainEntry[] = [
  {
    domain: "bad.test",
    reason: "manual block",
    createdAt: new Date().toISOString()
  }
];

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...init?.headers
      }
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Verifique sua conexão e tente novamente.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "REQUEST_FAILED" }));
    throw new Error(errorLabel(body.error));
  }

  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...init?.headers
      }
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Verifique sua conexão e tente novamente.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "REQUEST_FAILED");
    throw new Error(body || "REQUEST_FAILED");
  }

  return response.text();
}

function withQuery(path: string, filters?: LinkListFilters): string {
  if (!filters) {
    return path;
  }

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.createdFrom) params.set("from", filters.createdFrom);
  if (filters.createdTo) params.set("to", filters.createdTo);
  if (filters.favorite !== undefined) params.set("favorite", String(filters.favorite));
  if (filters.pinned !== undefined) params.set("pinned", String(filters.pinned));

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  session: () => mockOr(() => ({ session: { user: mockUser, expiresAt: new Date(Date.now() + 86400000).toISOString() } }), () => requestJson<{ session: SessionUser | null }>("/auth/session")),
  createLink: (input: CreateLinkInput) =>
    mockOr(() => createMockLink(input), () =>
      requestJson<{ link: Link }>("/links", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  updateLink: (id: string, input: Partial<CreateLinkInput> & { status?: "active" | "disabled" | "blocked" }) =>
    mockOr(() => updateMockLink(id, input), () =>
      requestJson<{ link: Link }>(`/links/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      })),
  deleteLink: (id: string) =>
    mockOr(() => ({ ok: true as const }), () =>
      requestJson<{ ok: true }>(`/links/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })),
  bulkLinks: (input: LinkBulkActionInput) =>
    mockOr(() => bulkMockLinks(input), () =>
      requestJson<{ result: { affected: number } }>("/links/bulk", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  exportLinks: (input: LinkExportInput) =>
    mockOr(() => mockExportCsv(input.ids), () =>
      requestText("/links/export", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  links: (filters?: LinkListFilters) => mockOr(() => ({ links: filterMockLinks(filters) }), () => requestJson<{ links: LinkSummary[] }>(withQuery("/links", filters))),
  resolvePublicAlias: (alias: string) => requestJson<PublicLinkResolution>(`/public/resolve/${encodeURIComponent(alias)}`),
  unlockPublicAlias: (alias: string, password: string) =>
    requestJson<PublicLinkResolution>(`/public/resolve/${encodeURIComponent(alias)}/unlock`, {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  logout: () => mockOr(() => ({ ok: true as const }), () => requestJson<{ ok: true }>("/auth/logout", { method: "POST" })),
  adminSummary: () => mockOr(() => ({ summary: mockSummary() }), () => requestJson<{ summary: PlatformSummary }>("/admin/summary")),
  adminUsers: () => mockOr(() => ({ users: [mockUser] }), () => requestJson<{ users: User[] }>("/admin/users")),
  adminLinks: (filters?: LinkListFilters) => mockOr(() => ({ links: filterMockLinks(filters) }), () => requestJson<{ links: LinkSummary[] }>(withQuery("/admin/links", filters))),
  adminBulkLinks: (input: LinkBulkActionInput) =>
    mockOr(() => bulkMockLinks(input), () =>
      requestJson<{ result: { affected: number } }>("/admin/links/bulk", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  adminExportLinks: (input: LinkExportInput) =>
    mockOr(() => mockExportCsv(input.ids), () =>
      requestText("/admin/links/export", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  adminAuditLogs: () => mockOr(() => ({ logs: mockAuditLogs() }), () => requestJson<{ logs: AuditLog[] }>("/admin/audit-logs")),
  adminBlockedDomains: () => mockOr(() => ({ domains: mockBlockedDomains }), () => requestJson<{ domains: BlockedDomainEntry[] }>("/admin/blocked-domains")),
  addBlockedDomain: (input: BlockedDomainEntry) =>
    mockOr(() => {
      mockBlockedDomains.unshift(input);
      return { domain: input };
    }, () =>
      requestJson<{ domain: BlockedDomainEntry }>("/admin/blocked-domains", {
        method: "POST",
        body: JSON.stringify(input)
      })),
  removeBlockedDomain: (domain: string) =>
    mockOr(() => {
      const index = mockBlockedDomains.findIndex((entry) => entry.domain === domain);
      if (index >= 0) {
        mockBlockedDomains.splice(index, 1);
      }
      return { ok: true as const };
    }, () =>
      requestJson<{ ok: true }>(`/admin/blocked-domains/${encodeURIComponent(domain)}`, {
        method: "DELETE"
      }))
};

export const authUrl = (provider: "google" | "github") => `${apiOrigin}/auth/${provider}`;

async function mockOr<T>(mockValue: () => T, realRequest: () => Promise<T>): Promise<T> {
  return mockApi ? mockValue() : realRequest();
}

function createMockLink(input: CreateLinkInput): { link: Link } {
  const now = new Date().toISOString();
  const alias = input.alias || `dev-${mockLinks.length + 1}`;
  const link: Link = {
    id: crypto.randomUUID(),
    ownerId: mockUser.id,
    alias,
    destinationUrl: input.destinationUrl,
    destinationDomain: new URL(input.destinationUrl).hostname,
    title: input.title ?? null,
    tags: input.tags ?? [],
    status: "active",
    expiresAt: input.expiresAt ?? null,
    redirectCode: input.redirectCode ?? 302,
    passwordProtected: Boolean(input.password),
    passwordUpdatedAt: input.password ? now : null,
    clickCount: 0,
    clickLimit: input.clickLimit ?? null,
    inactiveExpiresAfterMinutes: input.inactiveExpiresAfterMinutes ?? null,
    lastClickedAt: null,
    countryAllowlist: input.countryAllowlist ?? [],
    countryBlocklist: input.countryBlocklist ?? [],
    favorite: input.favorite ?? false,
    pinned: input.pinned ?? false,
    safetyStatus: "clean",
    safetyReason: null,
    createdAt: now,
    updatedAt: now
  };
  mockLinks.unshift({ ...link, ownerEmail: mockUser.email });
  return { link };
}

function updateMockLink(id: string, input: Partial<CreateLinkInput> & { status?: "active" | "disabled" | "blocked" }): { link: Link } {
  const current = mockLinks.find((link) => link.id === id);
  if (!current) {
    throw new Error("LINK_NOT_FOUND");
  }

  const next: LinkSummary = {
    ...current,
    destinationUrl: input.destinationUrl ?? current.destinationUrl,
    destinationDomain: input.destinationUrl ? new URL(input.destinationUrl).hostname : current.destinationDomain,
    title: input.title === undefined ? current.title : input.title,
    tags: input.tags ?? current.tags,
    status: input.status ?? current.status,
    expiresAt: input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
    redirectCode: input.redirectCode ?? current.redirectCode,
    passwordProtected: input.password === undefined ? current.passwordProtected : Boolean(input.password),
    passwordUpdatedAt: input.password === undefined ? current.passwordUpdatedAt : new Date().toISOString(),
    clickLimit: input.clickLimit === undefined ? current.clickLimit : input.clickLimit,
    inactiveExpiresAfterMinutes: input.inactiveExpiresAfterMinutes === undefined ? current.inactiveExpiresAfterMinutes : input.inactiveExpiresAfterMinutes,
    countryAllowlist: input.countryAllowlist ?? current.countryAllowlist,
    countryBlocklist: input.countryBlocklist ?? current.countryBlocklist,
    favorite: input.favorite === undefined ? current.favorite : input.favorite,
    pinned: input.pinned === undefined ? current.pinned : input.pinned,
    safetyStatus: current.safetyStatus,
    safetyReason: current.safetyReason,
    updatedAt: new Date().toISOString(),
    ownerEmail: current.ownerEmail
  };

  Object.assign(current, next);
  return { link: current };
}

function bulkMockLinks(input: LinkBulkActionInput): { result: { affected: number } } {
  if (input.action === "delete") {
    input.ids.forEach((id) => {
      const index = mockLinks.findIndex((link) => link.id === id);
      if (index >= 0) {
        mockLinks.splice(index, 1);
      }
    });
    return { result: { affected: input.ids.length } };
  }

  const status = input.action === "activate" ? "active" : "disabled";
  mockLinks.forEach((link) => {
    if (input.ids.includes(link.id)) {
      link.status = status;
    }
  });
  return { result: { affected: input.ids.length } };
}

function filterMockLinks(filters?: LinkListFilters): LinkSummary[] {
  return mockLinks.filter((link) => {
    if (!filters) {
      return true;
    }
    if (filters.status && link.status !== filters.status) {
      return false;
    }
    if (filters.favorite !== undefined && link.favorite !== filters.favorite) {
      return false;
    }
    if (filters.pinned !== undefined && link.pinned !== filters.pinned) {
      return false;
    }
    if (filters.domain && !link.destinationDomain.includes(filters.domain.toLowerCase())) {
      return false;
    }
    if (filters.tag && !link.tags.some((tag) => tag.toLowerCase() === filters.tag?.toLowerCase())) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!link.alias.toLowerCase().includes(q) && !link.destinationUrl.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function mockExportCsv(ids: string[]): string {
  const rows = mockLinks.filter((link) => ids.includes(link.id));
  return ["id,alias,destinationUrl", ...rows.map((link) => `${link.id},${link.alias},${link.destinationUrl}`)].join("\n");
}

function mockSummary(): PlatformSummary {
  return {
    users: 1,
    activeUsers: 1,
    links: mockLinks.length,
    activeLinks: mockLinks.filter((link) => link.status === "active").length,
    clicks: mockLinks.reduce((sum, link) => sum + link.clickCount, 0),
    auditEvents: 2
  };
}

function mockAuditLogs(): AuditLog[] {
  return [
    {
      id: "dev-audit-1",
      actorUserId: mockUser.id,
      action: "link.create",
      entityType: "link",
      entityId: mockLinks[0]?.id ?? null,
      severity: "info",
      metadata: {},
      occurredAt: new Date().toISOString()
    }
  ];
}

function errorLabel(error: unknown): string {
  const code = String(error);
  if (code.includes("String must contain at least") || code.includes("caracter")) {
    return "O alias precisa ter pelo menos 2 caracteres.";
  }
  const labels: Record<string, string> = {
    ALIAS_TAKEN: "Esse alias já está em uso.",
    ALIAS_RESERVED: "Esse alias é reservado.",
    DESTINATION_BLOCKED: "Esse domínio está bloqueado.",
    DESTINATION_SELF_REFERENTIAL: "Use uma URL de destino fora do PrawURL.",
    UNAUTHENTICATED: "Sua sessão expirou. Entre novamente."
  };
  return labels[code] ?? code;
}
