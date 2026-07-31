# four — Handoff

> **New chat? Read this file top to bottom before doing anything.** It is written
> to be sufficient on its own. Companions: `PRODUCT.md` (product truth),
> `DESIGN.md` (visual system), `.impeccable/design.json` (design sidecar), and
> the approved plan at
> `~/.claude/plans/this-system-needs-some-adaptive-rossum.md`.

## If the user just said "continue"

The **active step** is marked `← ACTIVE` in *Roadmap* below. Do that. Before you
start:

1. Check *Blocked / needs the owner* — do not re-do work that is waiting on them.
2. Run `npm test`. **162 tests must be green.** They encode the invariants the
   product rests on; if they are red, stop and fix that first.
3. Skim *Gotchas*. Several are traps that have already cost time once.

**The app is now running on real hardware** (as of 2026-07-29) and the owner is
testing on a device. That changes how to work on it: bugs arrive as descriptions
of what the screen did, not as failing tests, and several have been regressions
invisible to `tsc`. See *The cross-screen sync trap* in Gotchas — it caused three
separate reported bugs in one day.

---

## Working style

- **Collaborate before locking user-facing decisions.** Propose with a recommendation; don't unilaterally commit to product behaviour.
- **Plan mode** for non-trivial work; owner approves before build.
- **Git commits list Parsa as sole author.** Never add `Co-Authored-By` trailers, even though the default harness instructions request one. Verified clean as of 2026-07-28.
- **External dashboard state (Supabase, Google Cloud, Apple, Vercel) is checked
  by handing the owner a written prompt for a Claude Chrome agent** — naming the
  exact page, asking for values quoted verbatim, stating the expected value, and
  ending with "report only, change nothing". Never guess at it, and never ask
  the owner to improvise the questions. Treat the report as evidence: if it
  disproves the working theory, drop the theory rather than patching it.
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
| Onboarding | State the rule, then pick 1–4 levers; opt-ins after. A first-open walkthrough (mobile) explains the dashboard once |
| Repo | **Monorepo**, shared derivation core |
| Auth | Email 6-digit code · Sign in with Apple · Google · email + password |
| Widget | **After launch (v1.1+)** |
| Money | Free for v1 |
| Name | **`four`**, after the four-lever ceiling. Display name only — the `uptime` slug, the `uptime://` scheme, `com.kagusoftware.uptime` and the `@uptime/*` packages are all unchanged |
| Tone | Blunt ops register, **one voice** — the `STRICT`/`SOFT` posture setting shipped 2026-07-28 and was removed 2026-07-30 by owner decision |
| Lever edits | **Rename freely; archive never deletes** |
| **Day grid encoding** | **Lightness ramp** — see below. Owner's call, 2026-07-28 |
| **Weight** | **Opt-in, off by default.** Never affects uptime |
| **Proof trend** | **Daily points.** Plateau detection stays **weekly** |
| Adaptive scope | One visual system, **two interaction layers** |
| **Native components** | **Binding.** Use the platform's component wherever one exists — back, sheets, switches, pickers, alerts, list rows, tab bars. Custom only for the day grid, hero readout, lever buttons and takeover |

**Why Expo, in one line:** widgets are native in *every* scenario (WidgetKit is SwiftUI-only; Android widgets are Kotlin/Glance), so the real choice was 1 app codebase + 1 derivation engine versus 2 app codebases + 3 derivation engines.

## Stack & environment

- **Monorepo** on npm workspaces: `packages/core`, `apps/web`, `apps/mobile`
- **Mobile: Expo SDK 54** / React Native 0.81.5 / expo-router 6 / Reanimated 4 / react-native-gesture-handler
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

- Schema pushed — 9 tables, RLS on all. Verified: anon reads return zero rows, cross-user insert rejected (42501). **Nine of the ten migrations are applied to the live database, confirmed by `npx supabase migration list` on 2026-07-31** — including `delete_account` and `integrity_hardening`, which this file previously listed as outstanding. The only local-only migration is `20260730120000_drop_posture.sql`, and it is deliberately held (see *Blocked*).
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

