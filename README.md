# uptime

Uptime monitor for one body.

The only score is uptime: did the system stay up today. A day is **up** if one
small real thing got logged — a gym session of any quality, or the food lever.
Not both. No minimum. The bar is deliberately low, because a low bar is the
only kind that survives a busy week.

This is not a habit tracker. Habit trackers optimise for good days. This one
has a single job: **catch the fade early and make restarting trivial.**

## The two failure modes it watches

1. **The fade** — you stop logging. Caught by the daily monitor, which pages
   you at 2 days down (3 in slammed mode), escalates at 3 with your playbook
   attached, and drops to weekly past a week so it never becomes noise you mute.

2. **The plateau** — you're logging every day while return-on-effort goes flat.
   Invisible to uptime, and the state a long run actually dies in. Caught by
   comparing felt-state signals — sampled daily, read as weekly averages —
   against sustained high uptime.

## Design rules

- **Uptime is the hero, and it cannot crash to zero.** A 30-day rolling window
  degrades gracefully: three missed days move 24/30 to 21/30. A dent, not a
  wipe.
- **No streak counter.** Runs and outages are derived from the gaps in
  `entries` — there is no stored number to reset. A completed run keeps its
  final length forever, so the re-entry screen says `last run: 31 days` instead
  of showing a zero.
- **A break is an outage, not a failure.** Outages are incidents with a start
  date and an optional note ("knee", "finals"). History is never truncated.
- **Good news uses the same voice as bad news.** Milestones fire once ever, at
  most one per week, in the same flat register as an alert. No badges, no
  confetti, no coins.
- **No weight, no calories, no charts** — except one trend on `/proof`, where a
  trend is the actual information.

## Repo layout

A monorepo, so the derivation engine exists exactly once.

```
packages/core/     @uptime/core — uptime, runs, outages, fade tiers, milestones.
                   Pure TypeScript. No React, no Next, no DOM. 44 tests.
apps/web/          Next.js 16.2 App Router client. Live on Vercel.
apps/mobile/       Expo / React Native client. Not built yet.
supabase/          Migrations. One database, shared by every client.
scripts/           Dev helpers — seed, reset, screenshot.
```

`packages/core` is consumed as **TypeScript source**, not a built artifact:
`apps/web` lists it in `transpilePackages`, and Metro will do the same for
mobile. No build step, no publish cycle, and no window in which two clients
disagree about how many days the system has been up.

Its `tsconfig.json` omits the `dom` lib on purpose. Reaching for `document` or
`window` inside the engine is a compile error, not a code review catch.

## Stack

Next.js 16.2 (App Router) · Supabase (Postgres + Auth + RLS) · Vercel ·
TypeScript · Vitest · npm workspaces

Note: Next.js 16 renamed Middleware to Proxy — session refresh lives in
`apps/web/proxy.ts`, not `middleware.ts`.

## Setup

```bash
npm install          # installs every workspace
npm run dev          # apps/web on http://localhost:3000
```

Environment variables go in **`apps/web/.env.local`** (gitignored) — that's
where Next.js looks, and the dev scripts resolve the same file so there is only
ever one copy of the secrets.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, for the cron route |
| `CRON_SECRET` | Authenticates `/api/monitor/check` |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `NEXT_PUBLIC_SITE_URL` | Base URL for deep links in pages |
| `DEV_EMAIL` / `DEV_PASSWORD` | Dev scripts only |

The Telegram chat id is stored per user and set from `/settings`, which also
has a "send test page" button — a pager you have never seen fire is not a
pager.

## Database

Migrations live in `supabase/migrations/`.

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Every table is scoped by `user_id` with an `auth.uid() = user_id` RLS policy,
so the schema is already multi-tenant. "Single user" is a product framing, not
an enforced constraint.

## Tests

```bash
npm test             # packages/core — 44 tests
npm run typecheck    # both workspaces
npm run lint
```

`packages/core/uptime.test.ts` covers the derivation, including the anti-shame
invariants the rest of the design rests on: no screen renders a zero for run
length, all-time figures are monotonic, and 30-day uptime never drops more than
1/30 per elapsed day. `packages/core/monitor.test.ts` covers the fade tiers,
slammed-mode thresholds, milestone dedupe, and plateau detection.

**These tests gate everything.** Any change to the engine that reds them is a
change to the one guarantee the product cannot get wrong.

## Dev scripts

Read `DEV_EMAIL` / `DEV_PASSWORD` from `apps/web/.env.local`.

```bash
npm run seed -- 31 11    # 31-day run that ended 11 days ago
npm run reset            # wipe synthetic data
npm run shoot -- out ",history,proof"
```

Exercise the monitor locally without sending anything:

```bash
curl "http://localhost:3000/api/monitor/check?secret=$CRON_SECRET&dry=1"
```

## Where this is going

The web app is the reference implementation. The product is becoming a real
mobile app: multi-user accounts, up to four **user-defined** levers instead of
the hardcoded `gym`/`food` pair, and native push replacing Telegram — with the
escalation ladder unchanged. See `HANDOFF.md` for current status and the
scope ledger.
