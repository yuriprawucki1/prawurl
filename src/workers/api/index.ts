import { LinkService } from "../../application/link-service";
import { RedirectService } from "../../application/redirect-service";
import { AdminPolicy } from "../../domain/admin-policy";
import { AliasPolicy } from "../../domain/alias-policy";
import { UrlPolicy } from "../../domain/url-policy";
import {
  D1AliasRepository,
  D1AuditLogRepository,
  D1BlockedDomainRepository,
  D1LinkRepository,
  D1MetricsRepository,
  D1SessionRepository,
  D1UserRepository,
  insertClickEvent
} from "../../infrastructure/d1-repositories";
import { sha256Hex, randomToken } from "../../infrastructure/crypto";
import { KvRedirectCache } from "../../infrastructure/kv-redirect-cache";
import { authorizationUrl, exchangeOAuthCode } from "../../infrastructure/oauth";
import { buildUnlockCookieName } from "../../infrastructure/link-security";
import type {
  AppEvent,
  BlockedDomainEntry,
  LinkBulkActionInput,
  LinkExportInput,
  LinkListFilters,
  OAuthProvider,
  SessionUser,
  UserRole,
  UserStatus
} from "../../shared/contracts";
import { blockedDomainInputSchema, bulkLinkActionSchema, exportLinkSchema, isReservedPath, normalizeAlias } from "../../shared/validation";
import { ZodError } from "zod";

interface Env {
  DB: D1Database;
  PRAWURL_LINKS: KVNamespace;
  EVENTS: Queue<AppEvent>;
  APP_ORIGIN: string;
  PUBLIC_ORIGIN: string;
  BOOTSTRAP_ADMIN_EMAIL: string;
  SESSION_COOKIE_NAME: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

const providers = new Set(["google", "github"]);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env, request);
    }

    try {
      const response = await handleRequest(request, env, ctx);
      return withCors(response, env, request);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "api.request_failed", error: errorMessage(error) }));
      return withCors(json({ error: errorMessage(error) }, statusForError(error)), env, request);
    }
  },

  async queue(batch: MessageBatch<AppEvent>, env: Env): Promise<void> {
    const auditLogs = new D1AuditLogRepository(env.DB);

    for (const message of batch.messages) {
      const event = message.body;
      if (event.type === "click") {
        await insertClickEvent(env.DB, event);
      } else {
        await auditLogs.insert({
          id: crypto.randomUUID(),
          actorUserId: event.actorUserId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          severity: event.severity,
          metadata: event.metadata,
          occurredAt: event.occurredAt
        });
      }
      message.ack();
    }
  }
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = trimPath(url.pathname);
  const services = makeServices(env);

  if (path === "health") {
    if (request.headers.get("accept")?.includes("text/html")) {
      return new Response(statusHtml(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return json({ ok: true, service: "prawurl-api", checkedAt: new Date().toISOString() });
  }

  const now = new Date().toISOString();
  const publicResolve = path.match(/^public\/resolve\/(.+)$/);
  if (publicResolve && request.method === "GET") {
    const alias = normalizeAlias(decodeURIComponent(publicResolve[1]).replace(/^\/+|\/+$/g, ""));
    return json(
      await resolvePublicAlias(request, env, services.redirectService, alias, now)
    );
  }

  const publicUnlock = path.match(/^public\/resolve\/(.+)\/unlock$/);
  if (publicUnlock && request.method === "POST") {
    const alias = normalizeAlias(decodeURIComponent(publicUnlock[1]).replace(/^\/+|\/+$/g, ""));
    const body = (await request.json()) as { password?: string };
    if (!body.password) {
      throw new Error("PASSWORD_REQUIRED");
    }

    const result = await services.redirectService.unlock(alias, body.password, publicContext(request, now));
    if (result.kind === "redirect") {
      ctx.waitUntil(
        insertClickEvent(env.DB, {
          linkId: result.linkId ?? null,
          alias: result.alias ?? alias,
          occurredAt: now,
          country: request.cf?.country?.toString() ?? null,
          region: request.cf?.region?.toString() ?? null,
          referrer: request.headers.get("referer"),
          userAgent: summarizeUserAgent(request.headers.get("user-agent")),
          ipHash: null
        })
      );
    }

    return json(result, 200, result.setCookie ? { "set-cookie": result.setCookie } : undefined);
  }

  if (path === "auth/session") {
    const session = await readSession(request, env, services);
    return json({ session });
  }

  if (path === "auth/logout" && request.method === "POST") {
    const token = cookieValue(request, env.SESSION_COOKIE_NAME);
    if (token) {
      await services.sessions.revoke(await sha256Hex(`${env.SESSION_SECRET}:${token}`), now);
    }
    return json({ ok: true }, 200, clearSessionCookie(env));
  }

  const authStart = path.match(/^auth\/(google|github)$/);
  if (authStart && request.method === "GET") {
    const provider = authStart[1] as OAuthProvider;
    const state = randomToken();
    const location = authorizationUrl(provider, oauthConfig(env, request), state);
    return redirect(location, 302, stateCookie(state, env));
  }

  const authCallback = path.match(/^auth\/(google|github)\/callback$/);
  if (authCallback && request.method === "GET") {
    const provider = authCallback[1] as OAuthProvider;
    assertProvider(provider);
    assertState(request, url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("OAUTH_CODE_MISSING");
    }

    const profile = await exchangeOAuthCode(provider, code, oauthConfig(env, request));
    const user = await services.users.upsertOAuthUser({
      provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      bootstrapAdminEmail: env.BOOTSTRAP_ADMIN_EMAIL || null,
      now
    });

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await services.sessions.create(user.id, await sha256Hex(`${env.SESSION_SECRET}:${token}`), expiresAt, now);
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      severity: "info",
      metadata: { provider },
      occurredAt: now
    });

    return redirect(`${env.APP_ORIGIN}/app`, 302, sessionCookie(token, env));
  }

  const session = await requireSession(request, env, services);
  services.adminPolicy.assertActive(session.user);

  if (path === "links" && request.method === "GET") {
    return json({ links: await services.linkService.listForUser(session.user, readLinkFilters(url)) });
  }

  if (path === "links" && request.method === "POST") {
    const link = await services.linkService.create(session.user, await request.json());
    return json({ link }, 201);
  }

  if (path === "links/bulk" && request.method === "POST") {
    const body = bulkLinkActionSchema.parse(await request.json()) satisfies LinkBulkActionInput;
    return json({ result: await services.linkService.bulkAction(session.user, body) });
  }

  if (path === "links/export" && request.method === "POST") {
    const body = exportLinkSchema.parse(await request.json()) satisfies LinkExportInput;
    const links = await services.linkService.exportSelected(session.user, body);
    return csvResponse(renderLinksCsv(links));
  }

  const linkMatch = path.match(/^links\/([^/]+)$/);
  if (linkMatch && request.method === "PATCH") {
    return json({ link: await services.linkService.update(session.user, linkMatch[1], await request.json()) });
  }

  if (linkMatch && request.method === "DELETE") {
    await services.linkService.delete(session.user, linkMatch[1]);
    return json({ ok: true });
  }

  if (path.startsWith("admin/")) {
    services.adminPolicy.assertAdmin(session.user);
    return handleAdmin(path, request, services, session.user.id);
  }

  ctx.waitUntil(
    services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: session.user.id,
      action: "api.not_found",
      entityType: "request",
      entityId: null,
      severity: "warning",
      metadata: { path, method: request.method },
      occurredAt: now
    })
  );
  return json({ error: "NOT_FOUND" }, 404);
}

