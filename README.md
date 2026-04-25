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

## Local Setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run wrangler:types
npm run dev
```

## Required Secrets

Set these with Wrangler before production deploy:

```bash
npx wrangler secret put SESSION_SECRET --config wrangler.api.jsonc
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.api.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.api.jsonc
npx wrangler secret put GITHUB_CLIENT_ID --config wrangler.api.jsonc
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.api.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.api.jsonc
npx wrangler secret put LOG_HASH_SALT --config wrangler.redirect.jsonc
```

The Turnstile site key is public and can be provided at build time:

```bash
VITE_TURNSTILE_SITE_KEY=your-site-key npm run build
```

OAuth callback URLs:

- `https://api.prawurl.com/auth/google/callback`
- `https://api.prawurl.com/auth/github/callback`

## Deploy

```bash
npm run build
npx wrangler d1 migrations apply prawurl --remote
npm run deploy:api
npm run deploy:redirect
npm run deploy:web
```
