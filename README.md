# PrawURL

PrawURL is a Cloudflare-native URL shortener for `prawurl.com`.

## Architecture

- `prawurl.com`: public onepage and short links.
- `app.prawurl.com`: authenticated React dashboard.
- `api.prawurl.com`: API Worker.
- KV: hot redirect cache.
- D1: users, OAuth accounts, sessions, links, audit logs and analytics.
- Queue: asynchronous click and audit events.

## Cloudflare Resources

Created in the connected account:

- Pages project: `prawurl-web`
- KV namespace: `PRAWURL_LINKS` (`7ed7b229a529421ca7c284f113588769`)
- D1 database: `prawurl` (`fbd6cd66-3f82-4072-9e18-fcdcd3be78d7`)
- Queue: `prawurl-events`

## Local Development

Project conventions and UI quality notes live in [`docs/napkin.md`](docs/napkin.md).

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run wrangler:types
npm run dev
```

`npm run dev` starts only the Vite frontend, usually at `http://localhost:5173`.

Useful routes when `npm run dev` is running:

- Public onepage: `http://localhost:5173/`
- Status page: `http://localhost:5173/status`
- Login screen: `http://localhost:5173/app`

The dashboard is selected by path in local development. In production it is selected by host (`app.prawurl.com`). If you open only `/`, you will see the public onepage.

To view the authenticated dashboard without OAuth or a local Worker, run the mocked frontend:

```bash
npm run dev:mock
```

Then open:

```text
http://localhost:5173/app
```

Mock mode uses a fake admin session and sample links, users, metrics and audit logs. It is intended for UI development only.

For visual layout checks across desktop and mobile, install the Playwright browser once and run the visual suite:

```bash
npm run playwright:install
npm run test:visual
```

## Regression checks

Use Node.js 24 LTS or Node.js 26+. Vitest 5 does not support Node.js 25. The dependency versions checked on 2026-10-02 are recorded in
`.specs/features/dependency-refresh/versions.json`; the lockfile pins the complete installed tree.

```bash
npm ci
npm run lint
npm run build
npm test -- --reporter=verbose
npm run build:workers
npm run playwright:install
npm run test:visual
npm run test:e2e
npm audit --audit-level=high
node scripts/check-dependencies.mjs
```

Build before running the complete suite: the asset check and redirect Worker tests use `dist`.
The Vitest suite includes contracts, policies, services and HTTP tests with actual local D1/KV
bindings. Its Worker fixtures apply the existing migrations and seed test sessions in a disposable
local runtime. Temporary configuration directories are removed when the tests finish. No Cloudflare account or production
secrets are needed for these tests.

`test:visual` preserves the original mocked layout suite. `test:e2e` runs the real frontend against
a local Worker, checking CRUD, unauthenticated screens, empty/loading/error states, bulk actions, CSV, QR and
theme persistence at desktop and mobile sizes. Browser windows are visible locally; CI uses Xvfb.
Ports 4175 (mock layout), 4180 (real frontend) and 4910 (E2E API) must be free. The E2E suites run
sequentially and reset only their temporary bindings. OAuth/Turnstile provider availability is not
verified against external services by these local checks.

Tailwind 4 requires Safari 16.4+, Chrome 111+ or Firefox 128+. Automated browser checks currently
use Chromium with desktop and Pixel 5 viewports.

By default the frontend calls the production API at `https://api.prawurl.com`. To point the frontend to a local API Worker, create `.env.local`:

```bash
VITE_API_ORIGIN=http://localhost:8787
```

Then run the API Worker in another terminal:

```bash
npx wrangler dev --config wrangler.api.jsonc --local --port 8787
```

For local OAuth callbacks, add these URLs in the Google/GitHub OAuth apps if you want to test real login locally. The API Worker uses the current request origin as OAuth callback origin during local development:

- `http://localhost:8787/auth/google/callback`
- `http://localhost:8787/auth/github/callback`

For day-to-day UI work, use `http://localhost:5173/app`; if there is no valid session, it opens the login screen.

## Required Secrets

Set these with Wrangler before production deploy:

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.api.jsonc
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.api.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.api.jsonc
npx wrangler secret put GITHUB_CLIENT_ID --config wrangler.api.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.api.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.redirect.jsonc
npx wrangler secret put LOG_HASH_SALT --config wrangler.redirect.jsonc
```

OAuth callback URLs:

- `https://api.prawurl.com/auth/google/callback`
- `https://api.prawurl.com/auth/github/callback`

