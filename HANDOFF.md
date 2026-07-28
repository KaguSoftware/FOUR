# uptime — Handoff

> Read this first when starting a fresh chat. Companion: the approved plan at
> `~/.claude/plans/i-got-this-web-majestic-bee.md` (web → native mobile).

## Working style

- **Collaborate before locking user-facing decisions.** Propose with a recommendation; don't unilaterally commit to product behaviour.
- **Plan mode** for non-trivial work; owner approves before build.
- **Git commits list Parsa as sole author.** Never add `Co-Authored-By` trailers, even though the default harness instructions request one.
- **Make partial scope obvious** — anything shipped deliberately small goes in the scope ledger below and carries a `// SCOPE(...)` tag in code.
- Keep this file honest. If something is written but untested, say so.

## What this is

A product whose **only job is to catch the fade early and make restarting trivial.**

The owner ships TypeScript professionally and is disciplined at work, but has repeatedly failed at health habits in a specific way: a few good months, then an interruption (an injury once, a busy semester another), then no restart. The habit doesn't die during the pause — it dies because nothing pulls him back in. Every tool he's tried optimises for good days.

Framing throughout: this is not fitness tracking. It's **uptime monitoring for one system — a body.** The only score is *did it stay up today*. A day is **up** if one small real thing got logged. Not all of them. No minimum.

**As of 2026-07-28 it is becoming a real mobile product**: multi-user accounts, up to four user-defined levers, native push, App Store + Play. The web app remains the reference implementation.

## Locked decisions (2026-07-28)

| Question | Decision |
| --- | --- |
| Mobile stack | **Expo + React Native**; native widget targets later |
| Team | Owner on TypeScript; teammates available for native work + macOS |
| Audience | **Real public product** — open signups, both stores |
| Uptime rule with 4 levers | **Unchanged — any one lever still counts** |
| Alerts | **Native push only.** Telegram retired after transition |
| Daily reminder | **Silent by default**, opt-in toggle in Settings |
| v1 scope | Core + history. **`/proof`, signals and plateau detection cut from v1** |
| Onboarding | One screen: state the rule, then pick 1–4 levers |
| Repo | **Monorepo**, shared derivation core |
| Auth | Email 6-digit code · Sign in with Apple · Google · email + password |
| Widget | **After launch (v1.1+)** |
| Money | Free for v1 |
| Name | Keep `uptime` for now; branding pending. Bare "Uptime" is likely taken on the App Store |
| Tone | **Keep the blunt ops register exactly** |
| Lever edits | **Rename freely; archive never deletes** |
| First milestone | **Design-led** — settle the mobile identity before building |

**Why Expo, in one line:** widgets are native in *every* scenario (WidgetKit is SwiftUI-only; Android widgets are Kotlin/Glance), so the real choice was 1 app codebase + 1 derivation engine versus 2 app codebases + 3 derivation engines.

## Stack & environment

- **Monorepo** on npm workspaces: `packages/core`, `apps/web`, `apps/mobile` (not built yet)
- Next.js 16.2.10 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first)
- Supabase (Postgres 17, Auth, RLS) — project `yqphirnsvcqzstwjfshs` ("parsa-system", eu-west-1)
- Vercel (cron via `apps/web/vercel.ts`) · Vitest · Playwright (dev screenshots only)
- Node 24.15, npm 11.16, Windows 11 + Git Bash
- Repo: **`github.com/KaguSoftware/uptime`** (`origin`, and the only remote)
  — this is `ParSaMnSS/personal-system` **transferred** to the Kagu org on
  2026-07-28, not a new repo, so the full history came with it and GitHub
  redirects the old URL.
- **Vercel: Root Directory must be `apps/web`**, and *"Include files outside the
  root directory in the Build Step"* must stay **enabled** — without it Vercel
  uploads only `apps/web` and the build dies on `@uptime/core` not resolving.
- Timezone: **Europe/Istanbul** (UTC+3, no DST) — becomes device-detected for public users

**No secrets in this file.** Env vars live in `apps/web/.env.local` (gitignored) — see README for the table.

## Conventions

- **`packages/core` is the derivation engine and must exist exactly once.** Consumed as TypeScript source (`transpilePackages` on web, Metro on mobile) — no build step, no publish cycle, no version skew. Its `tsconfig.json` omits the `dom` lib deliberately, so "renderer-agnostic" is a compile error rather than a review catch.
- **Next.js 16 renamed Middleware → Proxy.** Session refresh is `apps/web/proxy.ts`, not `middleware.ts`. `AGENTS.md` warns that this Next version differs from training data — read `node_modules/next/dist/docs/` before assuming an API.
- **Every server action re-checks auth** via `requireUser()`. Server Functions are reachable by direct POST, so the proxy redirect is not a security boundary.
- **Uptime is derived, never stored.** No streak column exists. This is deliberate and load-bearing: a stored counter is a thing that can be reset to zero, and "back to zero" is the exact failure mode the app exists to prevent.
- **Tone is blunt ops register.** `DOWN 3 DAYS`, `UP`, `18 DAYS UP — system stable`. Never cheerful, no badges, no confetti, no coins. Good news uses *identical* typography to bad news — that symmetry is what stops it reading as praise.
- Dates are `YYYY-MM-DD` strings in the user's timezone, never `Date` objects parsed from bare date strings.
- **Server Actions do not port to mobile.** `apps/web/app/actions.ts` is Next-specific; the mobile client talks straight to Supabase, with RLS as the security boundary.

