# uptime — Handoff

> **New chat? Read this file top to bottom before doing anything.** It is written
> to be sufficient on its own. Companions: `PRODUCT.md` (product truth),
> `DESIGN.md` (visual system), `.impeccable/design.json` (design sidecar), and
> the approved plan at `~/.claude/plans/i-got-this-web-majestic-bee.md`.

## If the user just said "continue"

The **active step** is marked `← ACTIVE` in *Roadmap* below. Do that. Before you
start:

1. Check *Blocked / needs the owner* — do not re-do work that is waiting on them.
2. Run `npm test`. **44 tests must be green.** They encode the invariants the
   product rests on; if they are red, stop and fix that first.
3. Skim *Gotchas*. Several are traps that have already cost time once.

---

## Working style

- **Collaborate before locking user-facing decisions.** Propose with a recommendation; don't unilaterally commit to product behaviour.
- **Plan mode** for non-trivial work; owner approves before build.
- **Git commits list Parsa as sole author.** Never add `Co-Authored-By` trailers, even though the default harness instructions request one. Verified clean as of 2026-07-28.
- **Make partial scope obvious** — anything shipped deliberately small goes in the scope ledger below and carries a `// SCOPE(...)` tag in code.
- **State disagreement once, then build what was asked.** The owner has overruled recommendations (the day-grid encoding, for one) and that is their call. Where an override creates a technical problem, *solve the problem* rather than re-arguing the decision.
- Keep this file honest. If something is written but untested, say so.

## What this is

A product whose **only job is to catch the fade early and make restarting trivial.**

The owner ships TypeScript professionally and is disciplined at work, but has repeatedly failed at health habits in a specific way: a few good months, then an interruption (an injury once, a busy semester another), then no restart. The habit doesn't die during the pause — it dies because nothing pulls him back in. Every tool he's tried optimises for good days.

Framing: this is not fitness tracking. It's **uptime monitoring for one system — a body.** The only score is *did it stay up today*. A day is **up** if one small real thing got logged. Not all of them. No minimum.

As of **2026-07-28** it is becoming a real mobile product: multi-user accounts, up to four user-defined levers, native push, App Store + Play. The web app remains the reference implementation.

**Positioning, in the owner's words:** *"We create the package; the user builds the goal."* The product ships the system — uptime, runs, outages, a pager, a playbook, a re-entry path — and stays silent about what the user should do with it.

## Locked decisions (2026-07-28)

| Question | Decision |
| --- | --- |
| Mobile stack | **Expo + React Native**; native widget targets later |
| Team | Owner on TypeScript; teammates available for native work + macOS |
| Audience | **Real public product** — open signups, both stores |
| Uptime rule with 4 levers | **Unchanged — any one lever still counts** |
| Alerts | **Native push only.** Telegram retired after transition |
| Daily reminder | **Silent by default**, opt-in toggle in Settings |
| v1 scope | Core + history **+ `/proof`** |
| Onboarding | One screen: state the rule, then pick 1–4 levers; then posture |
| Repo | **Monorepo**, shared derivation core |
| Auth | Email 6-digit code · Sign in with Apple · Google · email + password |
| Widget | **After launch (v1.1+)** |
| Money | Free for v1 |
| Name | Keep `uptime` for now; branding pending |
| Tone | Blunt ops register, with a **`STRICT` / `SOFT` posture** setting |
| Lever edits | **Rename freely; archive never deletes** |
| **Day grid encoding** | **Lightness ramp** — see below. Owner's call, 2026-07-28 |
| **Weight** | **Opt-in, off by default.** Never affects uptime |
| **Proof trend** | **Daily points.** Plateau detection stays **weekly** |
| Adaptive scope | One visual system, **two interaction layers** |

**Why Expo, in one line:** widgets are native in *every* scenario (WidgetKit is SwiftUI-only; Android widgets are Kotlin/Glance), so the real choice was 1 app codebase + 1 derivation engine versus 2 app codebases + 3 derivation engines.

## Stack & environment