async function handleAdmin(path: string, request: Request, services: ReturnType<typeof makeServices>, actorUserId: string): Promise<Response> {
  const now = new Date().toISOString();
  const actor = await services.users.findById(actorUserId);
  if (!actor) {
    throw new Error("UNAUTHENTICATED");
  }

  if (path === "admin/summary" && request.method === "GET") {
    return json({ summary: await services.metrics.summary() });
  }

  if (path === "admin/users" && request.method === "GET") {
    return json({ users: await services.users.listAll() });
  }

  if (path === "admin/links" && request.method === "GET") {
    return json({ links: await services.linkService.listAll(readLinkFilters(new URL(request.url))) });
  }

  if (path === "admin/links/bulk" && request.method === "POST") {
    const body = bulkLinkActionSchema.parse(await request.json()) satisfies LinkBulkActionInput;
    return json({ result: await services.linkService.bulkAction(actor, body, true) });
  }

  if (path === "admin/links/export" && request.method === "POST") {
    const body = exportLinkSchema.parse(await request.json()) satisfies LinkExportInput;
    const links = await services.linkService.exportSelected(actor, body, true);
    return csvResponse(renderLinksCsv(links));
  }

  const userStatus = path.match(/^admin\/users\/([^/]+)\/status$/);
  if (userStatus && request.method === "PATCH") {
    const body = (await request.json()) as { status?: UserStatus };
    if (body.status !== "active" && body.status !== "blocked") {
      throw new Error("INVALID_STATUS");
    }
    const user = await services.users.updateStatus(userStatus[1], body.status, now);
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.user_status.update",
      entityType: "user",
      entityId: userStatus[1],
      severity: "warning",
      metadata: { status: body.status },
      occurredAt: now
    });
    return json({ user });
  }

  const userRole = path.match(/^admin\/users\/([^/]+)\/role$/);
  if (userRole && request.method === "PATCH") {
    const body = (await request.json()) as { role?: UserRole };
    if (body.role !== "user" && body.role !== "admin") {
      throw new Error("INVALID_ROLE");
    }
    const user = await services.users.updateRole(userRole[1], body.role, now);
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.user_role.update",
      entityType: "user",
      entityId: userRole[1],
      severity: "critical",
      metadata: { role: body.role },
      occurredAt: now
    });
    return json({ user });
  }

  if (path === "admin/audit-logs" && request.method === "GET") {
    return json({ logs: await services.auditLogs.listRecent(200) });
  }

  if (path === "admin/blocked-domains" && request.method === "GET") {
    return json({ domains: await services.blockedDomains.list() });
  }

  if (path === "admin/blocked-domains" && request.method === "POST") {
    const body = blockedDomainInputSchema.parse(await request.json());
    const entry: BlockedDomainEntry = {
      domain: body.domain,
      reason: body.reason,
      createdAt: now
    };
    await services.blockedDomains.add(entry);
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.blocked_domain.add",
      entityType: "blocked_domain",
      entityId: entry.domain,
      severity: "critical",
      metadata: { reason: entry.reason },
      occurredAt: now
    });
    return json({ domain: entry }, 201);
  }

  const blockedDomain = path.match(/^admin\/blocked-domains\/(.+)$/);
  if (blockedDomain && request.method === "DELETE") {
    const domain = decodeURIComponent(blockedDomain[1]);
    const removed = await services.blockedDomains.remove(domain);
    if (!removed) {
      return json({ error: "NOT_FOUND" }, 404);
    }
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.blocked_domain.remove",
      entityType: "blocked_domain",
      entityId: domain,
      severity: "warning",
      metadata: {},
      occurredAt: now
    });
    return json({ ok: true });
  }

  return json({ error: "NOT_FOUND" }, 404);
}

