# Deployment

The Next.js application runs on Vercel. Live table WebSockets and authoritative poker state run in a separate Cloudflare Worker backed by a Durable Object. Vercel does not need a Durable Object binding.

## Prerequisites

- Node.js 22+ and pnpm 10
- A production Convex deployment
- A **dedicated Cloudflare Workers Free account** with Durable Objects enabled, no paid Workers subscription, and no payment method needed for this project
- A stable, unprotected Vercel production domain for Worker callbacks
- Google OAuth configured with `https://<vercel-domain>/api/auth/callback/google`

Generate four independent random secrets:

- `LIVE_POKER_JWT_SECRET`: Vercel and Cloudflare token signing
- `LIVE_POKER_CONTROL_SECRET`: Vercel-to-Cloudflare claim/close/recovery calls
- `LIVE_POKER_WEBHOOK_SECRET`: Cloudflare-to-Vercel hand/settlement callbacks
- `LIVE_POKER_CONVEX_SECRET`: Vercel and Convex

Do not expose any of these as `NEXT_PUBLIC_*` variables.

## 1. Deploy Convex

Set `LIVE_POKER_CONVEX_SECRET` in the production Convex deployment, then deploy:

```bash
pnpm deploy:convex
```

Set `NEXT_PUBLIC_CONVEX_URL` on Vercel to that production deployment URL.

## 2. Configure and deploy Cloudflare

### Zero-cost requirement

This application is designed for the Workers Free plan. Do not deploy it into an account with Workers Paid enabled: Workers Paid has a monthly minimum and usage overages. Free-plan limits fail closed when exhausted instead of creating usage charges. Budget alerts are notifications only and are **not** spending caps.

Use a dedicated Free account so another project cannot upgrade the shared account or consume this application's allowance. Before every deployment, verify **Workers & Pages > Plans** still shows Free. Never enable Workers Paid for this account.

The guarded deployment command requires the selected account ID to match the approved Free account:

```bash
export CLOUDFLARE_ACCOUNT_ID=<dedicated-free-account-id>
export CLOUDFLARE_ZERO_COST_ACCOUNT_ID=<same-account-id>
export CLOUDFLARE_ZERO_COST_ACK=workers-free-hard-limits
export CLOUDFLARE_BILLING_READ_TOKEN=<account-scoped-billing-read-token>
```

Create the billing token with only **Account > Billing > Read** for this account. `pnpm deploy:worker` fails unless the account IDs match and Cloudflare's subscriptions API reports no positive-price or non-Free Workers subscription. Do not bypass the guard with a direct `wrangler deploy`. This checks deployment-time state; it cannot prevent someone from upgrading the account later in the dashboard, so the dedicated-account rule still matters.

Current Cloudflare references:

- Workers pricing and Free limits: <https://developers.cloudflare.com/workers/platform/pricing/>
- Durable Object pricing and Free limits: <https://developers.cloudflare.com/durable-objects/platform/pricing/>
- Budget alerts do not cap usage: <https://developers.cloudflare.com/billing/manage/budget-alerts/>
- Account subscriptions API used by the deploy guard: <https://developers.cloudflare.com/api/resources/accounts/subresources/subscriptions/methods/get/>

### Worker configuration

`wrangler.jsonc` binds `LIVE_POKER_TABLE` to `LivePokerTableDurableObject`, includes the SQLite Durable Object migration, caps CPU at the Free-plan limit, disables persisted observability, and configures IP/user rate-limit bindings. Configure these Worker secrets/variables in the Cloudflare dashboard or with `pnpm exec wrangler secret put <NAME>`:

```text
LIVE_POKER_ALLOWED_ORIGINS=https://<vercel-domain>
LIVE_POKER_JWT_SECRET=<same value as Vercel>
LIVE_POKER_CONTROL_SECRET=<same control value as Vercel>
LIVE_POKER_WEBHOOK_SECRET=<same callback value as Vercel>
LIVE_POKER_WEBHOOK_URL=https://<vercel-domain>/api/live-poker/record-hand
LIVE_POKER_SETTLEMENT_URL=https://<vercel-domain>/api/live-poker/settle-player
LIVE_POKER_TURN_TIMEOUT_SECONDS=20
```

