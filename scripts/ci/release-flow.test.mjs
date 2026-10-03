import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMigration, checkChangedMigrations } from "./check-migrations.mjs";
import { verifyStaging } from "./verify-staging.mjs";

for (const sql of ["DROP TABLE links;", "DELETE FROM links;", "UPDATE links SET status = 'blocked';", "ALTER TABLE links DROP COLUMN title;", "-- note\n alter table links rename to old_links;"]) {
  test(`bloqueia migração destrutiva: ${sql}`, () => assert.throws(() => checkMigration("A", sql), /destrutiva/));
}
test("permite migrações aditivas, comentários e ON DELETE de chaves estrangeiras", () => {
  checkMigration("A", "/* DROP TABLE links; */ CREATE TABLE links (owner TEXT REFERENCES users(id) ON DELETE CASCADE);\n-- UPDATE links\nALTER TABLE links ADD COLUMN title TEXT;");
});
for (const status of ["M", "D"]) test(`preserva migrações existentes: ${status}`, () => assert.throws(() => checkMigration(status), /já versionadas/));
test("valida o intervalo inteiro do push, incluindo commits anteriores ao último", () => {
  const calls = [];
  assert.throws(() => checkChangedMigrations("before-push", (...args) => { calls.push(args); return "D\tmigrations/0001.sql"; }), /já versionadas/);
  assert.deepEqual(calls[0], ["diff", "--name-status", "--no-renames", "before-push", "HEAD", "--", "migrations"]);
});
test("falha sem base de comparação", () => assert.throws(() => checkChangedMigrations("000000"), /Base/));

const repository = "owner/repo";
const successful = { id: 42, head_sha: "stage-sha", head_branch: "staging", event: "push", status: "completed", conclusion: "success", html_url: "https://github.com/owner/repo/actions/runs/42" };
function setup({ runs = [successful], jobs, pullRequest, trees = {} } = {}) {
  return { repository, sha: "merge-sha", pullRequest, treeOf: async (sha) => trees[sha] || "same-tree", ancestorOf: async () => true,
    request: async (path) => {
      if (path.includes("/git/ref/")) return { object: { sha: "stage-sha" } };
      if (path.includes("/jobs?")) return { jobs: jobs || ["Publicar em staging", "Verificar staging"].map((name) => ({ name, conclusion: "success" })) };
      return { workflow_runs: runs };
    }
  };
}
const pr = { head: { ref: "staging", sha: "stage-sha", repo: { full_name: repository } } };
test("aprova PR de staging com merge idêntico e deploy saudável", async () => assert.equal((await verifyStaging(setup({ pullRequest: pr }))).id, 42));
test("aprova merge de produção pela árvore e ancestralidade da versão publicada", async () => assert.equal((await verifyStaging(setup())).head_sha, "stage-sha"));
test("bloqueia PR direto de feature para produção", async () => assert.rejects(verifyStaging(setup({ pullRequest: { head: { ...pr.head, ref: "feature" } } })), /somente PR de staging/));
test("bloqueia alterações de main que não passaram por staging", async () => assert.rejects(verifyStaging(setup({ pullRequest: pr, trees: { "merge-sha": "untested-tree" } })), /ausentes de staging/));
test("bloqueia PR desatualizado", async () => assert.rejects(verifyStaging(setup({ pullRequest: { head: { ...pr.head, sha: "old-sha" } } })), /versão atual/));
test("bloqueia produção se não houver deploy da mesma árvore", async () => assert.rejects(verifyStaging(setup({ trees: { "merge-sha": "untested-tree" } })), /Nenhuma publicação/));
test("bloqueia deploy de histórico não integrado", async () => assert.rejects(verifyStaging({ ...setup(), ancestorOf: async () => false }), /Nenhuma publicação/));
for (const status of ["in_progress", "failure"]) test(`bloqueia staging ainda sem sucesso: ${status}`, async () => {
  const latest = { ...successful, status: status === "failure" ? "completed" : status, conclusion: status === "failure" ? "failure" : null };
  await assert.rejects(verifyStaging(setup({ runs: [latest, successful] })), /ainda não passou/);
});
test("bloqueia workflow verde com deploy ou health check pulados", async () => assert.rejects(verifyStaging(setup({ jobs: [{ name: "Publicar em staging", conclusion: "skipped" }] })), /não confirmou/));