## Deploy

Production deploys run through GitHub Actions on every push to `main`.

Required GitHub Actions secrets:

```text
CLOUDFLARE_API_TOKEN
SESSION_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
LOG_HASH_SALT
```

The workflow validates TypeScript, runs tests, builds the frontend, applies D1 migrations, deploys both Workers, updates Worker secrets, and deploys Pages.

```bash
npm run build
npx wrangler d1 migrations apply prawurl --remote
npm run deploy:api:production
npm run deploy:redirect:production
npm run deploy:web:production
```

## Staging

Staging runs on the `staging` branch and deploys to separate Cloudflare resources:

- API Worker: `prawurl-api-staging`
- Redirect Worker: `prawurl-redirect-staging`
- Pages project: `prawurl-web-staging`
- D1: `prawurl-staging`
- KV: `PRAWURL_LINKS_STAGING`
- Queue: `prawurl-events-staging`

Target URLs:

- `https://staging.prawurl.com`
- `https://app.staging.prawurl.com`
- `https://api.staging.prawurl.com`

GitHub Actions secrets for staging:

`CLOUDFLARE_API_TOKEN` is shared for deploy auth; the app secrets below are kept under `STAGING_*`.

```text
STAGING_SESSION_SECRET
STAGING_GOOGLE_CLIENT_ID
STAGING_GOOGLE_CLIENT_SECRET
STAGING_OAUTH_GITHUB_CLIENT_ID
STAGING_OAUTH_GITHUB_CLIENT_SECRET
STAGING_SESSION_SECRET
STAGING_LOG_HASH_SALT
```

After validating changes in `staging`, promote them to production by merging `staging` into `main` through a pull request. Production deploys still run from `main`.

To deploy staging locally or from CI:

```bash
npm run build
npm run deploy:api:staging
npm run deploy:redirect:staging
npm run deploy:web:staging
```

### Staging checklist

Use this order when bootstrapping staging secrets:

1. Create the GitHub Actions secrets.
2. Create OAuth apps for Google and GitHub.
3. Copy the client IDs and client secrets into the matching `STAGING_*` secrets.
4. Generate fresh random values for session and hash secrets.
5. Re-run the staging workflow so Wrangler writes the secrets into the staging Workers.

### Staging URLs and origins

These are the URLs currently used by staging:

- Public origin: `https://staging.prawurl.com`
- App origin: `https://app.staging.prawurl.com`
- API origin: `https://api.staging.prawurl.com`

Use these callback URLs in the OAuth providers:

- Google callback: `https://api.staging.prawurl.com/auth/google/callback`
- GitHub callback: `https://api.staging.prawurl.com/auth/github/callback`

### How to create each secret

- `STAGING_SESSION_SECRET`: generate a long random string.
  - Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `STAGING_LOG_HASH_SALT`: generate another long random string.
  - Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `STAGING_GOOGLE_CLIENT_ID` and `STAGING_GOOGLE_CLIENT_SECRET`:
  - Create or open a Google OAuth Client in Google Cloud Console.
  - Add the Google callback URL above to the authorized redirect URIs.
  - Copy the client ID and client secret.
- `STAGING_OAUTH_GITHUB_CLIENT_ID` and `STAGING_OAUTH_GITHUB_CLIENT_SECRET`:
  - Create or open a GitHub OAuth App.
  - Set the callback URL to the GitHub callback above.
  - Copy the client ID and client secret.
- `STAGING_SESSION_SECRET` is also written to the staging redirect worker so unlock cookies can be verified there.

### GitHub Actions secrets to add

Create these in the repository settings under Secrets and variables > Actions:

- `CLOUDFLARE_API_TOKEN`
- `STAGING_SESSION_SECRET`
- `STAGING_GOOGLE_CLIENT_ID`
- `STAGING_GOOGLE_CLIENT_SECRET`
- `STAGING_OAUTH_GITHUB_CLIENT_ID`
- `STAGING_OAUTH_GITHUB_CLIENT_SECRET`
- `STAGING_SESSION_SECRET`
- `STAGING_LOG_HASH_SALT`

### Reminder

If a `STAGING_*` secret is missing, the workflow currently writes an empty value to the Worker secret bulk upload. That can make login or redirects fail in staging.
