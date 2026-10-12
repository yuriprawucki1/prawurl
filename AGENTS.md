# Repository instructions

## Branches and releases

- Never commit directly to `main` or `staging`; use a feature branch and a pull request.
- Target normal application and documentation changes at `staging`.
- Promote from `staging` to `main` only through a pull request after the staging deployment and health checks succeed. Use a merge commit for the promotion.
- If `main` has commits that are missing from `staging`, synchronize `main` into `staging` before promoting.

## Checks and reviews

- Wait for `Validar alteração / Qualidade e segurança` on pull requests to `staging`.
- Pull requests to `main` also need `Confirmar promoção de staging`.
- Request `@codex review` for every pull request, review its feedback, and resolve applicable conversations. This is a manual process step; GitHub does not expose a Codex status check that can be required for merging.
- No separate human approval is required. Merging is available to the repository owner and collaborators with write permission or higher.
- Do not bypass branch rules, force-push protected branches, or delete branches that still serve as heads of open pull requests.
