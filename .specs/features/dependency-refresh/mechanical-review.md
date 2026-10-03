# Mechanical review — dependency refresh

Reviewer: gpt-6-luna (medium), independent mechanical review (not the final Verifier).
Scope: read-only review of `ad2de29..working tree` in `/Users/yuriprawucki/Documents/Projetos/prawurl`.

## Blockers

None found in the reviewed package/lock snapshot, peer compatibility, TypeScript/Vite/Playwright setup, local Worker helper, or deployment workflows.

Evidence:

- `npm ls --depth=0` completed successfully and resolved all 22 direct dependencies without missing or invalid entries.
- Read-only `npm view` checks against the npm registry matched the checked-in snapshot for all 22 direct dependency versions. Registry peer/engine metadata confirmed the relevant intersections: Vite 8.3.2 satisfies plugin-react's `^8` and Tailwind Vite's `^5.2 || ^6 || ^7 || ^8`; Vitest 5.0.3 accepts Vite 8 and Node `^24 || >=26`; Wrangler's workers-types peer accepts 5.20261002.1; React/React DOM 19.3.0 and the declared Radix/Lucide peers are compatible.
- The root package-lock entry matches package.json, uses lockfile v3, and contains 327 package entries.
- The final manifest and lock both declare `engines.node: ^24.0.0 || >=26.0.0`; README specifies Node 24 LTS or 26+, excluding Node 25 in line with Vitest 5.0.3's engine range. Current local Node is 24.18.0.
- The test harness uses Wrangler's exported `createTestHarness` API (confirmed in the installed `wrangler` declaration), and the edited harness points D1 migrations/assets to absolute paths and binds its generated configs under a temporary directory.
- Both CI workflows run lint, build, Vitest, worker bundle validation, visual Playwright, and E2E Playwright before their first remote migration/deploy command. Chromium is installed, and headed browser runs are wrapped with Xvfb in CI.
- The two Playwright configurations use separate test directories and ports (4175, 4180, and E2E API 4910); each specifies Chromium desktop/mobile projects and one worker.

## Optional observations

- [scripts/check-dependencies.mjs](/Users/yuriprawucki/Documents/Projetos/prawurl/scripts/check-dependencies.mjs:11) validates version strings, manifest ranges, and lock versions, but does not assert the `engines` or `peerDependencies` fields recorded in `versions.json`. The current peer compatibility was independently confirmed with npm metadata and `npm ls`; this is a future-proofing gap in the snapshot checker, not a current incompatibility.
- [README.md](/Users/yuriprawucki/Documents/Projetos/prawurl/README.md:185) lists `STAGING_SESSION_SECRET` twice. This duplication predates the diff and does not affect the workflow.

## Commands executed

- `git diff --numstat ad2de29 --` and targeted `git diff` reads.
- `node --version` → v24.18.0; `npm --version` → 12.2.0.
- `npm ls --depth=0` (successful; run twice, final output clean).
- Read-only `npm view` version/peer/engine metadata for all 22 direct packages; the first unprivileged query failed on DNS (`ENOTFOUND`), then the authorized registry queries succeeded.
- Read-only source/declaration inspection with `rg`, `cat`, `sed`, and `nl`.

No project tests, builds, installs, Vite servers, browsers, or Workers were started.

## Supplemental fix review

Read-only review by `/root/mechanical_review` (gpt-6-luna), range `e6c444b6..8b6c8b8ae60209c2759d719158b41b3f40d05782`: no concrete introduced risk found. Existing validation assertions remain and the same boundaries now exercise both create and update schemas. The CSS removes only the unlayered universal border reset, retaining the reset in `@layer base` so component utilities can win the cascade. The E2E assertions check computed fill and border against primary while preserving selection, export, disable/re-enable and unselected-link assertions. No tests or installs were run in this supplemental review, and no files were edited by this reviewer. Recorded here by root from the reviewer's returned conclusion.
