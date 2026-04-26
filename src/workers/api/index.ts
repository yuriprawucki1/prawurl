import { LinkService } from "../../application/link-service";
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
import type { AppEvent, OAuthProvider, UserStatus, UserRole } from "../../shared/contracts";
import { isReservedPath, normalizeAlias } from "../../shared/validation";
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

  const publicResolve = path.match(/^public\/resolve\/(.+)$/);
  if (publicResolve && request.method === "GET") {
    const alias = normalizeAlias(decodeURIComponent(publicResolve[1]).replace(/^\/+|\/+$/g, ""));
    if (isReservedPath(alias)) {
      return json({ error: "NOT_FOUND" }, 404);
    }

    const link = await services.links.findByAlias(alias);
    if (!link || link.status !== "active" || (link.expiresAt && Date.parse(link.expiresAt) <= Date.now())) {
      return json({ error: "NOT_FOUND" }, 404);
    }

    return json({ destinationUrl: link.destinationUrl });
  }

  if (path === "auth/session") {
    const session = await readSession(request, env);
    return json({ session });
  }

  if (path === "auth/logout" && request.method === "POST") {
    const token = cookieValue(request, env.SESSION_COOKIE_NAME);
    if (token) {
      await services.sessions.revoke(await sha256Hex(`${env.SESSION_SECRET}:${token}`), new Date().toISOString());
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
      now: new Date().toISOString()
    });

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await services.sessions.create(user.id, await sha256Hex(`${env.SESSION_SECRET}:${token}`), expiresAt, new Date().toISOString());
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      severity: "info",
      metadata: { provider },
      occurredAt: new Date().toISOString()
    });

    return redirect(`${env.APP_ORIGIN}/app`, 302, sessionCookie(token, env));
  }

  const session = await requireSession(request, env);
  services.adminPolicy.assertActive(session.user);

  if (path === "links" && request.method === "GET") {
    return json({ links: await services.linkService.listForUser(session.user) });
  }

  if (path === "links" && request.method === "POST") {
    const link = await services.linkService.create(session.user, await request.json());
    return json({ link }, 201);
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
      occurredAt: new Date().toISOString()
    })
  );
  return json({ error: "NOT_FOUND" }, 404);
}

async function handleAdmin(path: string, request: Request, services: ReturnType<typeof makeServices>, actorUserId: string): Promise<Response> {
  if (path === "admin/summary" && request.method === "GET") {
    return json({ summary: await services.metrics.summary() });
  }

  if (path === "admin/users" && request.method === "GET") {
    return json({ users: await services.users.listAll() });
  }

  const userStatus = path.match(/^admin\/users\/([^/]+)\/status$/);
  if (userStatus && request.method === "PATCH") {
    const body = (await request.json()) as { status?: UserStatus };
    if (body.status !== "active" && body.status !== "blocked") {
      throw new Error("INVALID_STATUS");
    }
    const user = await services.users.updateStatus(userStatus[1], body.status, new Date().toISOString());
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.user_status.update",
      entityType: "user",
      entityId: userStatus[1],
      severity: "warning",
      metadata: { status: body.status },
      occurredAt: new Date().toISOString()
    });
    return json({ user });
  }

  const userRole = path.match(/^admin\/users\/([^/]+)\/role$/);
  if (userRole && request.method === "PATCH") {
    const body = (await request.json()) as { role?: UserRole };
    if (body.role !== "user" && body.role !== "admin") {
      throw new Error("INVALID_ROLE");
    }
    const user = await services.users.updateRole(userRole[1], body.role, new Date().toISOString());
    await services.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId,
      action: "admin.user_role.update",
      entityType: "user",
      entityId: userRole[1],
      severity: "critical",
      metadata: { role: body.role },
      occurredAt: new Date().toISOString()
    });
    return json({ user });
  }

  if (path === "admin/links" && request.method === "GET") {
    return json({ links: await services.linkService.listAll() });
  }

  if (path === "admin/audit-logs" && request.method === "GET") {
    return json({ logs: await services.auditLogs.listRecent(200) });
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

  return {
    users,
    links,
    sessions,
    auditLogs,
    metrics: new D1MetricsRepository(env.DB),
    linkService,
    adminPolicy: new AdminPolicy()
  };
}

async function readSession(request: Request, env: Env) {
  const token = cookieValue(request, env.SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }
  return new D1SessionRepository(env.DB).findByTokenHash(await sha256Hex(`${env.SESSION_SECRET}:${token}`), new Date().toISOString());
}

async function requireSession(request: Request, env: Env) {
  const session = await readSession(request, env);
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
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