## Current status

**Done and verified:**

- Schema pushed — 8 tables, RLS on all. Verified: anon reads return zero rows, cross-user insert rejected (42501).
- Auth: password sign-in (primary) + magic link fallback; deep link survives sign-in via `?next=`.
- Status dashboard, re-entry takeover, day grid, two-tap logging with playbook chips.
- History (runs + outages as peers), playbook, proof, settings pages.
- Monitor route with fade tiers, milestone ledger, plateau detection. **Verified end-to-end** against seeded data: silent at 1 day, pages at 2, escalates at 3, same-day dedupe works.
- **Telegram paging verified 2026-07-19.** Bot `@parsa_system_bot`. A real `DOWN 3 DAYS` alert was composed by `/api/monitor/check` and delivered to the phone — the full loop is proven, not just unit-tested.
- **Proof signal check moved weekly → daily, 2026-07-20.** Sampling is daily; the unit of *meaning* is still a week. This also fixed a latent bug — `evaluatePlateau` claimed to group by week but keyed on the raw date, so with daily input the 4-week window would have collapsed to 4 days and paged constantly.
- All palette tokens pass WCAG AA (ink 16.5:1, ink-dim 9.6:1, ink-mute 5.5:1, amber 9.7:1, red 5.6:1).
- **Monorepo restructure, 2026-07-28.** `lib/uptime.ts` + `lib/monitor.ts` → `packages/core` as `@uptime/core`; Next app → `apps/web`. Verified after the move: **44/44 tests green, `tsc` clean in both workspaces, production build emits an identical route table, eslint clean.**

**Written but NOT yet verified end-to-end:**

- **Vercel cron has never run** — the route works locally; the schedule is unproven.
- The daily signal check and plateau path pass unit tests but have no real longitudinal data behind them. `PLATEAU_WEEKS` (4) and `MIN_DAYS_PER_WEEK` (3) are educated guesses.

**Blocked / needs the owner:**

- **The monorepo has not been pushed.** `git push -u origin main` was blocked by the permission classifier. The commit exists locally (`chore: restructure into monorepo, extract @uptime/core`). Either grant the permission or push manually.
- **Vercel still builds from the old repo.** After the push, reconnect the project to `KaguSoftware/uptime-app` and set **Root Directory = `apps/web`**, or the build will not find the Next app. Do not disconnect the old one until the new build is green — the live app is in daily use.

## File map (key files)

| File | What it does |
| --- | --- |
| `packages/core/uptime.ts` | All derivation: uptime window, current run, down days, runs/outages, all-time figures. The heart of the product. |
| `packages/core/monitor.ts` | Fade thresholds, milestone selection, plateau detection. Pure functions, fully tested. |
| `packages/core/index.ts` | Barrel export — the single public surface of the engine. |
| `apps/web/lib/system.ts` | Loads status in one pass; lazy-creates `system_state` + seeds playbook on first access. Web-local (imports `next/headers`). |
| `apps/web/app/page.tsx` | Status dashboard; routes to the takeover when down ≥3 days with history. |
| `apps/web/app/components/takeover.tsx` | Re-entry screen. The most important UI in the product. |
| `apps/web/app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `apps/web/proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `apps/web/vercel.ts` | Cron schedule. Lives inside the app dir because Vercel's Root Directory points there. |
| `supabase/migrations/` | Schema. `db push` to apply. |
| `scripts/seed.mjs` | Seed synthetic history to inspect a state: `npm run seed -- 31 11`. |

## Roadmap / next steps

1. ~~Telegram bot connected and delivery verified~~ — done 2026-07-19.
2. ~~Monorepo restructure, `@uptime/core` extracted~~ — done 2026-07-28, fully verified.
3. **← ACTIVE: push to `KaguSoftware/uptime-app`, then reconnect Vercel** (Root Directory `apps/web`) and confirm the live deploy is still green.
4. **Design-led foundation** — PRODUCT.md + DESIGN.md, port the oklch tokens to RN-safe values with contrast re-verified, then design the mobile surfaces (onboarding, dashboard at 1–4 levers, takeover, lever sheet).
5. **Spike the risks** in parallel: Hermes `Intl` timezone on a physical Android device; Supabase session persistence in Expo; one real push notification delivered.
6. `Lever = string` in `packages/core` + `levers.ts`. **The 44 tests staying green is the gate for the whole custom-lever feature.**
7. Schema migration: `levers` table, drop the `gym`/`food` CHECKs, backfill, `push_token`, account deletion.
8. Build the Expo app · push replaces Telegram · offline outbox · store prep.

