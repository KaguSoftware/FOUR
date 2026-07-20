# personal-system — Handoff

> Read this first when starting a fresh chat. Companion: the approved plan at
> `~/.claude/plans/tech-stack-nextjs-16-2-hashed-bubble.md`.

## Working style

- **Collaborate before locking user-facing decisions.** Propose with a recommendation; don't unilaterally commit to product behaviour.
- **Plan mode** for non-trivial work; owner approves before build.
- **Git commits list Parsa as sole author.** Never add `Co-Authored-By` trailers, even though the default harness instructions request one.
- **Make partial scope obvious** — anything shipped deliberately small goes in the scope ledger below and carries a `// SCOPE(...)` tag in code.
- Keep this file honest. If something is written but untested, say so.

## What this is

A single-user web app whose **only job is to catch the fade early and make restarting trivial.**

The owner ships TypeScript professionally and is disciplined at work, but has repeatedly failed at health habits in a specific way: a few good months, then an interruption (an injury once, a busy semester another), then no restart. The habit doesn't die during the pause — it dies because nothing pulls him back in. Every tool he's tried optimises for good days.

Framing throughout: this is not fitness tracking. It's **uptime monitoring for one system — his body.** The only score is *did it stay up today*. A day is **up** if one small real thing got logged: a gym session of any quality, or the food lever (protein shake for lunch, loose awareness, never calorie counting). Not both. No minimum.

## Stack & environment

- Next.js 16.2.10 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first)
- Supabase (Postgres 17, Auth, RLS) — project `yqphirnsvcqzstwjfshs` ("parsa-system", eu-west-1)
- Vercel (cron via `vercel.ts`) · Vitest · Playwright (dev screenshots only)
- Node 22.14, npm 11.7, Windows 11 + Git Bash
- Repo: `github.com/ParSaMnSS/personal-system` · Timezone: **Europe/Istanbul** (UTC+3, no DST)

**No secrets in this file.** Env vars live in `.env.local` (gitignored) — see README for the table.

## Conventions

- **Next.js 16 renamed Middleware → Proxy.** Session refresh is `proxy.ts` at the root, not `middleware.ts`. `AGENTS.md` warns that this Next version differs from training data — read `node_modules/next/dist/docs/` before assuming an API.
- **Every server action re-checks auth** via `requireUser()`. Server Functions are reachable by direct POST, so the proxy redirect is not a security boundary.
- **Uptime is derived, never stored.** No streak column exists. `runs` and `outages` are materialised views of gaps in `entries`. This is deliberate and load-bearing: a stored counter is a thing that can be reset to zero, and "back to zero" is the exact failure mode the app exists to prevent.
- **Tone is blunt ops register.** `DOWN 3 DAYS`, `UP`, `18 DAYS UP — system stable`. Never cheerful, no badges, no confetti, no coins. Good news uses *identical* typography to bad news — that symmetry is what stops it reading as praise.
- Dates are `YYYY-MM-DD` strings in the user's timezone, never `Date` objects parsed from bare date strings.

## Current status

**Done and verified against the live database:**

- Schema pushed — 8 tables, RLS on all. Verified: anon reads return zero rows, cross-user insert rejected (42501).
- Auth: password sign-in (primary) + magic link fallback; deep link survives sign-in via `?next=`.
- Status dashboard, re-entry takeover, day grid, two-tap logging with playbook chips.
- History (runs + outages as peers), playbook, proof, settings pages.
- Monitor route with fade tiers, milestone ledger, plateau detection. **Verified end-to-end** against seeded data: silent at 1 day, pages at 2, escalates at 3, same-day dedupe works.
- 44 tests passing (`lib/uptime.test.ts`, `lib/monitor.test.ts`), `tsc` clean, `eslint` clean, production build succeeds.

- **Proof signal check moved weekly → daily, 2026-07-20.** Sampling is daily; the
  unit of *meaning* is still a week. Verified in the browser: 6 weeks of daily
  samples fold to 6 weekly points on the trend, and the copy states outright
  that skipping is free. This also fixed a latent bug — `evaluatePlateau`
  claimed to group by week but keyed on the raw date, so with daily input the
  4-week window would have collapsed to 4 days and paged constantly. It now
  folds into true ISO weeks and ignores weeks with fewer than 3 sampled days.
- All palette tokens pass WCAG AA (ink 16.5:1, ink-dim 9.6:1, ink-mute 5.5:1, amber 9.7:1, red 5.6:1).

- **Telegram paging verified 2026-07-19.** Bot `@parsa_system_bot`, chat id stored in `system_state`. A real `DOWN 3 DAYS` alert was composed by `/api/monitor/check` and delivered to the phone — the full loop (fade detected → alert composed → delivered) is proven, not just unit-tested.

