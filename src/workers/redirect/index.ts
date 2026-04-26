import { RedirectService } from "../../application/redirect-service";
import { D1LinkRepository } from "../../infrastructure/d1-repositories";
import { sha256Hex } from "../../infrastructure/crypto";
import { KvRedirectCache } from "../../infrastructure/kv-redirect-cache";
import { QueueEventPublisher } from "../../infrastructure/queue-event-publisher";
import type { AppEvent } from "../../shared/contracts";
import { isReservedPath, normalizeAlias } from "../../shared/validation";

interface Env {
  DB: D1Database;
  PRAWURL_LINKS: KVNamespace;
  EVENTS: Queue<AppEvent>;
  ASSETS: Fetcher;
  PUBLIC_ORIGIN: string;
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

    const service = new RedirectService(
      new D1LinkRepository(env.DB),
      new KvRedirectCache(env.PRAWURL_LINKS),
      new QueueEventPublisher(env.EVENTS)
    );
    const entry = await service.resolve(alias);

    if (!entry) {
      return env.ASSETS.fetch(new Request(new URL("/status?missing=1", url), request));
    }

    ctx.waitUntil(
      service.recordClick({
        type: "click",
        linkId: entry.id,
        alias: entry.alias,
        occurredAt: new Date().toISOString(),
        country: request.cf?.country?.toString() ?? null,
        region: request.cf?.region?.toString() ?? null,
        referrer: request.headers.get("referer"),
        userAgent: summarizeUserAgent(request.headers.get("user-agent")),
        ipHash: await ipHash(request, env)
      })
    );

    return new Response(null, {
      status: entry.redirectCode,
      headers: {
        location: entry.destinationUrl,
        "cache-control": "no-store"
      }
    });
  }
};

function isAssetOrPublicPage(alias: string): boolean {
  return isReservedPath(alias) || alias.startsWith("assets/") || alias.includes(".");
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
