import { RedirectService } from "../../application/redirect-service";
import { D1LinkRepository, insertClickEvent } from "../../infrastructure/d1-repositories";
import { sha256Hex } from "../../infrastructure/crypto";
import { KvRedirectCache } from "../../infrastructure/kv-redirect-cache";
import { buildUnlockCookieName } from "../../infrastructure/link-security";
import type { AppEvent } from "../../shared/contracts";
import { isReservedPath, normalizeAlias } from "../../shared/validation";

interface Env {
  DB: D1Database;
  PRAWURL_LINKS: KVNamespace;
  EVENTS: Queue<AppEvent>;
  ASSETS: Fetcher;
  PUBLIC_ORIGIN: string;
  SESSION_SECRET: string;
  LOG_HASH_SALT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const alias = normalizeAlias(url.pathname.replace(/^\/+|\/+$/g, ""));

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (isAssetOrPublicPage(alias)) {
      return env.ASSETS.fetch(request);
    }

    const service = new RedirectService(new D1LinkRepository(env.DB), new KvRedirectCache(env.PRAWURL_LINKS), env.SESSION_SECRET, cookieDomainFromOrigin(env.PUBLIC_ORIGIN));
    const unlockToken = cookieValue(request, buildUnlockCookieName(alias));
    const result = await service.resolve(alias, {
      country: request.cf?.country?.toString() ?? null,
      unlockToken,
      now: new Date().toISOString()
    });

    if (result.kind !== "redirect") {
      return env.ASSETS.fetch(request);
    }

    ctx.waitUntil(clickEvent(request, env, result.linkId ?? null, result.alias ?? alias).then((event) => insertClickEvent(env.DB, event)));

    return new Response(null, {
      status: result.redirectCode ?? 302,
      headers: {
        location: result.destinationUrl ?? "/",
        "cache-control": "no-store"
      }
    });
  }
};

function isAssetOrPublicPage(alias: string): boolean {
  return isReservedPath(alias) || alias.startsWith("assets/") || alias.includes(".");
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

function summarizeUserAgent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 240);
}

async function ipHash(request: Request, env: Env): Promise<string | null> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip || !env.LOG_HASH_SALT) {
    return null;
  }
  return sha256Hex(`${env.LOG_HASH_SALT}:${ip}`);
}

async function clickEvent(request: Request, env: Env, linkId: string | null, alias: string): Promise<Extract<AppEvent, { type: "click" }>> {
  return {
    type: "click",
    linkId,
    alias,
    occurredAt: new Date().toISOString(),
    country: request.cf?.country?.toString() ?? null,
    region: request.cf?.region?.toString() ?? null,
    referrer: request.headers.get("referer"),
    userAgent: summarizeUserAgent(request.headers.get("user-agent")),
    ipHash: await ipHash(request, env)
  };
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  const cookies = header.split(";").map((item) => item.trim().split("="));
  return cookies.find(([key]) => key === name)?.[1] ?? null;
}
