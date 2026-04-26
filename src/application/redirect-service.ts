import type { AppEvent, RedirectCacheEntry } from "../shared/contracts";
import type { EventPublisher, LinkRepository, RedirectCache } from "../domain/ports";

export class RedirectService {
  constructor(
    private readonly links: LinkRepository,
    private readonly cache: RedirectCache,
    private readonly events?: EventPublisher
  ) {}

  async resolve(alias: string): Promise<RedirectCacheEntry | null> {
    const cached = await this.cache.get(alias);
    if (cached && isUsable(cached)) {
      return cached;
    }

    const link = await this.links.findByAlias(alias);
    if (!link || link.status !== "active") {
      return null;
    }

    const entry: RedirectCacheEntry = {
      id: link.id,
      alias: link.alias,
      destinationUrl: link.destinationUrl,
      status: link.status,
      expiresAt: link.expiresAt,
      redirectCode: link.redirectCode
    };

    if (!isUsable(entry)) {
      await this.cache.delete(alias);
      return null;
    }

    await this.cache.put(entry);
    return entry;
  }

  recordClick(event: AppEvent): Promise<void> {
    return this.events?.publish(event) ?? Promise.resolve();
  }
}

function isUsable(entry: RedirectCacheEntry): boolean {
  return entry.status === "active" && (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
}