function makeServices(env: Env) {
  const links = new D1LinkRepository(env.DB);
  const users = new D1UserRepository(env.DB);
  const sessions = new D1SessionRepository(env.DB);
  const auditLogs = new D1AuditLogRepository(env.DB);
  const aliases = new D1AliasRepository(env.DB);
  const blockedDomains = new D1BlockedDomainRepository(env.DB);
  const cache = new KvRedirectCache(env.PRAWURL_LINKS);
  const linkService = new LinkService(links, cache, new AliasPolicy(aliases), new UrlPolicy(blockedDomains), auditLogs);
  const redirectService = new RedirectService(links, cache, env.SESSION_SECRET, cookieDomainFromOrigin(env.PUBLIC_ORIGIN));

  return {
    users,
    links,
    sessions,
    auditLogs,
    metrics: new D1MetricsRepository(env.DB),
    blockedDomains,
    linkService,
    redirectService,
    adminPolicy: new AdminPolicy()
  };
}

async function resolvePublicAlias(request: Request, env: Env, redirectService: RedirectService, alias: string, now: string) {
  const unlockToken = cookieValue(request, buildUnlockCookieName(alias));
  const result = await redirectService.resolve(alias, publicContext(request, now, unlockToken));
  return publicResolution(result);
}

async function readSession(request: Request, env: Env, services: ReturnType<typeof makeServices>): Promise<SessionUser | null> {
  const token = cookieValue(request, env.SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  return services.sessions.findByTokenHash(await sha256Hex(`${env.SESSION_SECRET}:${token}`), new Date().toISOString());
}

async function requireSession(request: Request, env: Env, services: ReturnType<typeof makeServices>): Promise<SessionUser> {
  const session = await readSession(request, env, services);
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

function publicContext(request: Request, now: string, unlockToken: string | null = null) {
  return {
    country: request.cf?.country?.toString() ?? null,
    unlockToken,
    now
  };
}

function cookieDomainFromOrigin(origin: string): string | null {
  const hostname = new URL(origin).hostname;
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length < 2) {
    return null;
  }

  return `.${parts.slice(-2).join(".")}`;
}

function publicResolution(result: Awaited<ReturnType<RedirectService["resolve"]>>) {
  if (result.kind === "redirect") {
    return {
      kind: "redirect" as const,
      destinationUrl: result.destinationUrl,
      redirectCode: result.redirectCode,
      alias: result.alias
    };
  }

  if (result.kind === "password_required") {
    return {
      kind: "password_required" as const,
      alias: result.alias,
      message: result.message ?? "Senha obrigatória."
    };
  }

  if (result.kind === "blocked") {
    return {
      kind: "blocked" as const,
      alias: result.alias,
      message: result.message ?? "Esse link não está disponível."
    };
  }

  return {
    kind: "not_found" as const,
    alias: result.alias
  };
}

function readLinkFilters(url: URL): LinkListFilters {
  return {
    status: parseStatus(url.searchParams.get("status")),
    search: url.searchParams.get("search") ?? undefined,
    domain: url.searchParams.get("domain") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    createdFrom: url.searchParams.get("from") ?? undefined,
    createdTo: url.searchParams.get("to") ?? undefined,
    favorite: parseBoolean(url.searchParams.get("favorite")),
    pinned: parseBoolean(url.searchParams.get("pinned"))
  };
}

function parseStatus(value: string | null): LinkListFilters["status"] {
  if (value === "active" || value === "disabled" || value === "blocked") {
    return value;
  }
  return undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  if (["1", "true", "yes"].includes(value.toLowerCase())) {
    return true;
  }
  if (["0", "false", "no"].includes(value.toLowerCase())) {
    return false;
  }
  return undefined;
}

function renderLinksCsv(links: Awaited<ReturnType<LinkService["exportSelected"]>>): string {
  const header = [
    "id",
    "alias",
    "destinationUrl",
    "destinationDomain",
    "title",
    "status",
    "clickCount",
    "favorite",
    "pinned",
    "tags",
    "createdAt",
    "updatedAt"
  ];

  const rows = links.map((link) => [
    link.id,
    link.alias,
    link.destinationUrl,
    link.destinationDomain,
    link.title ?? "",
    link.status,
    String(link.clickCount),
    String(link.favorite),
    String(link.pinned),
    link.tags.join("|"),
    link.createdAt,
    link.updatedAt
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvResponse(csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="prawurl-links-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}

function oauthConfig(env: Env, request: Request) {
  return {
    appOrigin: env.APP_ORIGIN,
    apiOrigin: new URL(request.url).origin,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET
  };
}

function assertProvider(provider: string): asserts provider is OAuthProvider {
  if (!providers.has(provider)) {
    throw new Error("UNKNOWN_PROVIDER");
  }
}

function assertState(request: Request, state: string | null): void {
  const expected = cookieValue(request, "prawurl_oauth_state");
  if (!state || !expected || state !== expected) {
    throw new Error("OAUTH_STATE_INVALID");
  }
}

function trimPath(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "");
}

function summarizeUserAgent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 240);
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

function redirect(location: string, status = 302, headers?: HeadersInit): Response {
  return new Response(null, { status, headers: { location, ...headers } });
}

function withCors(response: Response, env: Env, request: Request): Response {
  const headers = new Headers(response.headers);
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = requestOrigin === env.PUBLIC_ORIGIN || requestOrigin === env.APP_ORIGIN ? requestOrigin : env.APP_ORIGIN;
  headers.set("access-control-allow-origin", allowedOrigin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,x-turnstile-token");
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function statusHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Status da API - PrawURL</title>
  <style>
    body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:grid;min-height:100vh;place-items:center}
    main{width:min(560px,calc(100vw - 32px));border:1px solid #334155;border-radius:12px;padding:32px;background:#111827}
    .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #0f766e;background:#0f766e22;color:#5eead4;border-radius:999px;padding:6px 12px;font-size:14px}
    h1{font-size:32px;margin:20px 0 8px}
    p{color:#cbd5e1;line-height:1.6}
    a{color:#5eead4}
  </style>
</head>
<body>
  <main>
    <span class="pill">● API operacional</span>
    <h1>PrawURL API</h1>
    <p>O endpoint de saúde respondeu normalmente em ${new Date().toISOString()}.</p>
    <p><a href="https://prawurl.com">Voltar para prawurl.com</a></p>
  </main>
</body>
</html>`;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  const cookies = header.split(";").map((item) => item.trim().split("="));
  return cookies.find(([key]) => key === name)?.[1] ?? null;
}

function sessionCookie(token: string, env: Env): HeadersInit {
  return {
    "set-cookie": `${env.SESSION_COOKIE_NAME}=${token}; Path=/; Domain=.prawurl.com; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
  };
}

function clearSessionCookie(env: Env): HeadersInit {
  return {
    "set-cookie": `${env.SESSION_COOKIE_NAME}=; Path=/; Domain=.prawurl.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  };
}

function stateCookie(state: string, env: Env): HeadersInit {
  return {
    "set-cookie": `prawurl_oauth_state=${state}; Path=/; Domain=.prawurl.com; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    "cache-control": "no-store",
    "content-security-policy": `frame-ancestors 'none'; form-action 'self'; default-src 'self' ${env.APP_ORIGIN}`
  };
}

function statusForError(error: unknown): number {
  const message = errorMessage(error);
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN" || message === "USER_BLOCKED") return 403;
  if (message.endsWith("_NOT_FOUND")) return 404;
  if (message.includes("TAKEN") || message.includes("RESERVED")) return 409;
  if (message.includes("INVALID") || message.includes("BLOCKED") || message.includes("MISSING")) return 400;
  return 500;
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}
