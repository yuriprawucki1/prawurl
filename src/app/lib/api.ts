import type { CreateLinkInput, LinkSummary, PlatformSummary, SessionUser, User, AuditLog } from "../../shared/contracts";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "https://api.prawurl.com";

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
  session: () => request<{ session: SessionUser | null }>("/auth/session"),
  createLink: (input: CreateLinkInput) =>
    request<{ link: LinkSummary }>("/links", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  links: () => request<{ links: LinkSummary[] }>("/links"),
  resolvePublicAlias: (alias: string) => request<{ destinationUrl: string }>(`/public/resolve/${encodeURIComponent(alias)}`),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  adminSummary: () => request<{ summary: PlatformSummary }>("/admin/summary"),
  adminUsers: () => request<{ users: User[] }>("/admin/users"),
  adminLinks: () => request<{ links: LinkSummary[] }>("/admin/links"),
  auditLogs: () => request<{ logs: AuditLog[] }>("/admin/audit-logs")
};

export const authUrl = (provider: "google" | "github") => `${apiOrigin}/auth/${provider}`;

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
