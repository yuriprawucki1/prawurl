import type { Link, RedirectCacheEntry } from "../shared/contracts";
import type { LinkAccessRecord, LinkRepository, RedirectCache } from "../domain/ports";
import { buildUnlockCookieName, LINK_UNLOCK_COOKIE_TTL_SECONDS, signUnlockToken, verifyPassword, verifyUnlockToken } from "../infrastructure/link-security";

export interface RedirectContext {
  country: string | null;
  unlockToken: string | null;
  now: string;
}

export interface UnlockResult {
  kind: "redirect" | "blocked" | "not_found" | "password_required";
  linkId?: string;
  alias?: string;
  destinationUrl?: string;
  redirectCode?: 301 | 302;
  message?: string;
  setCookie?: string;
}

export class RedirectService {
  constructor(
    private readonly links: LinkRepository,
    private readonly cache: RedirectCache,
    private readonly sessionSecret: string,
    private readonly cookieDomain: string | null
  ) {}

  async resolve(alias: string, context: RedirectContext): Promise<UnlockResult> {
    const cached = await this.cache.get(alias);
    if (cached && isSimpleCacheEntryUsable(cached)) {
      const recorded = await this.links.recordSuccessfulClick(cached.id, context.now);
      if (!recorded) {
        return { kind: "blocked", alias, message: "Esse link atingiu o limite de uso." };
      }

      return {
        kind: "redirect",
        linkId: cached.id,
        alias: cached.alias,
        destinationUrl: cached.destinationUrl,
        redirectCode: cached.redirectCode
      };
    }

    const link = await this.links.findAccessByAlias(alias);
    if (!link) {
      return { kind: "not_found", alias };
    }

    const access = await this.evaluateAccess(link, context);
    if (access.kind !== "redirect") {
      return access;
    }

    if (shouldCache(link)) {
      await this.cache.put(toCacheEntry(link));
    } else {
      await this.cache.delete(alias);
    }

    const recorded = await this.links.recordSuccessfulClick(link.id, context.now);
    if (!recorded) {
      return { kind: "blocked", alias, message: "Esse link atingiu o limite de uso." };
    }

    return access;
  }

  async unlock(alias: string, password: string, context: RedirectContext): Promise<UnlockResult> {
    const link = await this.links.findAccessByAlias(alias);
    if (!link) {
      return { kind: "not_found", alias };
    }

    if (!link.passwordProtected) {
      return this.resolve(alias, context);
    }

    const access = await this.evaluateAccess(link, context, false);
    if (access.kind === "blocked" || access.kind === "not_found" || access.kind === "password_required") {
      return access;
    }

    if (!link.passwordProtected || !link.passwordUpdatedAt || !link.passwordHash || !link.passwordSalt || !link.passwordIterations) {
      return { kind: "not_found", alias };
    }

    const verified = await verifyPassword(password, {
      hash: link.passwordHash,
      salt: link.passwordSalt,
      iterations: link.passwordIterations
    });
    if (!verified) {
      return { kind: "password_required", alias, message: "Senha inválida." };
    }

    const unlockToken = await signUnlockToken(
      {
        linkId: link.id,
        passwordVersion: link.passwordUpdatedAt,
        expiresAt: new Date(Date.now() + LINK_UNLOCK_COOKIE_TTL_SECONDS * 1000).toISOString()
      },
      this.sessionSecret
    );

    const recorded = await this.links.recordSuccessfulClick(link.id, context.now);
    if (!recorded) {
      return { kind: "blocked", alias, message: "Esse link atingiu o limite de uso." };
    }

    return {
      kind: "redirect",
      linkId: link.id,
      alias: link.alias,
      destinationUrl: link.destinationUrl,
      redirectCode: link.redirectCode,
      setCookie: this.buildUnlockCookie(link.alias, unlockToken)
    };
  }

  async issueUnlockToken(link: LinkAccessRecord): Promise<string> {
    if (!link.passwordUpdatedAt) {
      throw new Error("LINK_PASSWORD_NOT_SET");
    }

    return signUnlockToken(
      {
        linkId: link.id,
        passwordVersion: link.passwordUpdatedAt,
        expiresAt: new Date(Date.now() + LINK_UNLOCK_COOKIE_TTL_SECONDS * 1000).toISOString()
      },
      this.sessionSecret
    );
  }