- **Monorepo** on npm workspaces: `packages/core`, `apps/web`, `apps/mobile` (not built yet)
- Next.js 16.2.10 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first)
- Supabase (Postgres 17, Auth, RLS) — project `yqphirnsvcqzstwjfshs` ("parsa-system", eu-west-1)
- Vercel (cron via `apps/web/vercel.ts`) · Vitest · Playwright (dev screenshots only)
- Node 24.15, npm 11.16, Windows 11 + Git Bash
- Repo: **`github.com/KaguSoftware/uptime`** — `origin`, and the only remote. This is `ParSaMnSS/personal-system` **transferred** to the Kagu org on 2026-07-28, not a new repo, so full history came with it.
- Timezone: **Europe/Istanbul** (UTC+3, no DST) — becomes device-detected for public users

**No secrets in this file.** Env vars live in `apps/web/.env.local` (gitignored) — see README for the table.

## Conventions

- **`packages/core` is the derivation engine and must exist exactly once.** Consumed as TypeScript source (`transpilePackages` on web, Metro on mobile) — no build step, no publish cycle, no version skew. Its `tsconfig.json` omits the `dom` lib deliberately, so "renderer-agnostic" is a compile error rather than a review catch.
- **Next.js 16 renamed Middleware → Proxy.** Session refresh is `apps/web/proxy.ts`, not `middleware.ts`. `AGENTS.md` warns this Next version differs from training data — read `node_modules/next/dist/docs/` before assuming an API.
- **Every server action re-checks auth** via `requireUser()`. Server Functions are reachable by direct POST, so the proxy redirect is not a security boundary.
- **Uptime is derived, never stored.** No streak column exists. A stored counter is a thing that can be reset to zero, and "back to zero" is the exact failure mode the app exists to prevent.
- Dates are `YYYY-MM-DD` strings in the user's timezone, never `Date` objects parsed from bare date strings.
- **Server Actions do not port to mobile.** `apps/web/app/actions.ts` is Next-specific; the mobile client talks straight to Supabase, with RLS as the security boundary.
- **Contrast is measured, never assumed.** Every ratio in `DESIGN.md` was computed from the final hex. Re-measure on any colour change.

## Current status

**Done and verified:**

