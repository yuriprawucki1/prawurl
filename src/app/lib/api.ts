import type { CreateLinkInput, LinkSummary, PlatformSummary, SessionUser, User, AuditLog } from "../../shared/contracts";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "https://api.prawurl.com";
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
    title: "Currículo",
    tags: ["portfolio"],
    status: "active",
    expiresAt: null,
    redirectCode: 302,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clickCount: 42
  }
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export const api = {
  session: () => mockOr(() => ({ session: { user: mockUser, expiresAt: new Date(Date.now() + 86400000).toISOString() } }), () => request<{ session: SessionUser | null }>("/auth/session")),
  createLink: (input: CreateLinkInput) => mockOr(() => createMockLink(input), () =>
    request<{ link: LinkSummary }>("/links", {
      method: "POST",
      body: JSON.stringify(input)
    })),
  links: () => mockOr(() => ({ links: mockLinks }), () => request<{ links: LinkSummary[] }>("/links")),
  resolvePublicAlias: (alias: string) => request<{ destinationUrl: string }>(`/public/resolve/${encodeURIComponent(alias)}`),
  logout: () => mockOr(() => ({ ok: true as const }), () => request<{ ok: true }>("/auth/logout", { method: "POST" })),
  adminSummary: () => mockOr(() => ({ summary: mockSummary() }), () => request<{ summary: PlatformSummary }>("/admin/summary")),
  adminUsers: () => mockOr(() => ({ users: [mockUser] }), () => request<{ users: User[] }>("/admin/users")),
  adminLinks: () => mockOr(() => ({ links: mockLinks }), () => request<{ links: LinkSummary[] }>("/admin/links")),
  auditLogs: () => mockOr(() => ({ logs: mockAuditLogs() }), () => request<{ logs: AuditLog[] }>("/admin/audit-logs"))
};

export const authUrl = (provider: "google" | "github") => `${apiOrigin}/auth/${provider}`;

async function mockOr<T>(mockValue: () => T, realRequest: () => Promise<T>): Promise<T> {
  return mockApi ? mockValue() : realRequest();
}

function createMockLink(input: CreateLinkInput): { link: LinkSummary } {
  const now = new Date().toISOString();
  const alias = input.alias || `dev-${mockLinks.length + 1}`;
  const link: LinkSummary = {
    id: crypto.randomUUID(),
    ownerId: mockUser.id,
    alias,
    destinationUrl: input.destinationUrl,
    title: input.title ?? null,
    tags: input.tags ?? [],
    status: "active",
    expiresAt: null,
    redirectCode: input.redirectCode ?? 302,
    createdAt: now,
    updatedAt: now,
    clickCount: 0
  };
  mockLinks.unshift(link);
  return { link };
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
