export interface LocalWorkers {
  db: D1Database;
  kv: KVNamespace;
  apiUrl: string;
  redirectUrl: string;
  tokens: Record<"owner" | "other" | "admin" | "blocked" | "expired" | "revoked", string>;
  stop(): Promise<void>;
}
export function startLocalWorkers(options?: { apiPort?: number; publicOrigin?: string }): Promise<LocalWorkers>;