## Deliberately partial — grows later (scope ledger)

| Area | What shipped now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Levers | Hardcoded `gym`/`food`, CHECK-constrained in SQL and a TS union | Up to 4 user-defined levers; stable key + renameable label | Next — the headline feature |
| `/proof`, signals, plateau | Built and shipping on web | Ported to mobile | **v1.1** — thresholds are untested guesses today |
| Widgets | None | Interactive Home/Lock Screen widget: tap a lever without opening the app | **v1.1** — SwiftUI + Glance targets, App Groups |
| Alerts | Telegram | Native push, same escalation ladder | Phase 4 |
| Outage annotation | `annotateOutage` action exists; no UI to call it | Tap an outage in `/history` to label it ("knee", "finals") | After real outages exist |
| Undo | Undo link under a logged lever, today only | Long-press any grid cell to edit that day | Low priority |
| Playbook editing | Pin + archive | Rename inline, reorder | When the list gets long |
| Timezone | Defaults to Europe/Istanbul in DB | Device-detected at signup, editable in Settings | With mobile |
| Monetization | Free | Undecided | Post-launch |

## Gotchas / open issues

- **Day boundary is 04:00 local, not midnight.** A 01:30 session counts for the day that just ended. `logicalDate()` handles this; don't bypass it.
- **`logicalDate()` depends on `Intl.DateTimeFormat("en-CA", { timeZone })`.** This is the **highest-risk unknown for mobile** — if Hermes lacks full ICU on Android, every date silently shifts by a day, which is the worst possible failure for this product. Verify on a physical device before building on it. Fallback: compute `today` server-side via the existing `public.logical_date(tz)` Postgres function.
- **Empty history must read as 0 days down, never a large number.** An early bug greeted a new user with "DOWN 400 DAYS" — the precise framing the app exists to avoid. There's a regression test; keep it.
- **Archiving a lever must never change past uptime.** Entries are never deleted; the day grid and the 30-day number must be byte-identical afterward. This is the invariant that makes "rename freely, archive never deletes" safe.
- **The monitor records its paging decision regardless of delivery success.** If that write is ever moved back inside the "has a channel" branch, an unconfigured channel will re-page every pass.
- **Two credentials were exposed in a chat transcript on 2026-07-19 and should be rotated:** the Supabase account password, and the Telegram bot token (revoke via BotFather `/revoke`, then update `apps/web/.env.local` and the Vercel env var). Verified 2026-07-28: **no `.env` file was ever committed**, so git history is clean — the exposure was transcript-only.
- **Signals are sampled daily but must be read weekly.** Both readers (`evaluatePlateau` and the `/proof` trend) fold days into ISO weeks via `isoWeekKey`. Comparing raw days would make a plateau fire after four quiet days, which is a mood, not a trend. If you add a third reader, fold it too.
- **`/proof` fetches a row limit, not a date range.** Daily sampling writes up to 3 rows a day, so the 280-row limit is what backs the 12-week window. Adding a fourth signal `kind` shortens that window silently.
- **`.env.local` lives at `apps/web/.env.local`, not the repo root.** That is where Next looks; `scripts/_session.mjs` resolves the same file relative to its own location so there is only ever one copy of the secrets.
- **`.gitignore` patterns are deliberately un-anchored.** A root-anchored `/node_modules` would silently stop ignoring `apps/web/.next`.
- `scripts/shoot.mjs` waits on `domcontentloaded`, not `networkidle` — Turbopack's HMR socket keeps the network busy forever in dev, so `networkidle` times out on every navigation. Set `BASE=http://localhost:3001` when Next has bumped to a spare port.
- `scratch/` is gitignored and holds screenshots; safe to delete.

## Running it

```bash
npm install          # installs every workspace
npm run dev          # apps/web on http://localhost:3000
npm test             # packages/core — 44 tests
npm run typecheck    # both workspaces
npm run lint
npm run build
npx supabase db push # apply migrations (link once with --project-ref)

# Dev helpers (credentials from apps/web/.env.local)
npm run seed -- 31 11             # 31-day run that ended 11 days ago
npm run shoot -- out ",history,proof"
npm run reset                     # wipe synthetic data
```

Monitor can be exercised locally without sending anything:

```bash
curl "http://localhost:3000/api/monitor/check?secret=$CRON_SECRET&dry=1"
```
