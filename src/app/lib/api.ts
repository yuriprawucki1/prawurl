import type { CreateLinkInput, LinkSummary, PlatformSummary, SessionUser, User, AuditLog } from "../../shared/contracts";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "https://api.prawurl.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error((await response.json().catch(() => ({ error: "REQUEST_FAILED" }))).error);
  }

  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{ session: SessionUser | null }>("/auth/session"),
  createLink: (input: CreateLinkInput) => request<{ link: LinkSummary }>("/links", { method: "POST", body: JSON.stringify(input) }),
  links: () => request<{ links: LinkSummary[] }>("/links"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  adminSummary: () => request<{ summary: PlatformSummary }>("/admin/summary"),
  adminUsers: () => request<{ users: User[] }>("/admin/users"),
  adminLinks: () => request<{ links: LinkSummary[] }>("/admin/links"),
  auditLogs: () => request<{ logs: AuditLog[] }>("/admin/audit-logs")
};

export const authUrl = (provider: "google" | "github") => `${apiOrigin}/auth/${provider}`;
