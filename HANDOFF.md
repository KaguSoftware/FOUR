# uptime — Handoff

> **New chat? Read this file top to bottom before doing anything.** It is written
> to be sufficient on its own. Companions: `PRODUCT.md` (product truth),
> `DESIGN.md` (visual system), `.impeccable/design.json` (design sidecar), and
> the approved plan at `~/.claude/plans/i-got-this-web-majestic-bee.md`.

## If the user just said "continue"

The **active step** is marked `← ACTIVE` in *Roadmap* below. Do that. Before you
start:

1. Check *Blocked / needs the owner* — do not re-do work that is waiting on them.
2. Run `npm test`. **91 tests must be green.** They encode the invariants the
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
| **Native components** | **Binding.** Use the platform's component wherever one exists — back, sheets, switches, pickers, alerts, list rows, tab bars. Custom only for the day grid, hero readout, lever buttons and takeover |

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
- **Mobile surface spec, rev 3** — [claude.ai/code/artifact/68c1c6a8-26ee-41ba-acde-37fd303bb3c3](https://claude.ai/code/artifact/68c1c6a8-26ee-41ba-acde-37fd303bb3c3). Every v1 screen at 390×844: dashboard at 1–4 levers, the day-grid encoding options with the ramp chosen and the rejects shown, per-platform navigation, takeover and milestone in both postures, onboarding, lever sheet, and `/proof` with the daily trend and optional weight. **Design specimens, not a running build.** Source lives in `scratch/spec.html` (gitignored); republish with the same file path to keep the URL.
- **Onboarding, posture and multi-user sign-up, 2026-07-28.** `/onboarding` (rule + 1–4 levers, then posture), `requireStatus()` gating every signed-in screen, `completeOnboarding` / `setPosture` actions, a Settings posture control, posture wired into the takeover and the milestone panel, "just mark it up" added to the takeover so an empty playbook is not a dead end, and an explicit create-account path on `/login`. Verified: **91 tests green, 15 migration checks, tsc clean, eslint clean, production build emits `/onboarding`.** Contrast measured on all 26 new colour pairs — see Gotchas for the two findings.
- **Three legibility defects caught by reviewing renders rather than reading code**, all fixed: 6px horizontal overflow from an assumed `box-sizing`; a run length set in the label face instead of tabular mono; and a 1–5 scale whose selected step sat at **1.10:1** against its unselected siblings — effectively invisible. Now 15.31:1. **Screenshot and look at the render; the detector does not catch these.**

**Written but NOT verified end-to-end:**

- **The entire mobile app has never run.** It typechecks and `expo export` bundles it for iOS and Android, which proves the module graph resolves and nothing more. No screen has rendered, no tap has been handled, no session has been stored. Treat every mobile behaviour as unproven until it runs on hardware.
- **Vercel cron has never run.** The route works locally; the schedule is unproven.
- Plateau thresholds pass unit tests but have no longitudinal data behind them. `PLATEAU_WEEKS` (4) and `MIN_DAYS_PER_WEEK` (3) are educated guesses.

**Blocked / needs the owner:**

- **Run `npx supabase db push`** to apply `20260728010000_custom_levers.sql`. Verified in WASM Postgres but never run against the live database. **The app still reads the hardcoded pair, so the migration is safe to apply ahead of the code.**
- **Rotate two credentials** — see Gotchas.
- Note for a fresh chat: `apps/web/.env.local` is **not** on this machine, so the dev server and the dev scripts cannot run here until it is recreated. Tests, typecheck, lint and build all work without it.

## File map (key files)

| File | What it does |
| --- | --- |
| `packages/core/uptime.ts` | All derivation: uptime window, current run, down days, runs/outages, all-time figures. The heart of the product. |
| `packages/core/monitor.ts` | Fade thresholds, milestone selection, plateau detection. Pure functions, fully tested. |
| `packages/core/index.ts` | Barrel export — the single public surface of the engine. |
| `packages/core/posture.ts` | `STRICT` / `SOFT` copy. Returns strings only, never a number — that is the whole safety property. |
| `packages/core/levers.ts` | Lever key/label rules: slugs, uniqueness, the four-lever ceiling. |
| `apps/web/lib/system.ts` | Loads status in one pass; `requireStatus()` is the auth + onboarding gate every page uses. |
| `apps/web/app/onboarding/` | First run: the rule, 1–4 levers, posture. The only screen that may not call `requireStatus()`. |
| `apps/web/app/page.tsx` | Status dashboard; routes to the takeover when down ≥3 days with history. |
| `apps/web/app/components/takeover.tsx` | Re-entry screen. The most important UI in the product. |
| `apps/web/app/components/day-grid.tsx` | The signature component — the lightness ramp, driven by `core/grid.ts`. |
| `apps/web/app/proof/page.tsx` | Signal check-in + daily trend, with the optional weight line. |
| `apps/web/app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `apps/web/app/globals.css` | Tailwind v4 `@theme` tokens. Normative in oklch. |
| `apps/web/proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `apps/web/vercel.ts` | Cron schedule. Inside the app dir because Vercel's Root Directory points there. |
| `apps/mobile/AGENTS.md` | **Read before touching mobile.** SDK 57 moved several APIs; this records which, and that the installed `.d.ts` files beat the docs. |
| `apps/mobile/src/lib/supabase.ts` | Keychain-backed session storage. Chunks the session because SecureStore caps a value at 2048 bytes on Android. |
| `apps/mobile/src/lib/status.ts` | The client-side port of `getStatus()`. Three queries, everything else derived by core. |
| `apps/mobile/src/app/_layout.tsx` | The auth + onboarding gate, via `Stack.Protected`. |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | The native tab bar — real `UITabBar` / Material 3, SF Symbols and Material Symbols per platform. |
| `supabase/migrations/` | Schema. `db push` to apply. |
| `scripts/seed.mjs` | Seed synthetic history: `npm run seed -- 31 11`. |

## Roadmap / next steps

1. ~~Telegram bot connected, delivery verified~~ — 2026-07-19.
2. ~~Monorepo restructure, `@uptime/core` extracted~~ — 2026-07-28, fully verified.
3. ~~Design foundation: PRODUCT.md, DESIGN.md, token port~~ — 2026-07-28.
4. ~~Apply the three product changes decided 2026-07-28~~ — done. Day-grid ramp (`packages/core/grid.ts`, 11 new tests), daily proof trend, optional weight. 55 tests green, tsc/eslint clean, build succeeds.
5. ~~Push, run the weight migration, set the Vercel root directory~~ — done by the owner 2026-07-28.

6. ~~Spike the Hermes `Intl` timezone risk~~ — done 2026-07-28, answered by research plus `logicalDateLocal`. Two spikes remain and both need a device: Supabase session persistence in Expo, and one real push notification delivered.
7. ~~`Lever = string` + lever key/label rules in `packages/core/levers.ts`~~ — done 2026-07-28. The engine was untouched by the widening, which is the gate passing: 77 tests green.
8. ~~Schema migration — `levers` table, drop the `gym`/`food` CHECKs, backfill, `push_token`, `posture`~~ — written and verified 2026-07-28 via `npm run test:migrations` (15 checks). **Not yet applied — needs `npx supabase db push`.**
9. ~~Wire lever CRUD~~ — done 2026-07-28. Actions, a Settings manager, and `getStatus` reads levers from the table.
10. ~~Onboarding + posture~~ — done 2026-07-28. `/onboarding` states the rule, takes 1–4 levers and a posture, then sets `onboarded_at`. `requireStatus()` gates every signed-in screen. Posture is wired into the two places it is allowed to reach (takeover sentence, milestone panel) and is changeable in Settings. Web also grew an explicit **create-account** path, without which none of this was reachable.
11. ~~Expo app scaffold + the core screens~~ — done 2026-07-28. `apps/mobile` on **SDK 57**: native tab bar, native stack, native sheet, session gate, dashboard, takeover, day grid, levers, onboarding, sign-in, history, settings. **Typechecks and bundles for both platforms; never run on a device.**
12. **← ACTIVE: run it on a device.** Nothing in `apps/mobile` has executed. Needs `apps/mobile/.env.local` (see `.env.example`), then `npm run mobile`. The three things to confirm first: the SecureStore chunked-session adapter round-trips, `logicalDateLocal` gives the right day in a non-Istanbul zone, and the native tab bar/sheet look right.
13. Then: `/proof` on mobile · lever CRUD on mobile · push replaces Telegram · offline outbox · store prep.

## Deliberately partial — grows later (scope ledger)

| Area | What ships now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Levers | Fully user-defined on web: table, CRUD actions, Settings manager, 1–4 layout | Same on mobile | Done on web |
| Onboarding | Two screens: rule + 1–4 levers, then posture. Gated by `requireStatus()` | Same on mobile, plus device timezone capture | Done on web |
| Auth | Email + password, explicit create-account, magic link | Apple · Google · 6-digit code | With mobile |
| Day grid | Lightness ramp, generated per lever count | Unchanged; steps grow with user-defined levers | Done |
| Proof trend | Daily points, 60-day window | Unchanged | Done |
| Weight | Opt-in toggle, field, and line — **migration not yet applied** | Unchanged | Needs `db push` |
| Posture | Chosen at onboarding, changeable in Settings, wired into the takeover sentence and the milestone panel | Same two touchpoints on mobile | Done on web |
| Mobile `/proof` | A screen that says the check-in is not ported yet | The daily check-in + 60-day trend + optional weight, as on web | Step 13 |
| Mobile levers | Read-only list in Settings | Create/rename/archive via a native list with swipe actions | Step 13 |
| Mobile auth | Email + password | Sign in with Apple (**required by review once any third-party sign-in ships**) + Google | Before submission |
| App icon | Expo's default artwork | Real icon + splash | Before submission |
| Widgets | None | Interactive Home/Lock Screen widget: tap a lever without opening the app | v1.1 — SwiftUI + Glance, App Groups |
| Alerts | Telegram | Native push, same escalation ladder | Step 8 |
| Outage annotation | `annotateOutage` action exists; no UI | Tap an outage in `/history` to label it | After real outages exist |
| Undo | Under a logged lever, today only | Long-press any grid cell to edit that day | Low priority |
| Timezone | Defaults to Europe/Istanbul in DB | Device-detected at signup, editable | With mobile |
| Monetization | Free | Undecided | Post-launch |

## Gotchas / open issues

- **Day boundary is 04:00 local, not midnight.** A 01:30 session counts for the day that just ended. `logicalDate()` handles this; don't bypass it.
- **RESOLVED 2026-07-28 — do not use `logicalDate()` on mobile.** Hermes delegates Intl to platform ICU and the behaviour varies by Android version. Documented failures: `RangeError: Invalid timezone name!` for valid IANA zones (hermes#572), the options object ignored entirely on API 21-23 (hermes#776), and `resolvedOptions().timeZone` reporting `UTC` because the device zone is never exposed. It can pass on a test device and fail on a user's.
  **Use `logicalDateLocal(now)` instead** — no Intl at all. A phone's `Date` is already in the user's local time, which is the timezone the 04:00 boundary actually means. `hasTimeZoneSupport(tz)` probes the engine if you need to know. A test cross-checks the two implementations agree under Node, so a divergence fails CI rather than silently corrupting a month of history.
  **The mobile client must write the device's zone back to `system_state.timezone`**, or the server-side monitor will page on a different day than the phone is showing.
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
- **Reads in `getSystemState` and `/proof` tolerate an unmigrated database.** The weight columns are selected optimistically and retried without them on error, and `amount` is only touched when the opt-in is on. This exists because a deploy and a migration never land at the same instant, and a missing column should not take the whole app down for the minutes in between. Keep that property when touching either read.
- **A new signup gets NO levers — `/onboarding` is what writes them.** The trigger only creates `system_state`. `requireStatus()` in `lib/system.ts` is the gate that keeps an un-onboarded account off the dashboard, and **every signed-in page must call it rather than `getStatus()`** — a page that skips it renders a dashboard with no buttons. `/onboarding` itself deliberately does not, or it would loop.
- **`getLevers` treats a failed read and an empty read differently, on purpose.** A *failed* read means the table is not there yet and falls back to the historical gym/food pair. An *empty* read is a real un-onboarded account and returns empty. Collapsing those two back together would hand every new user two levers they never chose.
- **The takeover must always have a reachable action.** The playbook is empty for every new account now that signup seeds nothing, so "just mark it up" is the floor of that screen, not a nicety — it logs a lever with no detail. With one lever it is a single ghost line; with more it expands into the lever set; with an empty playbook the levers are shown immediately. A takeover with nothing tappable is the worst dead end this product could ship.
- **Posture may only ever return copy.** `packages/core/posture.ts` has no function that returns a number, a threshold, or a gate — that is the constraint expressed as a type signature. It reaches exactly two screens: one sentence on the takeover and the milestone panel on the dashboard. `posture.test.ts` also scans every string for the vocabulary of gamification (badge, point, score, streak, reward, …), so `SOFT` drifting into that category fails the build rather than a review.
- **Input borders across the app measure 1.45:1 against the page** (`--color-line` on `--color-bg`), and the fill is 1.08:1. That is below WCAG 1.4.11's 3:1, and it is the shared pattern in login, the lever manager, the playbook sheet and onboarding. Each field is identifiable by its placeholder at 5.08:1, which is the exception 1.4.11 allows — but **this is a live app-wide decision, not a settled one**. Raising resting borders to `line-hi` (3.33:1) would fix it and would need a new focus treatment, since focus currently *is* `line-hi`. Owner's call; flagged rather than changed unilaterally.
- **`posture · SELECTED detail` sits at 4.60:1**, the tightest text pair in the app — `ink-mute` on `surface-hi`, the lightest ground there is. Any future darkening of ink-mute or lightening of surface-hi breaks it. Re-run `npm run check:contrast` on any palette change.
- **"Food first" is gone.** The takeover and the monitor used to rank the food lever first, on the principle that coming back must be lighter than starting. That cannot survive user-defined levers — we cannot know which of someone's levers is the light one — so both now rank by what has actually worked (pinned, then use_count). If you want the old behaviour back, it needs a user-nominated "lightest" lever, which is new product scope.
- **A migration is not done until `npm run test:migrations` passes.** There is no Docker here, so PGlite is the only pre-flight check, and `supabase db push` is not reversible. That harness already caught an `on delete restrict` that would have broken Apple-mandated account deletion.
- **The old `handle_new_user()` seeded gym AND food playbook rows for every signup**, so every pre-existing account carries both levers and the backfill covers everyone through `playbook` even if they never logged. The new trigger seeds nothing — onboarding writes the levers.
- **Expo SDK 57 moved things.** `Stack` is `expo-router/stack`, not `expo-router`; root `Tabs` is deprecated; the tab bar is `NativeTabs` from `expo-router/unstable-native-tabs`. A doc lookup gave me the old, wrong answer for `Stack` — **read the installed `.d.ts` files**, which is what `apps/mobile/AGENTS.md` now says.
- **SecureStore caps a value at 2048 bytes on Android and a Supabase session is bigger.** `apps/mobile/src/lib/supabase.ts` chunks it across keys with a manifest written last. Get this wrong and it presents as "the app randomly logs me out", which is miserable to debug on a device. **Untested on hardware.**
- **`npx expo export` must run from `apps/mobile`**, not the repo root, or it resolves the wrong entry point. There is no root script for it on purpose — `npm run typecheck` covers the cheap check.
- **`.gitignore` had `.env*` with no exception**, so `.env.example` files were invisible and the env contract was undocumented. Negations added; don't drop them.
- **Playwright's browser binary needs `npx playwright install chromium`.** npm 11's `allow-scripts` gate blocks its postinstall, which silently breaks `scripts/shoot.mjs`.
- `scripts/shoot.mjs` waits on `domcontentloaded`, not `networkidle` — Turbopack's HMR socket keeps the network busy forever in dev. Set `BASE=http://localhost:3001` when Next bumps to a spare port.
- `scratch/` is gitignored and holds screenshots and throwaway scripts; safe to delete.

## Running it

```bash
npm install          # installs every workspace
npm run dev          # apps/web on http://localhost:3000
npm test             # packages/core — 91 tests, the gate for everything
npm run typecheck    # both workspaces
npm run lint
npm run test:migrations  # runs every migration against real Postgres (WASM)
npm run check:contrast   # measures every colour pair against its WCAG floor

# Mobile (needs apps/mobile/.env.local — copy .env.example)
npm run mobile           # Expo dev server; scan the QR with Expo Go or a dev build
npm run mobile:ios
npm run mobile:android
cd apps/mobile && npx expo export --platform ios   # proves the module graph resolves
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