Multiple allowed origins are comma-separated. Do not include a trailing slash. The guarded deployment retains dashboard-managed runtime variables; do not remove its `--keep-vars` protection. Deploy:

```bash
pnpm deploy:worker
```

Verify `https://<worker-host>/health` returns `{ "ok": true, ... }`. The public browser URL uses `wss://<worker-host>`; the server URL uses `https://<worker-host>`.

The code also limits connections and WebSocket messages, authenticates before Durable Object dispatch, stops unattended tables, bounds webhook retries, and deletes closed-object storage after successful delivery. A callback that reaches a permanent error or exhausts retries is dead-lettered and pauses the table instead of retrying forever. After fixing the callback, retry a table manually:

```bash
curl -X POST \
  -H "x-live-poker-secret: <LIVE_POKER_CONTROL_SECRET>" \
  "https://<worker-host>/live-poker/<table-id>/retry-dead-letters"
```

Treat this secret and command as an operator-only recovery mechanism.

## 3. Configure and deploy Vercel

Configure these Production environment variables before the final Vercel build:

```text
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://<vercel-domain>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_CONVEX_URL=https://<production>.convex.cloud
NEXT_PUBLIC_LIVE_POKER_WORKER_URL=wss://<worker-host>
LIVE_POKER_WORKER_URL=https://<worker-host>
LIVE_POKER_JWT_SECRET=<same value as Cloudflare>
LIVE_POKER_CONTROL_SECRET=<same control value as Cloudflare>
LIVE_POKER_WEBHOOK_SECRET=<same callback value as Cloudflare>
LIVE_POKER_CONVEX_SECRET=<same value as Convex>
```

`NEXT_PUBLIC_LIVE_POKER_WORKER_URL` is embedded at build time, so redeploy Vercel after changing it.

The Worker must be able to call the hand and settlement API routes. Point callbacks at an unprotected production domain; Vercel Deployment Protection on a preview URL will block them.

## Preview isolation

Do not connect Vercel previews to the production Worker. A preview must use a separately named Worker/Durable Object deployment, separate secrets, a preview Convex deployment, and callback URLs that Cloudflare can access. Otherwise preview table IDs and state can mix with production.

## Operational limits and emergency stop

- The deployment can have at most 10 open tables. One user can have at most 3 open tables, hold active access grants for at most 3 tables, and create at most 10 tables in a rolling 24-hour window.
- One table accepts at most 36 WebSockets and 3 WebSockets per user.
- The Worker asks Cloudflare's approximate rate-limit binding to admit 120 requests/minute per source IP and 12 WebSocket handshakes/minute per authenticated user. These counters are per-location, permissive, and eventually consistent—not strict quotas—and rejected requests still count as Worker invocations. The Durable Object separately enforces hard per-instance connection and message limits.
- A table does not start another hand unless at least two eligible players are connected. It auto-pauses after 6 consecutive timed-out actions and has a hard 250-hand lifetime; close it and create a new table to continue.
- Webhook requests time out after 10 seconds. Transient retries use minute-to-hour backoff, stop after 12 attempts, and write only the changed outbox item.
- Closed Durable Object storage is deleted after a 10-minute token-expiry buffer once every settlement is delivered. Dead letters intentionally retain state for manual recovery without scheduling more alarms.

If abuse or unexpected quota consumption appears, use **Workers & Pages > buyin-live-poker > Settings > Disable** (or remove its route/domain) immediately. Free-plan exhaustion can make live poker unavailable until quotas reset, but it should not create an overage bill.

This repository cannot determine whether real-money poker is lawful in a deployment jurisdiction. If tables represent actual wagering rather than a private/play-money ledger, get jurisdiction-specific legal review before deployment; platform usage controls do not remove account-suspension risk from unlawful use.

## Release smoke test

1. Sign in through Google.
2. Create a table and connect two browser sessions.
3. Approve an initial buy-in and play a complete hand.
4. Confirm the hand appears in Convex.
5. Leave seats or close the table between hands and confirm settlements appear.
6. Reconnect a browser and confirm the table state is restored from the Durable Object.

Local development uses `.env.local` for Next.js and `.dev.vars` for Wrangler. Start from `env.example` and `.dev.vars.example`; neither real secrets file is committed.
