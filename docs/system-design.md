# PrawURL System Design

## Boundaries

The domain layer owns rules for aliases, destination URLs, roles and status. It depends on ports, not on Cloudflare bindings.

The application layer coordinates use cases such as creating links, resolving redirects and recording audit events.

The infrastructure layer implements ports with D1, KV, Queue, OAuth providers and Turnstile.

The presentation layer contains Worker handlers and React components. Handlers validate transport concerns, call use cases and serialize responses.

## Logging

Cloudflare Observability is enabled in Worker config. Durable audit events are written to D1 for auth, CRUD, admin and security events. High-volume click analytics is pushed to Queue and persisted asynchronously.

IP addresses are not stored raw. Redirect logging stores an optional salted hash, Cloudflare country/region, referrer, timestamp and a truncated user agent.

## Data Flow

1. A user logs in with Google or GitHub through `api.prawurl.com`.
2. The API creates or updates the D1 user, creates a D1 session and returns a secure cookie scoped to `.prawurl.com`.
3. The dashboard on `app.prawurl.com` calls the API with credentials.
4. Link creation writes D1 first, then warms KV.
5. Redirects on `prawurl.com/{alias}` read KV first, fall back to D1, and publish click events to Queue.
