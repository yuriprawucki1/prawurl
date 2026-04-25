import type { RedirectCacheEntry } from "../shared/contracts";
import type { RedirectCache } from "../domain/ports";

const cacheTtlSeconds = 60 * 60 * 24;

export class KvRedirectCache implements RedirectCache {
  constructor(private readonly kv: KVNamespace) {}

  async get(alias: string): Promise<RedirectCacheEntry | null> {
    return this.kv.get<RedirectCacheEntry>(alias, "json");
  }

  async put(entry: RedirectCacheEntry): Promise<void> {
    await this.kv.put(entry.alias, JSON.stringify(entry), { expirationTtl: cacheTtlSeconds });
  }

  async delete(alias: string): Promise<void> {
    await this.kv.delete(alias);
  }
}
