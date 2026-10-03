import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function checkMigration(status, sql = "") {
  if (status !== "A") throw new Error("Migrações já versionadas não podem ser alteradas, renomeadas ou removidas; crie uma nova migração.");
  const statements = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").split(";");
  if (statements.some((statement) => /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|UPDATE\b|ALTER\s+TABLE\b[\s\S]*\b(?:DROP|RENAME)\b)/i.test(statement))) {
    throw new Error("Migração potencialmente destrutiva; revise compatibilidade e recuperação antes de publicar.");
  }
}

export function checkChangedMigrations(base, git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()) {
  if (!base || /^0+$/.test(base)) throw new Error("Base de comparação ausente; não é possível validar as migrações.");
  const entries = git("diff", "--name-status", "--no-renames", base, "HEAD", "--", "migrations").split("\n").filter(Boolean);
  for (const entry of entries) {
    const [status, path] = entry.split("\t");
    if (path.endsWith(".sql")) checkMigration(status, status === "A" ? readFileSync(path, "utf8") : "");
  }
  return entries.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Manual retries validate the last commit; pushes and PRs use the full event range.
    const base = process.env.MIGRATION_BASE || execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
    console.log(`Migrações validadas: ${checkChangedMigrations(base)} arquivos no intervalo ${base}..HEAD.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
