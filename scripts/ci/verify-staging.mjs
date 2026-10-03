import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function verifyStaging({ repository, sha, pullRequest, request, treeOf, ancestorOf }) {
  const targetTree = await treeOf(sha);
  if (pullRequest) {
    if (pullRequest.head.ref !== "staging" || pullRequest.head.repo.full_name !== repository) {
      throw new Error("Produção recebe somente PR de staging deste repositório; integre e valide a alteração em staging primeiro.");
    }
    const staging = await request(`/repos/${repository}/git/ref/heads/staging`);
    if (staging.object.sha !== pullRequest.head.sha) throw new Error("O PR não acompanha a versão atual de staging.");
    if (targetTree !== await treeOf(pullRequest.head.sha)) {
      throw new Error("O resultado do merge contém alterações ausentes de staging; sincronize main em staging e publique novamente.");
    }
  }
  const query = pullRequest ? `&head_sha=${pullRequest.head.sha}` : "";
  const { workflow_runs: runs } = await request(`/repos/${repository}/actions/workflows/deploy-staging.yml/runs?branch=staging&per_page=100${query}`);
  const deployments = runs.filter((run) => run.head_branch === "staging" && ["push", "workflow_dispatch"].includes(run.event));
  for (const run of deployments) {
    if (pullRequest && run.head_sha !== pullRequest.head.sha) continue;
    if (!pullRequest && (await treeOf(run.head_sha) !== targetTree || !await ancestorOf(run.head_sha, sha))) continue;
    // A newer failing or unfinished deployment of the same version invalidates older evidence.
    if (run.status !== "completed" || run.conclusion !== "success") {
      throw new Error(`A publicação desta versão em staging ainda não passou: ${run.html_url}`);
    }
    const { jobs } = await request(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
    for (const name of ["Publicar em staging", "Verificar staging"]) {
      if (!jobs.some((job) => job.name === name && job.conclusion === "success")) {
        throw new Error(`Staging não confirmou ${name}: ${run.html_url}`);
      }
    }
    return run;
  }
  throw new Error("Nenhuma publicação saudável em staging corresponde a esta árvore. Publique staging antes de promover para main.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const repository = process.env.GITHUB_REPOSITORY;
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const run = await verifyStaging({
      repository,
      sha: process.env.GITHUB_SHA,
      pullRequest: event.pull_request,
      request: async (path) => {
        const response = await fetch(`${process.env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
          headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
        });
        if (!response.ok) throw new Error(`Consulta da evidência de staging falhou: HTTP ${response.status}.`);
        return response.json();
      },
      treeOf: async (ref) => {
        try { return git("rev-parse", `${ref}^{tree}`); }
        catch {
          // Full checkout normally contains this commit, but deleted branches may require fetching it.
          git("fetch", "--quiet", "origin", ref);
          return git("rev-parse", `${ref}^{tree}`);
        }
      },
      ancestorOf: async (base, head) => {
        try { git("merge-base", "--is-ancestor", base, head); return true; }
        catch { return false; }
      }
    });
    const evidence = `Staging validado e publicado: ${run.head_sha}\n${run.html_url}\n`;
    console.log(evidence);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, evidence);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