- Schema pushed — 8 tables, RLS on all. Verified: anon reads return zero rows, cross-user insert rejected (42501).
- Auth: password sign-in + magic link fallback; deep link survives sign-in via `?next=`.
- Status dashboard, re-entry takeover, day grid, two-tap logging with playbook chips, history, playbook, proof, settings.
- Monitor route with fade tiers, milestone ledger, plateau detection. **Verified end-to-end** against seeded data: silent at 1 day, pages at 2, escalates at 3, same-day dedupe works.
- **Telegram paging verified 2026-07-19.** A real `DOWN 3 DAYS` alert was composed by `/api/monitor/check` and delivered to a phone.
- **Monorepo restructure, 2026-07-28.** `lib/uptime.ts` + `lib/monitor.ts` → `packages/core` as `@uptime/core`; Next app → `apps/web`. Verified after the move: **44/44 tests green, `tsc` clean in both workspaces, production build emits an identical route table, eslint clean.**
- **Design foundation, 2026-07-28.** `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`. Palette ported oklch → RN-safe hex with **every ratio re-measured against the converted values** (zero gamut clipping, all reproduce within 0.04). Design detector reports no findings.
- **Two real contrast defects found and fixed** — see Gotchas.
- **Mobile surface spec** — [claude.ai/code/artifact/68c1c6a8-26ee-41ba-acde-37fd303bb3c3](https://claude.ai/code/artifact/68c1c6a8-26ee-41ba-acde-37fd303bb3c3). Every v1 screen at 390×844. **Design specimens, not a running build.** Needs a rev to reflect the lightness-ramp decision, `/proof`, and weight.

**Written but NOT verified end-to-end:**

- **Vercel cron has never run.** The route works locally; the schedule is unproven.
- Plateau thresholds pass unit tests but have no longitudinal data behind them. `PLATEAU_WEEKS` (4) and `MIN_DAYS_PER_WEEK` (3) are educated guesses.

**Blocked / needs the owner:**

- **Vercel Root Directory must be saved as `apps/web`.** A deploy on 2026-07-28 failed with *"No Output Directory named public"* — Vercel ran the **root** build script, so it never found `apps/web/.next`. The build itself compiled all 12 routes fine. Also keep *"Include files outside the root directory"* **enabled**, or `packages/core` never reaches the build.
- **Recommended:** turn *"Skip deployments when there are no changes"* **off**. If its workspace detection ever misses, a change to the derivation engine would silently not deploy.
- **Rotate two credentials** — see Gotchas.

## File map (key files)

| File | What it does |
| --- | --- |
| `packages/core/uptime.ts` | All derivation: uptime window, current run, down days, runs/outages, all-time figures. The heart of the product. |
| `packages/core/monitor.ts` | Fade thresholds, milestone selection, plateau detection. Pure functions, fully tested. |
| `packages/core/index.ts` | Barrel export — the single public surface of the engine. |
| `apps/web/lib/system.ts` | Loads status in one pass; lazy-creates `system_state` + seeds playbook. Web-local (imports `next/headers`). |
| `apps/web/app/page.tsx` | Status dashboard; routes to the takeover when down ≥3 days with history. |
| `apps/web/app/components/takeover.tsx` | Re-entry screen. The most important UI in the product. |
| `apps/web/app/components/day-grid.tsx` | The signature component. **Needs updating to the lightness ramp.** |
| `apps/web/app/proof/page.tsx` | Signal check-in + trend. **Trend needs changing from weekly to daily points.** |
| `apps/web/app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `apps/web/app/globals.css` | Tailwind v4 `@theme` tokens. Normative in oklch. |
| `apps/web/proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `apps/web/vercel.ts` | Cron schedule. Inside the app dir because Vercel's Root Directory points there. |
| `supabase/migrations/` | Schema. `db push` to apply. |
| `scripts/seed.mjs` | Seed synthetic history: `npm run seed -- 31 11`. |

## Roadmap / next steps

1. ~~Telegram bot connected, delivery verified~~ — 2026-07-19.
2. ~~Monorepo restructure, `@uptime/core` extracted~~ — 2026-07-28, fully verified.
3. ~~Design foundation: PRODUCT.md, DESIGN.md, token port~~ — 2026-07-28.
4. **← ACTIVE: apply the three product changes decided 2026-07-28.**
   - **Day grid → lightness ramp.** Replace the two-state fill in `day-grid.tsx`. Ramp is generated per lever count, floor `L 0.51`, top `ink`. Exact values and rationale in `DESIGN.md` → *The Day Grid*.
   - **Proof trend → daily points.** `apps/web/app/proof/page.tsx` currently folds into ISO weeks via `isoWeekKey`. The **trend** becomes daily; **`evaluatePlateau` stays weekly** (see Gotchas — this is a trap).
   - **Optional weight.** New signal kind + a Settings toggle, off by default. Recorded and plotted only — no goal, no target, no interpretation, never affects uptime.
   - Re-publish the surface spec artifact to match.
5. **Spike the risks** in parallel: Hermes `Intl` timezone on a physical Android device; Supabase session persistence in Expo; one real push notification delivered.
6. `Lever = string` in `packages/core` + `levers.ts`. **The 44 tests staying green is the gate for the whole custom-lever feature.**
7. Schema migration: `levers` table, drop the `gym`/`food` CHECKs, backfill, `push_token`, `posture`, `weight_enabled`, account deletion.
8. Build the Expo app · push replaces Telegram · offline outbox · store prep.

## Deliberately partial — grows later (scope ledger)

| Area | What ships now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Levers | Hardcoded `gym`/`food`, CHECK-constrained in SQL and a TS union | Up to 4 user-defined; stable key + renameable label | Step 6–7 — the headline feature |
| Day grid | Two-state fill (one lever vs both) | Lightness ramp, one step per lever | **Step 4 — active** |
| Proof trend | Weekly averaged points | Daily points | **Step 4 — active** |
| Weight | Not present | Opt-in, recorded and plotted, never scored | **Step 4 — active** |
| Posture | Not present | `STRICT` / `SOFT`, chosen at onboarding | With mobile |
| Widgets | None | Interactive Home/Lock Screen widget: tap a lever without opening the app | v1.1 — SwiftUI + Glance, App Groups |
| Alerts | Telegram | Native push, same escalation ladder | Step 8 |
| Outage annotation | `annotateOutage` action exists; no UI | Tap an outage in `/history` to label it | After real outages exist |
| Undo | Under a logged lever, today only | Long-press any grid cell to edit that day | Low priority |
| Timezone | Defaults to Europe/Istanbul in DB | Device-detected at signup, editable | With mobile |
| Monetization | Free | Undecided | Post-launch |

## Gotchas / open issues

- **Day boundary is 04:00 local, not midnight.** A 01:30 session counts for the day that just ended. `logicalDate()` handles this; don't bypass it.
- **`logicalDate()` depends on `Intl.DateTimeFormat("en-CA", { timeZone })`.** This is the **highest-risk unknown for mobile** — if Hermes lacks full ICU on Android, every date silently shifts by a day. Verify on a physical device. Fallback: compute `today` server-side via `public.logical_date(tz)`.
- **The proof trend and `evaluatePlateau` are two different readers of the same data.** The trend becomes **daily**; plateau detection stays **weekly**. This already caused one bug: `evaluatePlateau` claimed to group by week but keyed on the raw date, so with daily input the 4-week window collapsed to 4 days and would have paged constantly. **Do not "fix" plateau to match the trend.** A plateau judged on raw days is a mood, not a trend.
- **The day-grid ramp floor is `L 0.51`, and the binding constraint is the DOWN cell, not the background.** At `L 0.49` the dimmest up-day measured 2.83:1 against a down cell — up-versus-down is the most important read in the grid. Check against the wrong reference and the dimmest up-day vanishes into a gap.
- **`--color-line-hi` was raised 0.42 → 0.51 on 2026-07-28.** At 0.42 it measured 2.27:1 and failed WCAG 1.4.11's 3:1 non-text floor while drawing the ring that marks *today*. Now 3.33:1. Don't revert it for aesthetics.
- **Empty history must read as 0 days down, never a large number.** An early bug greeted a new user with "DOWN 400 DAYS" — the precise framing the app exists to avoid. There's a regression test; keep it.
- **Archiving a lever must never change past uptime.** Entries are never deleted; the day grid and the 30-day number must be byte-identical afterward.
- **`SOFT` posture is not gamification.** It may change wording and may let good news sound like good news. It may not touch what counts as up, any number, the thresholds, or the anti-shame invariants. No badges, points, streaks or confetti in either posture, ever.
- **Weight never affects uptime**, has no goal or target, and is off by default. It is a number the user chose to keep, not a score kept on them.
- **The monitor records its paging decision regardless of delivery success.** If that write moves back inside the "has a channel" branch, an unconfigured channel re-pages every pass.
- **Two credentials were exposed in a chat transcript on 2026-07-19 and should be rotated:** the Supabase account password, and the Telegram bot token (BotFather `/revoke`, then update `apps/web/.env.local` and the Vercel env var). Verified 2026-07-28: **no `.env` file was ever committed**, so git history is clean — the exposure was transcript-only.
- **`/proof` fetches a row limit, not a date range.** Daily sampling writes up to 3 rows a day, so the 280-row limit backs the 12-week window. **Adding weight as a fourth kind shortens that window silently** — raise the limit when weight ships.
- **`.env.local` lives at `apps/web/.env.local`, not the repo root.** `scripts/_session.mjs` resolves that path relative to its own location so there is one copy of the secrets.
- **`.gitignore` patterns are deliberately un-anchored.** A root-anchored `/node_modules` would silently stop ignoring `apps/web/.next`.
- **Playwright's browser binary needs `npx playwright install chromium`.** npm 11's `allow-scripts` gate blocks its postinstall, which silently breaks `scripts/shoot.mjs`.
- `scripts/shoot.mjs` waits on `domcontentloaded`, not `networkidle` — Turbopack's HMR socket keeps the network busy forever in dev. Set `BASE=http://localhost:3001` when Next bumps to a spare port.
- `scratch/` is gitignored and holds screenshots and throwaway scripts; safe to delete.

## Running it

```bash
npm install          # installs every workspace
npm run dev          # apps/web on http://localhost:3000
npm test             # packages/core — 44 tests, the gate for everything
npm run typecheck    # both workspaces
npm run lint
npm run build
npx supabase db push # apply migrations (link once with --project-ref)

# Dev helpers (credentials from apps/web/.env.local)
npm run seed -- 31 11             # 31-day run that ended 11 days ago
npm run shoot -- out ",history,proof"
npm run reset                     # wipe synthetic data
```

Exercise the monitor locally without sending anything:

```bash
curl "http://localhost:3000/api/monitor/check?secret=$CRON_SECRET&dry=1"
```
