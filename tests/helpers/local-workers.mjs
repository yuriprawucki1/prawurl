import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

// Bindings use a disposable local runtime; configs use a temporary directory, never .wrangler state.
export async function startLocalWorkers({ apiPort = 0, publicOrigin = "http://127.0.0.1:4180" } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "prawurl-workers-"));
  const logPath = process.env.WRANGLER_LOG_PATH;
  process.env.WRANGLER_LOG_PATH = join(tmpdir(), "prawurl-test-wrangler.log");
  process.env.WRANGLER_SEND_METRICS = "false";
  const { createTestHarness } = await import("wrangler");
  const configs = {};
  let harness;
  let apiBridge;
  try {
    for (const name of ["api", "redirect"]) {
      const config = JSON.parse(await readFile(resolve(`wrangler.${name}.jsonc`), "utf8"));
      delete config.account_id;
      // Host routing keeps both production Workers in one workerd runtime.
      config.routes = name === "redirect" ? ["localhost/*"] : [];
      delete config.env;
      delete config.observability;
      delete config.$schema;
      config.name = `prawurl-test-${name}`;
      config.main = resolve(config.main);
      config.vars = { ...config.vars, APP_ORIGIN: publicOrigin, PUBLIC_ORIGIN: publicOrigin,
        SESSION_SECRET: "local-test-secret", LOG_HASH_SALT: "local-test-salt" };
      if (config.queues) delete config.queues.consumers;
      for (const binding of config.d1_databases ?? []) binding.migrations_dir = resolve(binding.migrations_dir);
      if (config.assets) config.assets.directory = resolve(config.assets.directory);
      configs[name] = join(directory, `${name}.json`);
      await writeFile(configs[name], JSON.stringify(config));
    }
    harness = createTestHarness({ workers: [
      { configPath: configs.api }, { configPath: configs.redirect }
    ] });
    const { url } = await harness.listen();
    const apiWorker = harness.getWorker("prawurl-test-api");
    await apiWorker.applyD1Migrations("DB");
    const env = await apiWorker.getEnv();
    const db = env.DB;
    await seedSessions(db);
    let apiUrl = url.origin;
    if (apiPort) {
      // Vite's API origin is fixed at startup; forward its port to the actual Worker.
      apiBridge = createServer(async (request, response) => {
        try {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const result = await apiWorker.fetch(`http://127.0.0.1:${apiPort}${request.url}`, {
            method: request.method, headers: request.headers,
            ...(["GET", "HEAD"].includes(request.method) ? {} : { body: Buffer.concat(chunks) })
          });
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) {
          response.writeHead(500);
          response.end(String(error));
        }
      });
      await new Promise((resolve, reject) => {
        apiBridge.once("error", reject);
        apiBridge.listen(apiPort, "127.0.0.1", resolve);
      });
      apiUrl = `http://127.0.0.1:${apiPort}`;
    }
    const redirectUrl = new URL(url);
    redirectUrl.hostname = "localhost";
    return {
      db, kv: env.PRAWURL_LINKS, apiUrl, redirectUrl: redirectUrl.origin,
      tokens: { owner: "owner-token", other: "other-token", admin: "admin-token", blocked: "blocked-token", expired: "expired-token", revoked: "revoked-token" },
      async stop() {
        if (apiBridge) await new Promise((resolve, reject) => apiBridge.close((error) => error ? reject(error) : resolve()));
        await harness.close();
        if (logPath === undefined) delete process.env.WRANGLER_LOG_PATH;
        else process.env.WRANGLER_LOG_PATH = logPath;
        await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
    };
  } catch (error) {
    if (apiBridge?.listening) await new Promise((resolve) => apiBridge.close(resolve));
    await harness?.close();
    if (logPath === undefined) delete process.env.WRANGLER_LOG_PATH;
    else process.env.WRANGLER_LOG_PATH = logPath;
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    throw error;
  }
}

async function seedSessions(db) {
  const now = new Date().toISOString();
  for (const [id, role, status] of [["owner", "user", "active"], ["other", "user", "active"], ["admin", "admin", "active"], ["blocked", "user", "blocked"]]) {
    await db.prepare("INSERT INTO users(id,email,name,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .bind(id, `${id}@example.test`, `Test ${id}`, role, status, now, now).run();
  }
  for (const name of ["owner", "other", "admin", "blocked", "expired", "revoked"]) {
    const tokenHash = createHash("sha256").update(`local-test-secret:${name}-token`).digest("hex");
    await db.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,revoked_at) VALUES(?,?,?,?,?,?)")
      .bind(name, ["expired", "revoked"].includes(name) ? "owner" : name, tokenHash,
        new Date(Date.now() + (name === "expired" ? -86400000 : 86400000)).toISOString(), now,
        name === "revoked" ? now : null).run();
  }
}