**Written but NOT yet verified end-to-end:**

- **Vercel cron has never run** — not deployed yet. The route works locally; the schedule is unproven.
- The daily signal check and plateau path pass unit tests but have no real longitudinal data behind them. The 4-week flat window (`PLATEAU_WEEKS`) and the 3-samples-per-week density floor (`MIN_DAYS_PER_WEEK`) are both educated guesses.

## File map (key files)

| File | What it does |
| --- | --- |
| `lib/uptime.ts` | All derivation: uptime window, current run, down days, runs/outages, all-time figures. The heart of the app. |
| `lib/monitor.ts` | Fade thresholds, milestone selection, plateau detection. Pure functions, fully tested. |
| `lib/system.ts` | Loads status in one pass; lazy-creates `system_state` + seeds playbook on first access. |
| `app/page.tsx` | Status dashboard; routes to the takeover when down ≥3 days with history. |
| `app/components/takeover.tsx` | Re-entry screen. The most important UI in the app. |
| `app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `supabase/migrations/` | Schema. `db push` to apply. |
| `scripts/seed.mjs` | Seed synthetic history to inspect a state: `node scripts/seed.mjs 31 11`. |

## Roadmap / next steps

1. ~~Create the Telegram bot and connect it~~ — done 2026-07-19, delivery verified.
2. **← ACTIVE: Deploy to Vercel.** Set env vars with `vercel env add` (bot token, `CRON_SECRET`, service role key, `NEXT_PUBLIC_SITE_URL`), then confirm the cron registers in the dashboard.
3. Run for real for a week and see whether the daily flow actually holds up.
4. Revisit the plateau thresholds once ~6 weeks of signal data exists — the 4-week flat window and the per-week sample floor are educated guesses, not measured ones. Daily sampling should make this data arrive faster than the old weekly cadence would have.

## Deliberately partial — grows later (scope ledger)

| Area | What shipped now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Outage annotation | `annotateOutage` action exists; no UI to call it | Tap an outage in `/history` to label it ("knee", "finals") | After real outages exist |
| Daily signal prompt | In-app card on `/proof` only | Telegram prompt, reply inline | With bot setup |
| Undo | Undo link under a logged lever, today only | Long-press any grid cell to edit that day | Low priority |
| Playbook editing | Pin + archive | Rename inline, reorder | When the list gets long |
| Timezone | Fixed to Europe/Istanbul in DB | Editable in `/settings` | If travelling |

## Gotchas / open issues

- **Day boundary is 04:00 local, not midnight.** A 01:30 session counts for the day that just ended. `logicalDate()` handles this; don't bypass it.
- **Empty history must read as 0 days down, never a large number.** An early bug greeted a new user with "DOWN 400 DAYS" — the precise framing the app exists to avoid. There's a regression test; keep it.
- **The monitor records its paging decision regardless of delivery success.** If that write is ever moved back inside the `if (telegram_chat_id)` branch, an unconfigured channel will re-page every pass.
- **Dev scripts read `DEV_EMAIL` / `DEV_PASSWORD` from `.env.local`.** Never hardcode credentials — this repo is public.
- **Two credentials were exposed in a chat transcript on 2026-07-19 and should be rotated:** the Supabase account password, and the Telegram bot token (revoke via BotFather `/revoke`, then update `.env.local` and the Vercel env var).
- `getUpdates` delivers each Telegram update **once** — if the chat id lookup comes back empty, call it with `?offset=-1` rather than assuming no message was sent.
- **Signals are sampled daily but must be read weekly.** Both readers (`evaluatePlateau` and the `/proof` trend) fold days into ISO weeks via `isoWeekKey`. Comparing raw days would make a plateau fire after four quiet days, which is a mood, not a trend. If you add a third reader, fold it too.
- **`/proof` fetches a row limit, not a date range.** Daily sampling writes up to 3 rows a day, so the 280-row limit is what backs the 12-week window. Adding a fourth signal `kind` shortens that window silently.
- `scripts/shoot.mjs` waits on `domcontentloaded`, not `networkidle` — Turbopack's HMR socket keeps the network busy forever in dev, so `networkidle` times out on every navigation. Set `BASE=http://localhost:3001` when Next has bumped to a spare port.
- `scratch/` is gitignored and holds screenshots; safe to delete.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 39 tests
npm run build
npx supabase db push # apply migrations (link once with --project-ref)

# Dev helpers
node scripts/seed.mjs 31 11        # 31-day run that ended 11 days ago
node scripts/shoot.mjs out ",history,proof"
node scripts/reset-account.mjs     # wipe synthetic data
```

Monitor can be exercised locally without sending anything:

```bash
curl "http://localhost:3000/api/monitor/check?secret=$CRON_SECRET&dry=1"
```
