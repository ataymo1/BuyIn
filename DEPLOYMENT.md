# Deployment

The Next.js application runs on Vercel. Live table WebSockets and authoritative poker state run in a separate Cloudflare Worker backed by a Durable Object. Vercel does not need a Durable Object binding.

## Prerequisites

- Node.js 22+ and pnpm 10
- A production Convex deployment
- A Cloudflare account with Workers and Durable Objects enabled
- A stable, unprotected Vercel production domain for Worker callbacks
- Google OAuth configured with `https://<vercel-domain>/api/auth/callback/google`

Generate three independent random secrets:

- `LIVE_POKER_JWT_SECRET`: Vercel and Cloudflare
- `LIVE_POKER_WEBHOOK_SECRET`: Vercel and Cloudflare
- `LIVE_POKER_CONVEX_SECRET`: Vercel and Convex

Do not expose any of these as `NEXT_PUBLIC_*` variables.

## 1. Deploy Convex

Set `LIVE_POKER_CONVEX_SECRET` in the production Convex deployment, then deploy:

```bash
pnpm deploy:convex
```

Set `NEXT_PUBLIC_CONVEX_URL` on Vercel to that production deployment URL.

## 2. Configure and deploy Cloudflare

`wrangler.jsonc` binds `LIVE_POKER_TABLE` to `LivePokerTableDurableObject` and includes the SQLite Durable Object migration. Configure these Worker secrets/variables in the Cloudflare dashboard or with `pnpm exec wrangler secret put <NAME>`:

```text
LIVE_POKER_ALLOWED_ORIGINS=https://<vercel-domain>
LIVE_POKER_JWT_SECRET=<same value as Vercel>
LIVE_POKER_WEBHOOK_SECRET=<same value as Vercel>
LIVE_POKER_WEBHOOK_URL=https://<vercel-domain>/api/live-poker/record-hand
LIVE_POKER_SETTLEMENT_URL=https://<vercel-domain>/api/live-poker/settle-player
LIVE_POKER_TURN_TIMEOUT_SECONDS=20
```

Multiple allowed origins are comma-separated. Do not include a trailing slash. Deploy:

```bash
pnpm deploy:worker
```

Verify `https://<worker-host>/health` returns `{ "ok": true, ... }`. The public browser URL uses `wss://<worker-host>`; the server URL uses `https://<worker-host>`.

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
LIVE_POKER_WEBHOOK_SECRET=<same value as Cloudflare>
LIVE_POKER_CONVEX_SECRET=<same value as Convex>
```

`NEXT_PUBLIC_LIVE_POKER_WORKER_URL` is embedded at build time, so redeploy Vercel after changing it.

The Worker must be able to call the hand and settlement API routes. Point callbacks at an unprotected production domain; Vercel Deployment Protection on a preview URL will block them.

## Preview isolation

Do not connect Vercel previews to the production Worker. A preview must use a separately named Worker/Durable Object deployment, separate secrets, a preview Convex deployment, and callback URLs that Cloudflare can access. Otherwise preview table IDs and state can mix with production.

## Release smoke test

1. Sign in through Google.
2. Create a table and connect two browser sessions.
3. Approve an initial buy-in and play a complete hand.
4. Confirm the hand appears in Convex.
5. Leave seats or close the table between hands and confirm settlements appear.
6. Reconnect a browser and confirm the table state is restored from the Durable Object.

Local development uses `.env.local` for Next.js and `.dev.vars` for Wrangler. Start from `env.example` and `.dev.vars.example`; neither real secrets file is committed.