  async canUseUnlockToken(link: LinkAccessRecord, token: string | null): Promise<boolean> {
    if (!token || !link.passwordUpdatedAt) {
      return false;
    }

    const payload = await verifyUnlockToken(token, this.sessionSecret);
    return Boolean(payload && payload.linkId === link.id && payload.passwordVersion === link.passwordUpdatedAt && Date.parse(payload.expiresAt) > Date.now());
  }

  buildUnlockCookie(alias: string, token: string): string {
    const domain = this.cookieDomain ? `; Domain=${this.cookieDomain}` : "";
    return `${buildUnlockCookieName(alias)}=${token}; Path=/${domain}; HttpOnly; Secure; SameSite=Lax; Max-Age=${LINK_UNLOCK_COOKIE_TTL_SECONDS}`;
  }

  private async evaluateAccess(link: LinkAccessRecord, context: RedirectContext, requirePassword = true): Promise<UnlockResult> {
    if (!isLinkUsable(link)) {
      return { kind: "blocked", alias: link.alias, message: "Esse link não está mais disponível." };
    }

    if (!isCountryAllowed(link, context.country)) {
      return { kind: "blocked", alias: link.alias, message: "Esse link não está disponível na sua região." };
    }

    const expiredByActivity = isExpiredByInactivity(link, context.now);
    if (expiredByActivity) {
      return { kind: "blocked", alias: link.alias, message: "Esse link expirou por inatividade." };
    }

    if (link.passwordProtected && requirePassword) {
      const unlocked = await this.canUseUnlockToken(link, context.unlockToken);
      if (!unlocked) {
        return {
          kind: "password_required",
          alias: link.alias,
          message: "Senha obrigatória."
        };
      }
    }

    if (isClickLimitReached(link)) {
      return { kind: "blocked", alias: link.alias, message: "Esse link atingiu o limite de uso." };
    }

    return {
      kind: "redirect",
      linkId: link.id,
      alias: link.alias,
      destinationUrl: link.destinationUrl,
      redirectCode: link.redirectCode
    };
  }
}

function shouldCache(link: Link): boolean {
  return (
    link.status === "active" &&
    !link.passwordProtected &&
    link.clickLimit === null &&
    link.inactiveExpiresAfterMinutes === null &&
    link.countryAllowlist.length === 0 &&
    link.countryBlocklist.length === 0
  );
}

function isSimpleCacheEntryUsable(entry: RedirectCacheEntry): boolean {
  return entry.status === "active" && (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
}

function isLinkUsable(link: Link): boolean {
  if (link.status !== "active") {
    return false;
  }
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) {
    return false;
  }
  return true;
}

function isCountryAllowed(link: Link, country: string | null): boolean {
  if (link.countryAllowlist.length > 0) {
    if (!country) {
      return false;
    }
    return link.countryAllowlist.includes(country.toUpperCase());
  }

  if (link.countryBlocklist.length > 0) {
    if (!country) {
      return false;
    }
    return !link.countryBlocklist.includes(country.toUpperCase());
  }

  return true;
}

function isExpiredByInactivity(link: Link, now: string): boolean {
  if (!link.inactiveExpiresAfterMinutes) {
    return false;
  }

  const lastClick = link.lastClickedAt ?? link.createdAt;
  const elapsedMinutes = (Date.parse(now) - Date.parse(lastClick)) / 60000;
  return elapsedMinutes > link.inactiveExpiresAfterMinutes;
}

function isClickLimitReached(link: Link): boolean {
  if (!link.clickLimit) {
    return false;
  }

  return link.clickCount >= link.clickLimit;
}

function toCacheEntry(link: Link): RedirectCacheEntry {
  return {
    id: link.id,
    alias: link.alias,
    destinationUrl: link.destinationUrl,
    status: link.status,
    expiresAt: link.expiresAt,
    redirectCode: link.redirectCode
  };
}
