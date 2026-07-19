# personal-system

Uptime monitor for one body. Single user.

The only score is uptime: did the system stay up today. A day is **up** if one
small real thing got logged — a gym session of any quality, or the food lever.
Not both. No minimum. The bar is deliberately low, because a low bar is the
only kind that survives a busy week.

This is not a habit tracker. Habit trackers optimise for good days. This one
has a single job: **catch the fade early and make restarting trivial.**

## The two failure modes it watches

1. **The fade** — you stop logging. Caught by the daily monitor, which pages
   you on Telegram at 2 days down (3 in slammed mode), escalates at 3 with your
   playbook attached, and drops to weekly past a week so it never becomes noise
   you mute.

2. **The plateau** — you're logging every day while return-on-effort goes flat.
   Invisible to uptime, and the state a long run actually dies in. Caught by
   comparing weekly felt-state signals against sustained high uptime.

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

## Stack

Next.js 16.2 (App Router) · Supabase (Postgres + Auth + RLS) · Vercel · TypeScript

Note: Next.js 16 renamed Middleware to Proxy — session refresh lives in
`proxy.ts`, not `middleware.ts`.

## Setup

```bash
npm install
npm run dev
```

Required environment variables in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, for the cron route |
| `CRON_SECRET` | Authenticates `/api/monitor/check` |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `NEXT_PUBLIC_SITE_URL` | Base URL for deep links in pages |

The Telegram chat id is stored per user and set from `/settings`, which also
has a "send test page" button — a pager you have never seen fire is not a
pager.

## Database

Migrations live in `supabase/migrations/`.

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## Tests

```bash
npm test
```

`lib/uptime.test.ts` covers the derivation, including the anti-shame invariants
the rest of the design rests on: no screen renders a zero for run length,
all-time figures are monotonic, and 30-day uptime never drops more than 1/30
per elapsed day. `lib/monitor.test.ts` covers the fade tiers, slammed-mode
thresholds, milestone dedupe, and plateau detection.

## Dev scripts

Read credentials from `DEV_EMAIL` / `DEV_PASSWORD` in `.env.local`.

```bash
node scripts/seed.mjs 31 11    # 31-day run that ended 11 days ago
node scripts/shoot.mjs out ",history,proof"
node scripts/reset-account.mjs
```