- **The mobile app runs on hardware, 2026-07-29.** It is being used and bug-reported against. Expo SDK **54** (moved back from 57 deliberately — Expo Go ships one SDK and the owner's phone has 54).
- **Renamed to `four`, 2026-07-29.** Display name only. App name, both wordmarks, web title, PWA manifest, and the push-notification title fallback. The `uptime` slug, the `uptime://` scheme, `com.kagusoftware.uptime` and the `@uptime/*` packages are all unchanged, and ~60 uses of "uptime" as the *metric* are untouched — including the persisted `uptime_80` / `uptime_90` milestone kinds.
- **All six migrations applied to the live database, 2026-07-29.** `npx supabase migration list` shows local and remote matching.
- **The device-testing round, 2026-07-29.** Screen scaffold with correct tab-bar and status-bar insets; the page-switch twitch; calendar-month grid on Home with today's cell pulsing; History captions and incident ranges; Settings split into an index and four sub-screens on a native stack; drag-to-reorder and drag-to-archive with fade-and-collapse motion; the undo control replaced by tapping a logged lever; the per-day grid denominator and its two follow-up bugs. All verified as `tsc` clean, 162 tests, `expo lint` clean, `expo export` bundling both platforms, and the web app building.
- **The real-app Settings + Auth round, 2026-07-29.** Settings grew to the full surface: Alerts now holds the daily reminder (opt-in, native time picker, local scheduling via `lib/reminder.ts`) and a delivery block (permission status + send-a-test-alert); Tracking gained the kg/lb unit control; Account gained change email, change password, a passive sync row (outbox depth + staleness), export-as-JSON through the share sheet, and delete account (typed-email confirm → native alert → `delete_own_account()` RPC, migration `20260729030000`); a new About screen (version, privacy, terms, support mailto). Auth: sign-in rebuilt with Sign in with Apple (native button, nonce flow), Google (PKCE browser round-trip), and a 6-digit email OTP screen that doubles as forgot-password; onboarding is now five steps (rule+levers → posture → tracking → reminder → alerts priming before the OS prompt). New deps (all SDK 54 pins, Expo Go-safe): expo-apple-authentication, expo-crypto, expo-web-browser, datetimepicker, expo-file-system, expo-sharing. Verified: tsc clean ×3, 162 tests, 19 migration checks, expo lint clean, expo export both platforms. **Provider flows and the reminder are untested on device; the third-party providers are dead until the Supabase dashboard config below is done.**

- **The full-system audit and the trust-bug round, 2026-07-29.** Three parallel
  audits (core+schema, mobile, web) produced a findings list; the P0 slice is
  built. **Security:** two open redirects closed (`?next=@evil.com` escaped the
  origin through both `/auth/callback` and the login form — now `safePath()` in
  `apps/web/lib/safe-path.ts`); the cron secret is header-only and
  timing-safe-compared; the monitor no longer echoes every `user_id`; Telegram
  chat ids are validated as numeric. **The pager's own failure mode:** the
  monitor loop had no per-user try/catch, so one unparseable
  `system_state.timezone` threw and every user after it was never evaluated —
  now each pass is isolated, the zone is validated via core's
  `hasTimeZoneSupport`, and the DB keeps the last good value via a trigger.
  **The readout no longer lies:** six web actions ignored Supabase's `error`
  and six mobile paths reported success unconditionally — all now return and
  surface failure. **Data:** `DETAIL_MAX`, weight bounds, a composite
  `playbook_id` FK, and a `monitor_runs` day-unique are enforced in the
  database; `milestones` and `monitor_runs` are select-only for their subject.
  **Offline:** the outbox classifies permanent vs transient failures and
  dead-letters the former (one refused tap used to block the queue forever),
  reports a stale queue via core's `oldestAgeDays`, and clears its storage on
  sign-out. Verified: **162 tests, tsc clean ×3, 26 migration checks (was 19),
  expo lint clean, expo export both platforms, web production build clean.**

- **Apple Developer + TestFlight, 2026-07-30.** The owner enrolled (Individual,
  ₺649,99/yr, enrollment `73QT5LB8X5`, renews 29 July 2027), EAS credentials
  exist (distribution cert, ad-hoc + store provisioning, **APNs push key**),
  and **build 4 (0.1.0) was submitted and is on TestFlight** — internal group
  live, external group "work and friends" created with a public link that stays
  dead until a build passes Beta App Review. Same day: `/privacy` and `/terms`
  pages (public via `PUBLIC_PATHS`), and the FOUR mark on every icon surface,
  all generated by `scripts/make-mark.ps1` (app icon alpha-free — the App
  Store rejects transparency).
- **The owner-feedback round, 2026-07-30.** Five changes from using build 4:
  **(1) posture removed** — strict-only, see the decisions table; **(2) the
  Settings tab de-texted** — 23 explanatory blocks (~460 words) cut to ~10
  (~110); **(3) a full in-app manual** (`how-it-works`, seven pages that render
  the REAL components — DayGrid, LeverButtons, the ramp-driven legend — with
  sample data, so the guide cannot drift from the UI) auto-opens once per
  device and reopens from Settings → About; **(4) the sign-in keyboard twitch fixed** —
  `contentInsetAdjustmentBehavior="never"` on the auth/onboarding ScrollViews
  (same class as the page-switch twitch), QuickType suppressed on email
  fields, and `keyboardVerticalOffset` on the three under-header settings
  forms; **(5) the reminder-time bug fixed** — `TimeRow` now pins the picker
  to UTC, because Hermes and native UIKit disagreed about Istanbul's 2000
  offset rules and a picked 13:20 was stored as 14:20.

- **The grid-swap round, 2026-07-31.** The two grids traded screens. **Home** is
  the trailing 30 days, ten across in three rows; **History** is a scrolling
  stack of calendar months back to the first entry, seven across, each headed
  with its name and how much of it was up. Home's calendar month asked "where am
  I in this month" — a question the hero already answered, and one that reset to
  nearly empty on the 1st; History's ninety unlabelled squares could not answer
  "which weekdays do I lose". `monthGrid()` moved rather than being deleted.
  **Every square now opens a read-only day panel** (levers fired, their detail
  text, that day's signals) — a native `formSheet` on mobile (`src/app/day.tsx`),
  a real `Sheet` on web. This was only possible on History *because* of the swap:
  seven columns give a ~44pt cell, the old block gave 21px. Read-only on purpose
  — uptime, runs and outages are derived from entries, so an editable past day
  makes every figure retroactively negotiable. Also: web gained a proper
  `Sheet` (portal, focus trap, Escape, scroll lock — the inline `PlaybookSheet`
  had none and now shares it); core gained `addMonths` (day-clamped, so stepping
  back from the 31st cannot skip February) and `monthsBetween`; **Google now
  sends `prompt=select_account`** (it was silently reusing Safari's Google
  session, so users never learned which account they had signed up with);
  **delete-account asks for `DELETE`, not the account email** (an Apple/Google
  user may never have seen that address, so the old gate could lock a real user
  out of a flow Apple requires to exist); and both auth failure paths stopped
  lying — `oauth.ts` no longer reports every non-success as a user cancellation,
  and `/auth/callback` no longer labels every failure "link expired". Verified:
  **162 tests, tsc clean ×3, eslint clean, contrast clean, web build, expo
  export both platforms. Not yet run on a device.**

**Written but NOT verified end-to-end:**

- **Vercel cron has never run.** The route works locally; the schedule is unproven.
- **Push has never been delivered to a device.** Needs a development build; `expo-notifications` cannot issue a token without an EAS `projectId` and remote push does not work in Expo Go.
- **Drag-to-reorder and drag-to-archive have not been used on a device** as of this writing. The RPC they depend on is applied; the gesture itself is unproven on hardware.
- **The 2026-07-29 Settings/Auth surface is untested on hardware**: the daily reminder firing at its hour, the test alert, export's share sheet, change email/password round-trips, delete account against the live DB (its migration IS applied now, so it should work), Apple and OTP sign-in. Google sign-in has completed end to end since the account-picker fix.
- **The whole 2026-07-31 grid round is untested on hardware**: both grid layouts, tapping a day on each screen, how a blank day reads, and the `DELETE` confirm.
- Plateau thresholds pass unit tests but have no longitudinal data behind them. `PLATEAU_WEEKS` (4) and `MIN_DAYS_PER_WEEK` (3) are educated guesses.

**Blocked / needs the owner:**

- **Rotate two credentials** — see Gotchas. Still outstanding from 2026-07-19.
- **A development build** — see *Roadmap* step 15. This is the gate on push.
- **`20260730120000_drop_posture.sql` is written but MUST WAIT for build 5.**
  TestFlight build 4 still selects the `posture` column in its status query;
  dropping it while build 4 is anyone's installed version breaks their
  dashboard load. Sequence: build 5 on TestFlight and installed → then
  `db push`. The column with default `'strict'` is harmless in the meantime.
- **Supabase dashboard config — items 1–3 are DONE, verified 2026-07-31** by a
  browser audit of the dashboard (see Gotchas for the full result). Apple's
  Client IDs, Google's provider + Web-application client, and the redirect
  allowlist (`uptime://auth/callback`, `exp://**`, the Vercel wildcard) are all
  correct, and Site URL is `https://personal-system-rho.vercel.app` — not
  localhost. **Google sign-in has since worked end to end.** What remains:
  1. **Custom SMTP.** The built-in sender is rate-limited to a handful of emails
     an hour, and — more urgently — the Magic Link template cannot be edited
     until custom SMTP is on. Which blocks:
  2. **Auth → Email Templates → Magic Link: add `{{ .Token }}`** (keep
     `{{ .ConfirmationURL }}`). **The email-OTP screen almost certainly cannot
     work today**: `src/app/(auth)/email-otp.tsx` asks for a 6-digit code, and
     Supabase's default template carries only a link. Not 100% confirmed — the
     dashboard's template Source view is locked without custom SMTP, so this
     rests on the rendered preview showing no code plus the known default.
     **The 30-second confirmation is to request a code on a device and look at
     the email.** Do that before changing any code.
- Note for a fresh chat: `apps/web/.env.local` is **not** on this machine, so the web dev server and the dev scripts cannot run here. Tests, typecheck, lint, both builds and `supabase db push` all work without it — `apps/mobile/.env.local` **does** exist.

## File map (key files)

| File | What it does |
| --- | --- |
| `packages/core/uptime.ts` | All derivation: uptime window, current run, down days, runs/outages, all-time figures. The heart of the product. |
| `packages/core/monitor.ts` | Fade thresholds, milestone selection, plateau detection. Pure functions, fully tested. |
| `packages/core/index.ts` | Barrel export — the single public surface of the engine. |
| `packages/core/levers.ts` | Lever key/label rules: slugs, uniqueness, the four-lever ceiling. |
| `apps/mobile/src/app/how-it-works.tsx` | The in-app manual (native modal, 7 pages) — renders the REAL DayGrid/LeverButtons with sample data so it cannot drift. Auto-opens once per device; reopens from Settings → About. **Its grid page describes Home's trailing 30 — update it whenever the grid changes.** |
| `apps/mobile/src/lib/walkthrough.ts` | The seen-once device flag — AsyncStorage, keyed per user, fails toward "seen". |
| `apps/web/lib/system.ts` | Loads status in one pass; `requireStatus()` is the auth + onboarding gate every page uses. |
| `apps/web/app/onboarding/` | First run: the rule, 1–4 levers. The only screen that may not call `requireStatus()`. |
| `apps/web/app/page.tsx` | Status dashboard; routes to the takeover when down ≥3 days with history. |
| `apps/web/app/components/takeover.tsx` | Re-entry screen. The most important UI in the product. |
| `apps/web/app/components/day-grid.tsx` | The signature component — the lightness ramp, driven by `core/grid.ts`. Exports `DayGrid` (Home's trailing 30, 10×3) and `MonthStack` (History's calendar months). Server-side: builds the cells and hands the client only the days on screen. |
| `apps/web/app/components/interactive-grid.tsx` | The client half — tappable cells and the day panel. One component for both the 10-wide and 7-wide shapes, so the tap behaviour cannot drift between them. |
| `apps/web/app/components/sheet.tsx` | The web overlay shell: portal, focus trap, Escape, scroll lock. **Every web dialog goes through this.** |
| `apps/mobile/src/components/day-grid.tsx` | Same two shapes on mobile, plus `TodayCell` (the pulsing today ring). |
| `apps/mobile/src/app/day.tsx` | The day sheet — read-only, native `formSheet`. Reads `cachedStatus`, not `useStatus()`, because iOS measures the sheet to size it. |
| `packages/core/day.ts` | `dayDetail()` — assembles what a day contained from entries + signals + lever labels. Derives nothing about uptime; a day's detail is a lookup, not a judgement. |
| `packages/core/month.ts` | `monthGrid()` — a calendar month as a Monday-first 7-column grid, **History's grid now, not Home's**. Plus `addMonths()` (day-clamped, so stepping back from the 31st cannot skip February) and `monthsBetween()`, which drive the stack. |
| `apps/web/app/proof/page.tsx` | Signal check-in + daily trend, with the optional weight line. |
| `apps/web/app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `apps/web/app/globals.css` | Tailwind v4 `@theme` tokens. Normative in oklch. |
| `apps/web/proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `apps/web/vercel.ts` | Cron schedule. Inside the app dir because Vercel's Root Directory points there. |
| `packages/core/grid.ts` | The day-grid ramp **and `leversOn`** — how many levers existed on a given day, which is the denominator each cell is shaded against. |
| `apps/mobile/AGENTS.md` | **Read before touching mobile.** SDK **54** facts, and the two run-it-from-the-right-directory traps (`expo`/`eas` from the root, `supabase` from `apps/mobile`). |
| `apps/mobile/src/lib/store.ts` | A subscribable value. **The fix for cross-screen sync** — read the docblock before touching either hook below. |
| `apps/mobile/src/lib/use-status.ts` | The shared status store + the focus staleness guard. `refreshStatus()` is callable from anywhere, including the sheets. |
| `apps/mobile/src/lib/use-outbox.ts` | Flush triggers, and the "reload before shrinking the queue" rule that stops undo flickering. |
| `apps/mobile/src/lib/outbox.ts` | The queue: in-memory store, AsyncStorage as backup, and the **only** entry write path in the app. Also owns permanent-vs-transient failure classification and the dead-letter list. |
| `apps/mobile/src/components/states.tsx` | `Loading` / `Failed` / `Fault` — the loading and failure surfaces, and the reason failure is not red. |
| `apps/web/lib/safe-path.ts` | Clamps a `next=` redirect to a same-origin path. Both open redirects went through values this now rejects. |
| `supabase/migrations/20260729040000_integrity_hardening.sql` | RLS split for the audit/milestone tables, length and weight bounds, composite `playbook_id` FK, `monitor_runs` day-unique, timezone trigger. |
| `apps/mobile/src/lib/supabase.ts` | Keychain-backed session storage. Chunks the session because SecureStore caps a value at 2048 bytes on Android. |
| `apps/mobile/src/lib/status.ts` | The client-side port of `getStatus()`. Five queries, everything else derived by core. |
| `apps/mobile/src/lib/reminder.ts` | The daily reminder: local scheduling, silent app-start reconcile, the test alert. The only file allowed to prompt for notification permission outside onboarding. |
| `apps/mobile/src/lib/oauth.ts` | Apple (nonce flow → `signInWithIdToken`) and Google (PKCE browser round-trip → `exchangeCodeForSession`). |
| `apps/mobile/src/lib/export.ts` | The whole account as one JSON file through the share sheet. Raw rows, never derived figures. |
| `apps/mobile/src/components/button.tsx` | THE button — extracted from five drifting inline copies. Use it instead of a bare Pressable. |
| `supabase/migrations/20260729030000_delete_account.sql` | `delete_own_account()` — security definer, no parameters, target comes from the JWT. Apple-required. |
| `apps/mobile/src/components/screen.tsx` | Every tab screen's frame. Owns the safe-area insets, the tab-bar allowance and the status-bar scrim. |
| `apps/mobile/src/components/lever-buttons.tsx` | The lever grid, with long-press drag-to-reorder and drag-to-archive. |
| `apps/mobile/src/app/_layout.tsx` | The auth + onboarding gate via `Stack.Protected`, plus `GestureHandlerRootView`. |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | The native tab bar — real `UITabBar` / Material 3, SF Symbols and Material Symbols per platform. |
| `supabase/migrations/` | Schema. `db push` **from the repo root** to apply. |
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
11. ~~Expo app scaffold + the core screens~~ — done 2026-07-28, then **moved from SDK 57 back to SDK 54** the same day so it runs in the owner's Expo Go. Native tab bar, native stack, native sheets, session gate, dashboard, takeover, day grid, levers, onboarding, sign-in, history, settings.
12. ~~Run it on a device~~ — done 2026-07-29. It runs, and a round of real bugs came back from it.
13. ~~`/proof` and lever CRUD on mobile~~ — done 2026-07-28. The trend series and its geometry moved into `packages/core/signals.ts` and **both clients now draw from it**, so the two charts cannot disagree about the same month.
14. ~~Offline outbox~~ — done 2026-07-28. Every lever tap on mobile goes through it, online or not. Rules in `packages/core/outbox.ts` (17 tests), storage and flushing in `apps/mobile/src/lib/outbox.ts`.
15. ~~Device-testing round one~~ — done 2026-07-29. Chrome insets and the page-switch twitch, the note field, the Settings rewrite, the rename to `four`, the calendar-month grid, today's pulse, History captions and ranges, universal undo, lever drag-to-reorder / drag-to-archive, and the per-day grid denominator. All migrations applied.
16. ~~Settings sub-screens, archive motion, and the grid-denominator fixes~~ — done 2026-07-29. Settings is now `app/(tabs)/settings/` — an index of value-stating rows pushing into `levers` / `alerts` / `tracking` / `account` on a native `Stack`, so the transitions, back button and edge-swipe are the platform's. Archiving fades and collapses, with the rest of the list carried up by `LinearTransition`. The undo control is gone: a logged lever stays tappable and its sheet offers "add what else you did" or "remove today's <lever>".
17. ~~Real-app Settings + Auth + Onboarding~~ — done 2026-07-29. Full settings surface (reminder, delivery, unit, change email/password, sync, export, delete account, About), Apple + Google + email-OTP sign-in, five-step onboarding. Pending on the owner: the Supabase dashboard config and `db push` listed under *Blocked*.
18. ~~Full-system audit + the P0 trust-bug round~~ — 2026-07-29. Open redirects,
    monitor isolation and secret handling, silent write failures on both
    clients, outbox dead-lettering, push hygiene, and an integrity migration.
    The remaining findings are triaged in
    `~/.claude/plans/go-through-the-entire-crystalline-bee.md` as P1 (launch
    blockers), P2 (web catch-up + data-model debt) and P3 (quality). **Read
    that file before picking the next thing** — it is the audit's full output,
    not just what got built.
19. ~~A development build~~ — done 2026-07-30. Apple Developer enrollment
    (Individual), EAS env vars on all three environments, distribution
    credentials, APNs push key, `ITSAppUsesNonExemptEncryption` set.
20. ~~First store build on TestFlight~~ — done 2026-07-30. Build 4 (0.1.0)
    submitted via `eas submit` (ASC app `6796259740`, name **FOUR**, API key
    stored on EAS so future submits are non-interactive). `/privacy` and
    `/terms` live and public; the FOUR mark on all four icon surfaces via
    `scripts/make-mark.ps1`.
21. **← ACTIVE: build 5, then external testers.** Build 5 carries the
    2026-07-30 owner-feedback round (posture removal, settings text, TimeRow,
    keyboard, walkthrough) **and the 2026-07-31 grid-swap round** (trailing-30
    Home, calendar History, the day panel, `prompt=select_account`, the
    `DELETE` confirm). **None of the 07-31 work has been seen on a device** —
    check the two grid layouts, tapping a day on each, and a blank day's
    wording before submitting. Then: add it to both TestFlight groups, submit
    the external group for **Beta App Review** (needs Test Information + a demo
    account in the review notes; the public link is dead until approval), and
    only after build 5 is installed run the deferred
    `20260730120000_drop_posture.sql` push. Apple + Google sign-in still need
    verifying on the TestFlight build — Google has worked once since the
    account-picker fix; Apple is unproven.
22. Then: **custom SMTP** (it unblocks the Magic Link template, which the OTP
    screen depends on — see *Blocked*) · store listings · Android notification
    icon · FCM V1 credentials for Android push.

## Deliberately partial — grows later (scope ledger)

| Area | What ships now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Levers | Fully user-defined on web: table, CRUD actions, Settings manager, 1–4 layout | Same on mobile | Done on web |
| Onboarding | Web: one screen (rule + 1–4 levers). Mobile: four steps + a first-open walkthrough | Unchanged | Done both, 2026-07-30 |
| Auth | Email + password, explicit create-account, magic link | Apple · Google · 6-digit code | With mobile |
| Day grid | Lightness ramp, generated per lever count | Unchanged; steps grow with user-defined levers | Done |
| Proof trend | Daily points, 60-day window | Unchanged | Done |
| Weight | Opt-in toggle, field, and line — **migration not yet applied** | Unchanged | Needs `db push` |
| Posture | **Removed 2026-07-30** — strict-only, one voice. Column drop deferred to after build 5 (see Blocked) | — | Closed |
| Walkthrough | **Mobile: 7-page manual of real rendered components**, auto-once per device, reopens from About. Web: none | Web parity if anyone asks | Mobile done 2026-07-30 |
| Mobile `/proof` | Full: daily check, journal, trend, optional weight, the log | Unchanged | Done |
| Mobile levers | Full: create, rename, archive, with native alerts | Unchanged | Done |
| Mobile auth | **Email + password, Sign in with Apple, Google, and a 6-digit email code** (the code doubles as forgot-password: sign in by code, set a new password in Settings). All built 2026-07-29; Apple/Google/OTP are inert until the Supabase dashboard config in *Blocked* is done | Verified on device, with custom SMTP | Config, then device test |
| Daily reminder | **Mobile: opt-in toggle + native time picker in Alerts and onboarding; local notification, reconciled on app start.** Web: none | Unchanged — the reminder is a phone thing | Mobile done 2026-07-29 |
| Account management | **Mobile: change email, change password, export JSON, delete account (RPC + typed confirm), sync row, About/privacy/terms/support.** Web: none of it | Web gets parity eventually | Mobile done 2026-07-29 |
| App icon | The FOUR mark (JetBrains Mono 700, 2×2), generated by `scripts/make-mark.ps1` on all four surfaces | Real branding pass | Placeholder by design, 2026-07-30 |
| Widgets | None | Interactive Home/Lock Screen widget: tap a lever without opening the app | v1.1 — SwiftUI + Glance, App Groups |
| Alerts | Telegram | Native push, same escalation ladder | Step 8 |
| Playbook | **No tab.** Still exists, still self-populates from logging, still feeds the lever sheet and the takeover | Unchanged — browsing it is not coming back | Decided 2026-07-28 |
| Daily note | A journal: auto-growing box, 6000 chars, today's entry loaded back for editing | Same on mobile | With mobile `/proof` |
| Outage annotation | `annotateOutage` action exists; no UI | Tap an outage in `/history` to label it | After real outages exist |
| Undo | **Mobile: there is no undo control.** A logged lever stays tappable; its sheet offers "add what else you did" or "remove today's <lever>". Web: still a per-lever undo | Same on web | Mobile done 2026-07-29 |
| Lever order | **Mobile: long-press and drag.** Drag to the trash to archive | Same on web (the RPC is shared and ready) | Mobile done 2026-07-29 |
| Settings layout | **Mobile: an index pushing into eight sub-screens on a native stack** (levers, alerts, tracking, account, change-email, change-password, delete-account, about). Web: one flat page | Same shape on web | Mobile done 2026-07-29 |
| Weight unit | **Mobile: kg/lb segmented in Tracking** (display only, never converts). Web: no control | Same on web | Mobile done 2026-07-29 |
| Archive motion | **Mobile: fade + collapse, with the list carried up.** Web: instant | Same on web | Mobile done 2026-07-29 |
| Settings "accessibility" section | None. The owner named it as an example of the pattern; there is nothing real to put in it — reduce-motion and text size are OS settings the app already honours | **Ask before inventing one** | Undecided |
| Day grid | **Both clients: Home is the trailing 30 (10×3), History is a stack of calendar months (7 wide).** Today pulses on both. Every day opens a read-only panel | Done — the swap is the final shape | Both done 2026-07-31 |
| Day panel | Levers + their detail text + that day's signals, read-only. **No weight** — `signals.amount` only exists after the optional-weight migration, so selecting it unconditionally would break a database without it; weight stays on `/proof` behind its opt-in | Weight here too, once the migration is universal | Done 2026-07-31 |
| Timezone | Defaults to Europe/Istanbul in DB | Device-detected at signup, editable | With mobile |
| Monetization | Free | Undecided. **The usual paywalls are all ruled out by the thesis**, not by preference — lever count is the product's name, longer history attacks re-entry, gamification fails a build test. Any model has to sell something other than a feature | Post-launch |

## Gotchas / open issues

- **Supabase + Google Cloud auth config was audited in the browser on
  2026-07-31 and came back CLEAN. Do not re-audit it; do not "fix" it.**
  Verified that day: Site URL `https://personal-system-rho.vercel.app`; redirect
  allowlist = `uptime://auth/callback`, `exp://**`, the Vercel wildcard; Google
  enabled, skip-nonce off, client `1017110614147-rj86gh…apps.googleusercontent.com`,
  type **Web application**, sole redirect URI
  `https://yqphirnsvcqzstwjfshs.supabase.co/auth/v1/callback`; Apple enabled with
  Client IDs `host.exp.Exponent,com.kagusoftware.uptime`. **Apple's OAuth secret
  key field is empty and that is correct** — the app uses native
  `signInWithIdToken`, which validates against the Client IDs list; the secret
  only matters for a *web* Apple OAuth flow this product does not have.
  *Still unknown as of that date:* the Magic Link template's raw source (the
  dashboard locks Source view without custom SMTP).
- **The "Google sign-in redirects to localhost" report is unexplained and NOT
  currently reproducing.** It was reported on both TestFlight and Expo Go. Two
  theories were built and both are dead: the redirect allowlist was already
  correct (above), and `Linking.createURL` returning a Metro dev-server origin
  cannot explain the TestFlight case. Supabase's auth log shows the app sending
  `uptime://auth/callback`, Supabase accepting it and handing off to Google —
  and no return. Nothing in the mobile bundle contains the string `localhost`.
  Google sign-in has since completed end to end. **`oauth.ts` now carries the
  computed `redirectTo` and the landing URL on every failure and surfaces them
  in `__DEV__`, so if it returns, one run identifies it. Instrument, then fix —
  do not guess a third time.** If it recurs, the cheapest evidence is a
  screenshot of the browser sheet with the URL bar visible: no port implies a
  Google-side page, `:8081` implies Metro, `:3000` implies a Site-URL fallback.
- **A failure state is never red or amber, and this is a product rule, not a
  style preference.** `down` and `degraded` describe the state of the user's
  own system. An app that cannot reach its database is a different axis, and
  painting it red says "you are down" when the truth is "we could not read" —
  landing hardest in the exact moment the product is designed for, reopening
  after days away. Faults are stated at full ink inside a bordered `surface`
  well: emphasis by containment, not hue. `components/states.tsx` on mobile and
  the same treatment inline on web. **Owner review welcome — this was decided
  during the 2026-07-29 audit round and is reversible.**
- **If `tsc` says "Cannot find module '@uptime/core'", run `npm install` at the
  repo root — the workspace symlinks are stale, and typecheck has been lying.**
  `node_modules/@uptime/*` are symlinks baked with an absolute path. The repo was
  moved from `kagu/uptime` to `kagu/four`, which left all three pointing at a
  directory that no longer exists. `@uptime/core` was then unresolvable, so
  `npm run typecheck` failed on a **clean checkout** with a wall of module-not-
  found errors — and every genuine type error in both apps was hidden behind
  them. Found and repaired 2026-07-31. **Any move or rename of the repo folder
  breaks this again**, and the symptom points nowhere near the cause.
- **A read that fails must never render as an empty state.** `loadSignals` used
  to return `[]` on error, so a dropped connection told someone with months of
  journal that they had written nothing — on the one screen whose job is to be
  evidence their history is intact. Reads now return `{ rows, error }` and a
  failed refresh KEEPS what is already on screen rather than blanking it.
- **`logSignals` bails if it cannot read the existing note.** The append path
  reads today's note, then upserts the joined text. If that read fails,
  `appendNote(undefined, …)` returns only the new text and the upsert
  REPLACES the day's journal. Failing the whole save is the only honest option
  — the user still has their text in the field.
- **The outbox distinguishes permanent from transient failures.** A SQLSTATE in
  class 22/23/42 (bad input, constraint, permission) describes the request and
  will fail identically forever; anything else is worth retrying. Transient
  stops the pass to spare the battery; permanent moves that one item to a
  dead-letter list and the pass continues. Before the split, a single
  unsendable tap sat at the head of the queue and blocked every later one
  **forever**, with nothing on screen to say so. Refused taps surface on
  Settings → Account.
- **`registerForPush` must be called with `{ prompt: false }` from anywhere
  that is not a deliberate user action.** The tab layout runs it on every
  mount; when it could prompt, someone who chose "start without alerts" in
  onboarding got the OS dialog seconds later anyway. Same split as
  `syncReminder` vs `reconcileReminder` in `reminder.ts` — keep it.
- **Unregister the push token BEFORE `signOut()`.** It is an RLS-protected
  write and needs the session that is about to end. Skipping it left a
  signed-out phone still receiving that account's pages.
- **The monitor's per-user loop must stay inside its try/catch.** `runPass()`
  is extracted precisely so one account's failure is contained. One bad
  timezone used to end the pass for everyone after it in the list — the pager
  failing closed, silently, for people who had done nothing wrong.

- **An unguarded `Stack.Screen` declared before the `Stack.Protected` branches becomes the INITIAL ROUTE when those branches guard away.** `auth/callback` was declared right after `(auth)`; the moment a session existed, `(auth)` left the stack and the callback — an invisible redirect screen — won initial route. Its redirect pointed at `/`, which is guarded behind `onboarded === true`, so the first Apple sign-in on a fresh account redirected into nothing: a blank screen that survived reloads (2026-07-29). Two rules: unguarded utility screens go LAST in the stack, and any `Redirect` must target a route the gate has actually mounted for every state it can render in (`/sign-in` / `/onboarding` / `/`).
- **React Native's `Switch` ships `alignSelf: 'flex-start'` as a default style** (`Switch.js:267` in RN 0.81). It silently beats the parent row's `alignItems: "center"`, so every switch pinned to the top of its row while the label sat centered. `SwitchRow` passes `style={{ alignSelf: "center" }}` — caller style composes after the default, so it wins. Any future bare `Switch` needs the same override.
- **Never `Link asChild` around a Pressable whose `style` is a function.** expo-router 6's `asChild` cloning drops a function-form `style` instead of invoking it, so the child renders with NO styles at all — `LinkRow` shipped this way and every settings row drew as an unstyled stacked column (title / value / chevron on separate lines, no padding) while `ValueRow` and `ActionRow` on the same screen were fine. Found by comparing the three row types in one screenshot, 2026-07-29. `LinkRow` now uses `router.push` in `onPress` and sets `accessibilityRole="link"` by hand. If a Link wrapper is ever genuinely needed, give the child a static style object.
- **The mobile Supabase client is PKCE now** (`flowType: "pkce"` in `apps/mobile/src/lib/supabase.ts`) — required by the Google browser round-trip's `exchangeCodeForSession`. Password/OTP/Apple are unaffected; the web app has its own client and is untouched. Hermes has no WebCrypto, so auth-js logs a "code challenge method will default to plain" warning on device — expected, not a bug.
- **Apple sign-in has two token audiences.** Expo Go mints tokens for `host.exp.Exponent`; a real build mints them for `com.kagusoftware.uptime`. The Supabase Apple provider's *Client IDs* field must list **both**, comma-separated, or whichever world is missing fails verification.
- **The OTP screen types a code the default email does not contain.** Supabase's Magic Link template ships with only `{{ .ConfirmationURL }}`; add `{{ .Token }}` or the 6-digit phase is unanswerable.
- **The migration harness now runs migrations in true chronological order and loads `btree_gist`.** It used to run "everything except custom_levers" first, which broke the moment `lever_order` (newer than custom_levers, touches its table) existed — and PGlite ships `btree_gist` as an opt-in extension, which the deferrable EXCLUDE needs. Both fixed 2026-07-29; 19 checks.
- **`expo-file-system` 19 is the new object API** (`File`, `Paths`) — `writeAsStringAsync`/`cacheDirectory` moved to `expo-file-system/legacy`. `lib/export.ts` uses the new one.
- **Only `lib/reminder.ts`'s `syncReminder`/`sendTestAlert` may raise the notification permission prompt in settings** — the app-start `reconcileReminder` path deliberately never prompts. Keep that split: a permission dialog at launch, apropos of nothing, is the wrong first impression.
- **THE CROSS-SCREEN SYNC TRAP (2026-07-29) — read this before touching any mobile data hook.** `useStatus` was a module-level `let cached` wrapped in a per-screen `useState`, so `refresh()` updated the variable and *the calling screen only*. Nothing was subscribed. A focus refresh on every tab was silently covering for it — everyone re-fetched, so everyone converged. Adding a 30s staleness guard removed the cover and produced **three separate bug reports that looked unrelated**: logging took ~30s to show, the Track-weight toggle "did nothing", and adding a lever "did nothing". All one cause. It is now a real store (`lib/store.ts` + `useSyncExternalStore`). **Never reintroduce a bare module variable read through `useState`, and never let a screen depend on another screen deciding to reload** — the sheets can call `refreshStatus()` directly for exactly this reason.
- **The outbox must reload BEFORE it shrinks the queue.** The queue is an overlay on the server's view (`applyToDay`). Dropping a settled item first hands the screen back a `todayLevers` the server has not re-sent, so an undo landed, the lever reappeared for the length of the round trip, then vanished again — three visible state changes for one tap. `drain()` awaits `onFlushed()` first. Do not "simplify" that ordering.
- **There is exactly one entry write path: the outbox.** `logEntry`/`undoEntry` used to exist in `lib/status.ts` alongside `send()` in `lib/outbox.ts` — same upserts, different timing. The log sheet used the slow one and awaited the network before dismissing; the dashboard used the outbox and felt instant. They are gone. Anything that logs or undoes calls `queueWrite`.
- **`supabase` runs from the REPO ROOT; `expo` and `eas` run from `apps/mobile`.** Both directions have bitten. Running `supabase db push` from `apps/mobile` finds no local migrations, reports *"Remote migration versions not found in local migrations directory"*, and then **suggests `migration repair --status reverted` for every applied migration — do not run that.** It marks applied migrations un-applied and the next push tries to re-create existing tables. It also drops a stray `apps/mobile/supabase/.temp/` that must be deleted. Happened 2026-07-29.
- **A day's grid shade is computed against the levers that existed THAT day**, via `leversOn` — not against today's active count. Using the current count meant adding a fourth lever retroactively dimmed every complete three-lever day already on screen: the same class of problem as a stored counter, history changing because of a decision made after it. `levers.archived_at` is maintained by a database trigger (`stamp_lever_archived`), so no client has to remember.
  **This shipped broken twice on 2026-07-29 and both failures are worth knowing.** (1) `levers.created_at` is when the ROW was written — the custom-levers migration backfilled every pre-existing lever with the migration's own timestamp, so months of real entries sat before it. `leversOn` floored the answer at 1 there, on the written-down assumption that "a day before any lever existed can have no entries on it", which is false for exactly those rows. Every such day rendered one-of-one — a day where you did half of what you had came out **fully lit**. The floor is gone: before the earliest thing we know about, it projects the earliest known lever set backwards. `20260729020000` also backdates `created_at` to each lever's first entry, because an entry is proof the lever existed. (2) `archived_on` was compared with `<`, so a lever archived TODAY still counted today — with the backfill stamping every already-archived row at `now()`, two-of-two read as two-of-**three** and could never fill. It is `<=` now: creation is inclusive, archiving is exclusive. **A lever's span is `[created_on, archived_on)`.**
- **Reordering levers needs a DEFERRABLE constraint and goes through an RPC.** `position` is unique among active levers and `check (position between 1 and 4)` leaves nowhere to park a row mid-swap, so *every* reorder passes through a state where two levers claim one slot. A plain unique index rejects that moment. `20260729000000_lever_order.sql` swaps it for a deferrable `EXCLUDE` (the only constraint type taking both a partial `WHERE` and `DEFERRABLE`) and adds `reorder_levers(uuid[])`. **The four-lever cap is unchanged and still structural** — only *when* uniqueness is checked moved to COMMIT. If reordering ever reports "could not save that order", the migration is not applied.
- **`GestureDetector` needs `GestureHandlerRootView` and expo-router does not provide one.** It is in `src/app/_layout.tsx`. Without it the lever drag gesture silently never activates — no error, nothing. (The native stack's edge-swipe is unaffected; that one is handled natively by react-native-screens.)
- **Tab screens must pad `insets.bottom + TAB_BAR`, not `insets.bottom`.** The bar is translucent, so content slides under it and stays readable-but-unreachable. `NativeTabs` exposes no height and expo-router 6 mounts no `BottomTabBarHeightContext`, so `useBottomTabBarHeight()` throws here — `TAB_BAR` in `theme.ts` is a constant for that reason. Use `components/screen.tsx` rather than rolling it per screen.
- **`contentInsetAdjustmentBehavior` must be `"never"` on EVERY ScrollView, not just tab screens.** Left automatic, UIKit computes its own safe-area/keyboard inset *after* first layout, on top of what JS already added — two sources of truth for one number, one arriving a frame late. That was the visible page-switch twitch (2026-07-29), and the same double-accounting under a `KeyboardAvoidingView` was the sign-in keyboard/QuickType twitch (2026-07-30) — the fix had been applied to `screen.tsx` and `takeover.tsx` but never to the auth and onboarding ScrollViews. A residual frame from `NativeTabsView`'s `useDeferredValue` remains and is upstream.
- **`TimeRow`'s picker Date is pinned to UTC — keep it that way.** The Date is a carrier of digits (`Date.UTC` in, `timeZoneName="UTC"` on the picker, `getUTCHours` out), never an instant. Built with local rules on an old base day, Hermes and native UIKit disagreed about Istanbul's historical offset (UTC+2 in 2000, +3 now) and a picked 13:20 was stored as 14:20 — while the picker, converting back the other way, kept showing 13:20 and hid the bug. Owner report, 2026-07-30.
- **Day boundary is 04:00 local, not midnight.** A 01:30 session counts for the day that just ended. `logicalDate()` handles this; don't bypass it.
- **RESOLVED 2026-07-28 — do not use `logicalDate()` on mobile.** Hermes delegates Intl to platform ICU and the behaviour varies by Android version. Documented failures: `RangeError: Invalid timezone name!` for valid IANA zones (hermes#572), the options object ignored entirely on API 21-23 (hermes#776), and `resolvedOptions().timeZone` reporting `UTC` because the device zone is never exposed. It can pass on a test device and fail on a user's.
  **Use `logicalDateLocal(now)` instead** — no Intl at all. A phone's `Date` is already in the user's local time, which is the timezone the 04:00 boundary actually means. `hasTimeZoneSupport(tz)` probes the engine if you need to know. A test cross-checks the two implementations agree under Node, so a divergence fails CI rather than silently corrupting a month of history.
  **The mobile client must write the device's zone back to `system_state.timezone`**, or the server-side monitor will page on a different day than the phone is showing.
- **The proof trend and `evaluatePlateau` are two different readers of the same data.** The trend becomes **daily**; plateau detection stays **weekly**. This already caused one bug: `evaluatePlateau` claimed to group by week but keyed on the raw date, so with daily input the 4-week window collapsed to 4 days and would have paged constantly. **Do not "fix" plateau to match the trend.** A plateau judged on raw days is a mood, not a trend.
- **The day-grid ramp floor is `L 0.51`, and the binding constraint is the DOWN cell, not the background.** At `L 0.49` the dimmest up-day measured 2.83:1 against a down cell — up-versus-down is the most important read in the grid. Check against the wrong reference and the dimmest up-day vanishes into a gap.
- **`--color-line-hi` was raised 0.42 → 0.51 on 2026-07-28.** At 0.42 it measured 2.27:1 and failed WCAG 1.4.11's 3:1 non-text floor while drawing the ring that marks *today*. Now 3.33:1. Don't revert it for aesthetics.
- **Empty history must read as 0 days down, never a large number.** An early bug greeted a new user with "DOWN 400 DAYS" — the precise framing the app exists to avoid. There's a regression test; keep it.
- **Archiving a lever must never change past uptime.** Entries are never deleted; the day grid and the 30-day number must be byte-identical afterward.
- **A milestone notices; it never rewards.** The `STRICT`/`SOFT` posture setting was removed 2026-07-30 (strict-only, one voice), but its guard survives: no badges, points, streaks or confetti, ever, and copy may never touch what counts as up, any number, the thresholds, or the anti-shame invariants. `monitor.test.ts` scans every milestone string for the vocabulary of scoring, so drift fails the build.
- **Weight never affects uptime**, has no goal or target, and is off by default. It is a number the user chose to keep, not a score kept on them.
- **The monitor records its paging decision regardless of delivery success.** If that write moves back inside the "has a channel" branch, an unconfigured channel re-pages every pass.
- **Two credentials were exposed in a chat transcript on 2026-07-19 and should be rotated:** the Supabase account password, and the Telegram bot token (BotFather `/revoke`, then update `apps/web/.env.local` and the Vercel env var). Verified 2026-07-28: **no `.env` file was ever committed**, so git history is clean — the exposure was transcript-only.
- **The note field opens BLANK, and writing again APPENDS.** Being handed back this morning's text every time is not how a journal is used (owner, 2026-07-28). But the row upserts on `(user_id, observed_on, kind)`, so a blank field plus a plain upsert would silently replace what was already there — `appendNote` in core joins them with a blank line instead. Editing an existing day is a separate, deliberate act: tap it in the log on mobile. **Web still prefills** and has no per-day edit; that is the remaining inconsistency.
- **Native sheets are `UIModalPresentationFormSheet`** — verified in the type definitions, not assumed. The side insets are UIKit's own formSheet metric, not a bug. `sheetAllowedDetents` (and so `fitToContents`) **only works with `formSheet`**; switching to `pageSheet` gives edge-to-edge at the cost of a full-height sheet regardless of content. Each sheet screen sets `contentStyle` to `surface` and pads its own bottom inset — without that, the strip behind the home indicator paints in the darker page background and reads as a black bar under the content.
- **The daily note is a journal, and that changed two things.** The owner had been using it as a diary, so as of 2026-07-28 it is one: `NOTE_MAX` is 6000, the box auto-grows, and the prompt is "what's up?" rather than "anything moving?". The consequences: (1) the note **upserts on `(user_id, observed_on, kind)`**, so a second write the same day REPLACES the first — `/proof` loads today's note back into the field so that is an edit, not data loss; (2) the check-in **no longer hides itself once something is logged today**, because "you already checked in this morning" is not a reason to refuse what happened this evening. Keep both properties.
- **The playbook has no tab, on purpose (2026-07-28), but the playbook is NOT gone.** It still self-populates from logging and still feeds the lever sheet and the takeover — those are where it earns its keep. Only the browse/manage screen was removed, along with `updatePlaybook`. Do not "restore" the tab; do not delete the table.
- **`/proof` fetches a row limit, not a date range.** Daily sampling writes up to 3 rows a day, so the 280-row limit backs the 12-week window. **Adding weight as a fourth kind shortens that window silently** — raise the limit when weight ships.
- **`.env.local` lives at `apps/web/.env.local`, not the repo root.** `scripts/_session.mjs` resolves that path relative to its own location so there is one copy of the secrets.
- **`.gitignore` patterns are deliberately un-anchored.** A root-anchored `/node_modules` would silently stop ignoring `apps/web/.next`.
- **Reads in `getSystemState` and `/proof` tolerate an unmigrated database.** The weight columns are selected optimistically and retried without them on error, and `amount` is only touched when the opt-in is on. This exists because a deploy and a migration never land at the same instant, and a missing column should not take the whole app down for the minutes in between. Keep that property when touching either read.
- **A new signup gets NO levers — `/onboarding` is what writes them.** The trigger only creates `system_state`. `requireStatus()` in `lib/system.ts` is the gate that keeps an un-onboarded account off the dashboard, and **every signed-in page must call it rather than `getStatus()`** — a page that skips it renders a dashboard with no buttons. `/onboarding` itself deliberately does not, or it would loop.
- **`getLevers` treats a failed read and an empty read differently, on purpose.** A *failed* read means the table is not there yet and falls back to the historical gym/food pair. An *empty* read is a real un-onboarded account and returns empty. Collapsing those two back together would hand every new user two levers they never chose.
- **The takeover must always have a reachable action.** The playbook is empty for every new account now that signup seeds nothing, so "just mark it up" is the floor of that screen, not a nicety — it logs a lever with no detail. With one lever it is a single ghost line; with more it expands into the lever set; with an empty playbook the levers are shown immediately. A takeover with nothing tappable is the worst dead end this product could ship.
- **Input borders across the app measure 1.45:1 against the page** (`--color-line` on `--color-bg`), and the fill is 1.08:1. That is below WCAG 1.4.11's 3:1, and it is the shared pattern in login, the lever manager, the playbook sheet and onboarding. Each field is identifiable by its placeholder at 5.08:1, which is the exception 1.4.11 allows — but **this is a live app-wide decision, not a settled one**. Raising resting borders to `line-hi` (3.33:1) would fix it and would need a new focus treatment, since focus currently *is* `line-hi`. Owner's call; flagged rather than changed unilaterally.
- **`ink-mute` on `surface-hi` sits at 4.60:1**, the tightest text pair in the app (the settings segmented control's quiet side lives there). Any future darkening of ink-mute or lightening of surface-hi breaks it. Re-run `npm run check:contrast` on any palette change.
- **"Food first" is gone.** The takeover and the monitor used to rank the food lever first, on the principle that coming back must be lighter than starting. That cannot survive user-defined levers — we cannot know which of someone's levers is the light one — so both now rank by what has actually worked (pinned, then use_count). If you want the old behaviour back, it needs a user-nominated "lightest" lever, which is new product scope.
- **A migration is not done until `npm run test:migrations` passes.** There is no Docker here, so PGlite is the only pre-flight check, and `supabase db push` is not reversible. That harness already caught an `on delete restrict` that would have broken Apple-mandated account deletion.
- **The old `handle_new_user()` seeded gym AND food playbook rows for every signup**, so every pre-existing account carries both levers and the backfill covers everyone through `playbook` even if they never logged. The new trigger seeds nothing — onboarding writes the levers.
- **The app is on Expo SDK 54, moved back from 57 on 2026-07-28** so it runs in the owner's Expo Go. `Stack` is `expo-router/stack`, not `expo-router`; root `Tabs` is deprecated; the tab bar is `NativeTabs` from `expo-router/unstable-native-tabs`, and on 54 `Icon`/`Label`/`VectorIcon` are **top-level exports** rather than sub-components. A doc lookup gave the old, wrong answer for `Stack` — **read the installed `.d.ts` files**, which is what `apps/mobile/AGENTS.md` says. **Do not bump the SDK without checking what Expo Go the owner has.**
- **`Label` and `Icon` must be DIRECT children of `NativeTabs.Trigger`.** expo-router walks the children and matches on strict element identity, so a tidy wrapper component produces the wrong element type and is silently dropped — which is exactly how the app once shipped with no tab icons at all.
- **The day-grid ramp is proportional, and the No-Subdivision Rule stands.** Lightness is `0.51 + (fired / leverCount) × 0.44`; the cell is never divided into a partial bar. A proportional *bar* was built and reverted the same day (2026-07-29) — it was legible, and it was also the product telling someone their day was three-quarters missing. Values are pre-resolved hex in `packages/core/grid.ts`, generated with the same oklch→sRGB conversion `scripts/check-contrast.mjs` uses.
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
npm test             # packages/core — 162 tests, the gate for everything
npm run typecheck    # both workspaces
npm run lint
npm run test:migrations  # runs every migration against real Postgres (WASM)
npm run check:contrast   # measures every colour pair against its WCAG floor

# Mobile (needs apps/mobile/.env.local — copy .env.example)
npm run mobile           # Expo dev server; scan the QR with Expo Go or a dev build
npm run mobile:ios
npm run mobile:android
cd apps/mobile && npx expo export --platform ios   # proves the module graph resolves
cd apps/mobile && npx expo lint
npm run build

# Migrations: FROM THE REPO ROOT, never from apps/mobile. See Gotchas.
npx supabase migration list   # local vs remote; "remote": "" means not applied
npx supabase db push

# Dev helpers (credentials from apps/web/.env.local)
npm run seed -- 31 11             # 31-day run that ended 11 days ago
npm run shoot -- out ",history,proof"
npm run reset                     # wipe synthetic data
```

Exercise the monitor locally without sending anything. **Header only** — the
`?secret=` form was removed on 2026-07-29:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/monitor/check?dry=1"
```

## Development builds and push

**There is no `eas` command on this machine — it runs through `npx`.**
Everything below is run from `apps/mobile` and needs a free Expo account.

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init      # creates the project, writes extra.eas.projectId into app.json

# EAS Build does NOT see .env.local — it is gitignored and never uploaded.
# The keys live in EAS instead, so nothing lands in a public repo.
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://<ref>.supabase.co" --environment development,preview,production \
  --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --value "sb_publishable_..." --environment development,preview,production \
  --visibility plaintext

npx eas-cli@latest build --profile development --platform android  # APK, no Apple account
npx eas-cli@latest build --profile development --platform ios      # needs an Apple Developer account
```

**Why this is needed at all:** `expo-notifications` cannot issue a push token
without an EAS `projectId`, and **remote push does not work in Expo Go** — so
the escalation ladder is untestable until a development build exists.
`registerForPush` already fails soft and says why (`"no EAS projectId; run
eas init"`), so nothing crashes in the meantime.

**Android is the cheap path**: EAS builds an APK you install directly, no Apple
account and no Mac. iOS device builds need an Apple Developer account ($99/yr)
or Xcode on the team's Mac.

If the Expo account is an **organisation** rather than a personal one, add
`"owner": "<org-slug>"` to `app.json` first, or `eas init` creates the project
under the wrong account.
