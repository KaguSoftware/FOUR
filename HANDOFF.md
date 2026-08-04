# four — Handoff

> **New chat? Read this file top to bottom before doing anything.** It is written
> to be sufficient on its own. Companions: `PRODUCT.md` (product truth),
> `DESIGN.md` (visual system), `.impeccable/design.json` (design sidecar), and
> the approved plan at
> `~/.claude/plans/this-system-needs-some-adaptive-rossum.md`.

## If the user just said "continue"

**There are TWO active tracks as of 2026-07-31**, both marked `← ACTIVE` in
*Roadmap* below. They do not depend on each other:

- **iOS track** (step 21) — build 5 to TestFlight, then external testers.
- **Android track** (step 23) — the first Android build onto a device.

Ask the owner which one they mean if it is not obvious. Before you start:

1. Check *Blocked / needs the owner* — do not re-do work that is waiting on them.
2. Run `npm test`. **162 tests must be green.** They encode the invariants the
   product rests on; if they are red, stop and fix that first.
3. Skim *Gotchas*. Several are traps that have already cost time once.
4. **If this is a different machine**, read *What exists ONLY on the work PC*
   before running anything — `apps/mobile/.env.local` is gitignored and the
   app will not build without it. It is recoverable in one command.

**The app is now running on real hardware** (as of 2026-07-29) and the owner is
testing on a device. That changes how to work on it: bugs arrive as descriptions
of what the screen did, not as failing tests, and several have been regressions
invisible to `tsc`. See *The cross-screen sync trap* in Gotchas — it caused three
separate reported bugs in one day.

**⚠ Expo Go stopped working on 2026-07-31** — a native module (Google
Credential Manager) is now in the tree, by the owner's explicit decision.
Testing means an **EAS dev build**. See *Gotchas* and *Development builds and
push*.

**FOUR rounds are now stacked up unseen on hardware** — the 07-31 grid swap,
the 07-31 Android-native pass, the 08-03 proof/mood/activities round, and the
**08-04 auth-screen round** (all below). Every one is `tsc`-clean and every one
touches layout, which is exactly the class of change `tsc` cannot judge. Get
them onto a device before adding a fifth.

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
| **Android depth** (2026-07-31) | **Full native — a dev build is required.** Native modules are allowed; **Expo Go no longer runs the app.** Owner's call, taken to get Credential Manager sign-in |
| **Android divergence** (2026-07-31) | **Android may look different where the Material idiom is conventional** — snackbars, summary-style settings rows, an M3 segmented group. The palette, the type ramp and the four custom components stay identical on both |

**Why Expo, in one line:** widgets are native in *every* scenario (WidgetKit is SwiftUI-only; Android widgets are Kotlin/Glance), so the real choice was 1 app codebase + 1 derivation engine versus 2 app codebases + 3 derivation engines.

## Stack & environment

- **Monorepo** on npm workspaces: `packages/core`, `apps/web`, `apps/mobile`
- **Mobile: Expo SDK 54** / React Native 0.81.5 / expo-router 6 / Reanimated 4 / react-native-gesture-handler
- Next.js 16.2.10 (App Router, Turbopack) · React 19.2 · Tailwind v4 (CSS-first)
- Supabase (Postgres 17, Auth, RLS) — project `yqphirnsvcqzstwjfshs` ("parsa-system", eu-west-1)
- Vercel (cron via `apps/web/vercel.ts`) · Vitest · Playwright (dev screenshots only)
- Node 24.15, npm 11.16, Windows 11 + Git Bash
- Repo: **`github.com/KaguSoftware/FOUR`** — `origin`, and the only remote. This is `ParSaMnSS/personal-system` **transferred** to the Kagu org on 2026-07-28, not a new repo, so full history came with it, and **renamed `uptime` → `FOUR` at some point before 2026-07-31**. The rename surfaced on that date as a `remote: This repository moved.` notice during a push; GitHub still redirects the old URL, so pushes keep working and this is not urgent. To stop the notice:
  ```bash
  git remote set-url origin https://github.com/KaguSoftware/FOUR.git
  ```
- Timezone: **Europe/Istanbul** (UTC+3, no DST) — becomes device-detected for public users

**No secrets in this file.** Env vars live in `apps/web/.env.local` (gitignored) — see README for the table.

## External services — every dashboard, and what it owns

Six services now, and no two use the same identifier. Written down so nobody
has to reconstruct the list or guess which project is which.

| Service | Dashboard | Identifier | Owns |
| --- | --- | --- | --- |
| **Expo / EAS** | [expo.dev/accounts/parsa-mansouri/projects/uptime](https://expo.dev/accounts/parsa-mansouri/projects/uptime) | project `3570cebf-a9dd-458f-a2ce-14093600c025`, slug `uptime` | Builds, submissions, env vars, iOS + Android credentials, **the Android keystore**, and the **registered device list** (`eas device:list --apple-team-id BR42V976FS`) |
| **App Store Connect** | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) | app `6796259740`, name **FOUR**, **Apple team `BR42V976FS`** (Individual) | iOS builds, TestFlight, App Store listing. One device registered for ad-hoc: the owner's iPhone, `00008110-000674641EEA201E`, 2026-08-03 |
| **Google Play Console** | [play.google.com/console](https://play.google.com/console) | account `8319744677397056181` | Android store listing. **Created 2026-07-31, Personal account, unverified** |
| **Google Cloud** | [console.cloud.google.com](https://console.cloud.google.com) | project `high-office-503913-q9` ("four") | OAuth clients + consent screen for Google sign-in |
| **Firebase** | [console.firebase.google.com](https://console.firebase.google.com) | — | FCM V1 for Android push. **Not set up as of 2026-07-31** |
| **Supabase** | [supabase.com/dashboard](https://supabase.com/dashboard) | project `yqphirnsvcqzstwjfshs` ("parsa-system", eu-west-1) | Postgres, Auth, RLS |
| **Vercel** | [vercel.com](https://vercel.com) | — | The web app, and the monitor cron |

**Checking any of these is done by handing the owner a written Chrome-agent
prompt** — see *Working style*. Never guess at dashboard state.

## What exists ONLY on the work PC

Everything below is gitignored, so a fresh clone on another machine does **not**
have it. None of it is lost — each has a recovery path — but a new machine is
not ready to build until these exist.

| Missing after a fresh clone | Recover with | Notes |
| --- | --- | --- |
| `apps/mobile/.env.local` | `cd apps/mobile && npx eas-cli@latest env:list development` — then write the three values into the file | All three are `EXPO_PUBLIC_*`, i.e. public by design and safe to read back this way. See `.env.example` for the file's shape. |
| `apps/web/.env.local` | **Not on the work PC either** — never has been. Pull from Vercel's project env vars. | Only the web dev server and the dev scripts need it. Tests, typecheck, lint, both builds and `supabase db push` all run without it. |
| `apps/mobile/*.jks` | `npx eas-cli@latest credentials -p android` → *Download existing keystore* | A **backup only**. EAS holds the canonical copy and uses it server-side, so builds work on any machine without this file. |
| `node_modules/` | `npm install` at the repo root | |

**The keystore is the one thing that would be unrecoverable**, and it is safe:
EAS stores it, and a local `.jks` backup was downloaded on 2026-07-31. It is
gitignored via `*.jks`. **Move that file off the repo directory** to a password
manager or backup drive — see *Gotchas*.

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

- Schema pushed — 9 tables, RLS on all. Verified: anon reads return zero rows, cross-user insert rejected (42501). **All twelve migrations are applied to the live database, confirmed by `npx supabase migration list` on 2026-08-03** — including `drop_posture`, which this file long listed as deliberately held, and the two from the 08-03 round (`mood`, `activity_cap`). Local and remote match exactly; there is nothing outstanding.
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

- **The Android-native pass, 2026-07-31.** Everything below the structural line
  moved onto Android's own idioms — see *Roadmap* 22 for the list and
  `apps/mobile/AGENTS.md` for the reusable pieces and the traps. Verified:
  **162 tests, tsc clean ×3, `expo lint` clean, both bundles export, the web
  app builds, 30/30 contrast pairs pass.** The Android theme, notification icon
  and edge-to-edge were verified by reading a throwaway
  `expo prebuild --platform android` and then deleting it — no JS-only check
  can see them. **Nothing in this round has been on hardware.**

- **The proof/mood/activities round, 2026-08-03.** Five owner-requested
  changes, both clients:
  **(1) `/proof` is a pixel wall.** Its entire contents were deleted — both
  1–5 scales, both trend charts, the weight chart and the written journal —
  and replaced with a screen of cells, as many lit as `days up ÷ days in this
  calendar month`. A fixed set stays permanently dark in the shape of
  `KEEP GOING`, so the message is what the lit cells leave behind: nothing to
  read at the start of a month, readable a word at a time as it fills. Core
  gained `font5x7.ts` (a hand-drawn 5×7 bitmap font, parsed from `#`/`.`
  pictures, throwing on a malformed glyph) and `pixels.ts` (`pixelWall`,
  `wallGrid`, `pixelPaths`, `wallCaption`). Drawn as **two SVG paths** for
  ~2,500 cells, not 2,500 views.
  **(2) One mood slider on the dashboard**, frowny→smiley, continuous 1–100,
  replacing energy and sleep. The face geometry is `facePath` in core so both
  clients draw the same one; the input is the platform's
  (`@react-native-community/slider` on mobile, `<input type=range>` on web).
  **(3) Home's grid starts at day one** — `windowStart` in core is
  `max(firstLoggedDay, today − 29)`, one formula with no modes. A new account
  fills from the top-left instead of showing 27 blanks and three cells at the
  bottom-right that shifted every morning.
  **(4) History swipes between months**, one calendar per page, every page
  padded to six rows (`monthGrid(iso, { minWeeks: 6 })`) so the pager cannot
  jump.
  **(5) Activities are editable, capped at ten per lever**, from both the log
  sheet and Settings → Activities. Verified: **264 core tests, tsc clean ×3,
  eslint + expo lint clean, 39 migration checks, contrast clean, the web app
  builds, both bundles export.** **Nothing in it has been on hardware.**

- **The mood strip, 2026-08-04.** The dashboard's "how was today" section was
  rebuilt a third time, and this time the diagnosis was different: the two
  earlier attempts treated it as a layout problem, and it was not one.
  **The reading was effectively write-only.** Nothing in the app showed mood
  back except the day sheet, one day at a time behind a grid tap, as the
  literal string `63 mood` — a form `mood.ts`'s own docblock calls "not an
  answer". You fed it daily and never saw it again.
  It is now a **seven-bar strip**: six days behind you, today last, set by
  dragging anywhere on the row. The control is its own readback. Seven because
  a week is the unit `evaluatePlateau` already reasons in — it folds days into
  ISO weeks and discards any week under three readings — so the strip shows
  exactly the window the pager judges, and each bar is twice as wide to hit as
  a fortnight's would be. A `n/7` count sits on the label's row.
  **The face, the slider and the Save button are all gone.** Save existed
  because a drag taken to browse the faces was indistinguishable from an
  answer; there are no faces now, a drag has one meaning, and the strip shows
  the result immediately. Releasing writes. Owner's call, reversing their own
  08-04 decision — and it moves mobile *back towards* web, which has always
  committed on pointer-up and never had a Save button.
  **`moodWeek` and `moodBarHeight` are in core**, with the load-bearing rule
  under test: **an unanswered day is `null`, never `0`**. The monitor drops an
  unsampled day rather than inventing one, and `MOOD_MIN` is 1 — so
  `moodFraction` maps the lowest real reading to exactly 0, and without a floor
  a genuinely rough day would draw at the same height as a day nobody answered.
  That is the one distinction the whole design exists to make.
  Also: **the separate `loadMood` round trip is deleted.** `loadStatus` already
  selects every signal unbounded, so today's row was being fetched anyway and
  the extra request was pure latency — the same conclusion web reached earlier.
  **`@react-native-community/slider` is now unused in source but deliberately
  still in `package.json`**: removing a native module forces every dev build to
  be rebuilt, and it buys nothing. Drop it next time the build is regenerated
  for another reason.
  **Web is untouched** — it keeps the face and `<input type=range>`. The two
  clients have diverged on this control on purpose, for one round; `moodWeek`
  living in core is what makes the port cheap, and it can also replace web's
  local `todaysMood` helper.

  **Three refinements, same day, all owner-requested from using it:**

  1. **Today's bar grows while held**, on a spring, in both axes. Not
     decoration: the bar is ~40pt wide and a fingertip covers all of it, so the
     thing being adjusted is invisible at the moment of adjusting it. Widening
     past the finger puts an edge back on both sides and the extra height buys
     travel per pixel. It grows **outside its slot** — `marginHorizontal` goes
     negative by half the added width, so it expands from its own centre and
     **nothing else in the row moves**, which is the rule the lever grid
     already follows. The strip reserves `GROW_Y` of headroom and the header
     gives back the same amount, so the section's total height is unchanged.
     Under Reduce Motion the bar still grows — that is the feedback the drag
     registered — it just arrives without the spring.
  2. **A live readout floats over the strip while dragging.** Absolutely
     positioned so it costs no layout and nothing reflows as the digits change
     width, `pointerEvents="none"` so it can never intercept the drag it is
     reporting on, and gone the instant the finger lifts — a number parked
     permanently over the week would turn a glanceable strip into a dashboard.
     **`check:contrast` caught a real defect here**: its border was `line` on
     `surface-hi` at **1.22:1**, invisible. It is `line-hi` now, and measured
     against the page and the bars *behind* it rather than its own fill —
     the same reasoning already recorded for the snackbar's edge.
  3. **Double tap to type an exact number.** A drag is fast but imprecise, and
     "I want exactly 70 on this" is a real thing to want. `Gesture.Exclusive`
     gives the double tap first refusal so it is never also read as two drags.
     **`Alert.prompt` is iOS-only** — the same constraint the activity rename
     hit — so Android opens an inline field that *replaces* the strip rather
     than sitting under it, keeping the section's height fixed while the
     keyboard is up. Both paths land in one `commitTyped`, which clamps rather
     than rejecting.

  **The drag haptic fires per BAND, not per point.** A full-height drag crosses
  ~99 values and a tick on each is a continuous buzz that says nothing;
  `nudged` is documented as the constant for "switching between a series of
  potential choices", and the choices are the five words `moodLabel` bands the
  range into.

  Verified: **302 core tests, tsc clean ×3, eslint + expo lint clean, contrast
  clean (2 new enforced pairs, 1 defect caught and fixed), both bundles
  export.** **Not on hardware.**

- **The device-feedback round, 2026-08-04 (v0.1.2).** Nine fixes reported from
  using the app on an Android phone. Two were not defects and were put to the
  owner before building; the rest were real.
  **(1) Text fields are pinned LTR.** There was no RTL code in the repo at all —
  the OS was mirroring fields from the device's system language, and the first
  symptom was the sign-in password typing backwards. `writingDirection` +
  `textAlign` on the shared `field` style, plus `I18nManager.allowRTL(false)`
  in the root layout. **Android needs a full restart to show it.**
  **(2) The mood section was rebuilt twice.** Releasing the slider used to
  write immediately, so a drag taken to look at the faces was an answer. It is
  behind a Save now — full width, BELOW the slider, always rendered and merely
  `disabled` until dirty, which is the convention every other commit in the app
  already follows. The first cut put Save inside the slider's row and the track
  resized under the finger; the second stacked enough above it to push Home off
  the screen. The face gained a square head (`facePath` in core, so web draws
  the identical one) and the two axis faces and the reassurance copy are gone.
  **(3) `/proof` says what it is** — `days up uncover a message`, on the same
  ROW as the label because that screen is a `Frame` and any line added there
  comes straight out of the wall.
  **(4) Renaming an activity works.** Two separate defects: the log sheet's
  "Rename" called `manage()` and just navigated away, discarding the intent
  (now `Alert.prompt` on iOS, and Android routes carrying the id so the row
  opens in edit mode); and the editor only committed on the keyboard's "done",
  so tapping away silently discarded the edit (now commits on blur, with an
  explicit save button and a `cancel` that wins the race via `onPressIn`).
  Duplicate names now say so instead of surfacing a Postgres constraint string.
  **(5) Two actions on one lever no longer merge.** `treadmill · walk` was one
  row by schema — `unique (user_id, logged_for, lever)` — and read as a single
  invented activity. Owner chose a full split via a **child `actions` table**,
  which leaves `entries` and the outbox key untouched: `uptime.ts` derives
  up-days from a `Set` of distinct dates, so no derived figure can move, and
  there is a test asserting exactly that. `syncActions` runs after the entry
  write and swallows every failure — a failed action must never cost a day.
  Backfilled by splitting on `" · "`; `splitDetail` in core is the JS twin of
  that SQL. **No timestamps, stored or shown** — owner's explicit call.
  **(6) History swipes the right way.** `monthsBetween` returns newest-first,
  which put the current month at the far left. Reversed in `MonthStack` only —
  NOT in core, which the web pager reads with arrows labelled to match — with
  `initialScrollIndex` so it still opens on this month.
  **(7) The day grid stopped drifting.** Cells alternated `borderWidth` 1 and 0
  depending on whether the day was filled, and RN draws borders inside the box,
  so up-days and down-days were different sizes and rows sat a couple of pixels
  out. Every cell carries a 1px border now; a filled day's border is its own
  fill. Owner traced this one from the ring around today.
  **(8) Android's bottom inset.** The last element of every tab sat under the
  tab bar. `TAB_BAR` (80) + `insets.bottom` cleared the chrome to the exact
  pixel with nothing left over, so a button's border touched the bar. There is
  one `bottomInset()` helper now, carrying a `CHROME_GAP`, and the five hand-
  written copies of that sum are gone. **A `max()` version was tried first on
  the theory that edge-to-edge made the bar span the inset — a device photo
  disproved it; the two bars stack.**
  **(9) The day boundary is a setting** (Settings → Alerts), default 4am,
  bounded 0–12. History is never re-dated: `entries.boundary_hour` records what
  each day was filed under, and nothing derives uptime from it. The migration
  **drops** the old one-argument `logical_date` before recreating it — `create
  or replace` with a new parameter makes a SECOND function and every existing
  call then fails "function is not unique". `npm run test:migrations` caught
  that. Also: a Settings row that resets the seen-once flag so the first-launch
  guide can be retested without reinstalling.
  Verified: **292 core tests, all migration checks, tsc clean ×3, eslint +
  expo lint clean, contrast clean, both bundles export.** **Only items 1, 7 and
  8 have been seen on hardware; the rest of this round has not.**

- **The auth-screen round, 2026-08-04.** Four owner observations from looking at
  the sign-in screen, all the same underlying problem — the screen did not
  signal what was tappable.
  **(1) Google has a mark now.** `GoogleMark` in `components/ui.tsx` draws the
  official four-colour G as inline `react-native-svg`, and `Button` gained
  `icon` + `variant="provider"` (white fill, `#1f1f1f` text) to carry it. This
  branch — **iOS, and any Android without Play Services** — was the app's own
  grey button reading "continue with google" with no logo, sitting directly
  under Apple's white branded one. That was both the visual mismatch the owner
  saw and a Google-guidelines failure. The Android branded-button branch is
  untouched.
  **(2) "Authentication required." is gone** from both clients. It was the one
  piece of text on the screen and it read as a system error.
  **(3) The two email alternatives are real buttons.** They were `TextButton`s —
  12px grey text, no box — whose own docblock already conceded they "read as
  dead labels that happen to work". A new `variant="subtle"` on `Button` gives
  them the same border and radius as the primary at `TAP` height and `ink-dim`
  text, so they are unmistakably controls a clear step below the 56pt CTA.
  `TextButton` itself is UNCHANGED — it has seven other call sites ("← back",
  "sign out", "remove", the OTP resend) where a boxless link is correct.
  **(4) Nothing was needed in any dashboard**, so no Chrome-agent prompt was
  written. Every change is client-side rendering: no new scopes, no redirect
  URIs, no provider config.
  Verified: **tsc clean ×3, contrast clean (2 new enforced pairs, 1 exempt),
  both bundles export, the web app builds.** **Not on hardware.**

**Written but NOT verified end-to-end:**

- **Vercel cron has never run.** The route works locally; the schedule is unproven.
- **Push has never been delivered to a device.** Needs a development build; `expo-notifications` cannot issue a token without an EAS `projectId` and remote push does not work in Expo Go.
- **Drag-to-reorder and drag-to-archive have not been used on a device** as of this writing. The RPC they depend on is applied; the gesture itself is unproven on hardware.
- **The 2026-07-29 Settings/Auth surface is untested on hardware**: the daily reminder firing at its hour, the test alert, export's share sheet, change email/password round-trips, delete account against the live DB (its migration IS applied now, so it should work), Apple and OTP sign-in. Google sign-in has completed end to end since the account-picker fix.
- **The whole 2026-07-31 grid round is untested on hardware**: both grid layouts, tapping a day on each screen, how a blank day reads, and the `DELETE` confirm.
- **The whole 2026-07-31 Android round is untested on hardware.** In rough
  order of how likely each is to be wrong:
  1. **The tab-bar allowance.** `TAB_BAR = 80` on Android plus `insets.bottom`
     assumes the Material navigation bar does **not** already consume the
     system inset. If it does, every screen has ~48dp of dead space at the
     bottom. Scroll all four tabs to the end and check the last element is
     reachable, not merely visible.
  2. **The keyboard under edge-to-edge.** All eight `KeyboardAvoidingView`s
     pass `behavior={undefined}` on Android and rely on `adjustResize`, which
     is set in the manifest. If a field ends up under the IME, the fix is
     Reanimated's `useAnimatedKeyboard` — already a dependency, no new native
     module — **not** `react-native-keyboard-controller`.
  3. **Ripple clipping** on the lever cells, which are absolutely positioned
     inside an `Animated.View`. `foreground: true` should make them follow the
     border radius; a square flash at the corners means it did not.
  4. The three haptics being distinguishable, and **no vibrate permission**
     under Settings → Apps → four → Permissions.
  5. The dialog theme, the notification icon, and the two channels — none of
     which exist outside a real build.
- **The whole 2026-08-03 round is untested on hardware.** In rough order of
  how likely each is to be wrong:
  1. **The pixel wall's fit.** `Frame` is a new non-scrolling screen shell and
     the wall is sized from a measured box. If the bottom rows sit under the
     tab bar, `Frame`'s `insets.bottom + TAB_BAR` allowance is wrong — the
     same trap that has caught this project four times. Check on both a small
     phone and a large one; the message must be whole on both.
  2. **The wall's legibility at low percentages.** Early in a month it is
     nearly all unlit, and unlit-vs-page measures 1.45:1 by design. If the
     screen reads as blank rather than as a wall waiting to fill, the ground
     tone needs another look — it was `surface` at 1.08:1 and already moved up
     one step for this reason.
  3. **The slider.** It is a native module added for this round. It must drag
     smoothly, write on release only, and still show the value after the app
     is backgrounded and reopened.
  4. **The month pager**, and specifically whether the page height stays put
     between a four-row and a six-row month.
  5. **The activity cap under a real log.** Fill a lever to ten, then log it
     with a brand-new note. **The day must still land.** That is the whole
     safety property of the round.
- **The mood strip is untested on hardware.** In rough order of how likely each
  is to be wrong:
  1. **The grow, clipped.** It expands outside its slot and relies on
     `overflow: visible` plus `GROW_Y` of reserved headroom. If the top of the
     held bar is cut off, that allowance is wrong — and on Android the parent
     `Screen` may clip differently than iOS.
  2. **Whether the drag is comfortable at all.** The whole premise is that a
     bar you can see past your fingertip is easier to land than a slider thumb.
     That is a claim about a real hand on real glass and nothing else can test
     it. If it is worse, the fallback is a taller `TRACK`, not more animation.
  3. **The double tap against the drag.** `Gesture.Exclusive` should stop a
     double tap also registering as two drags, but a slow double tap may still
     set a value on its first touch before the dialog opens.
  4. **Android's inline field.** It replaces the strip while open; check the
     keyboard does not push the section under the tab bar, and that `cancel`
     leaves the previous value intact.
  5. **The band haptic.** Five ticks across a full drag should read as
     detents. If it feels like nothing, the bands are too coarse.
  6. **`justSaved` and the refresh.** Drag, release, and watch for the bar
     dropping to its old height for a frame before the reload lands.

- **The 2026-08-04 auth round is untested on hardware**, and it is the cheapest
  of the four to check — one screen, no data, reachable by signing out.
  1. **The white Google button on iOS.** It is the ONLY light surface in a
     dark-only app. Check it does not glare at 6am, and that it sits at the
     same visual weight as Apple's `WHITE` button directly above it rather
     than louder.
  2. **The G mark's crispness.** It is four SVG paths on a 48-unit viewBox
     rendered at 18pt. Vector, so it should be sharp at any density — but no
     render has been looked at.
  3. **The two `subtle` buttons at half width each.** Labels were shortened
     ("create account", "email a code") to fit a 48pt box at half a phone's
     width. Check they do not wrap or clip at large Dynamic Type.
  4. **The gap the deleted subtitle left.** A bare `View` of `space[10]` now
     holds the logo off the fields. Check the screen does not read as
     top-heavy with nothing under the mark.
- Plateau thresholds pass unit tests but have no longitudinal data behind them. `PLATEAU_WEEKS` (4) and `MIN_DAYS_PER_WEEK` (3) are educated guesses.

### The Android release, exactly where it stands (2026-07-31)

Nine things, and the dependency order between them is the part that is easy to
get wrong. **Only two of these block testing the app**; the rest block the
*store*, which is weeks away.

| # | Thing | State | Blocks |
| --- | --- | --- | --- |
| 1 | **Android keystore** | ✅ Created, EAS-managed. SHA-1 `EC:2F:BB:F3:74:79:CE:55:E0:0F:11:85:03:02:68:2A:E4:1A:39:30`. Local `.jks` backup downloaded | — |
| 2 | **Android OAuth client** | ✅ Created in Google Cloud, package + SHA-1 verified | — |
| 3 | **`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`** | ✅ Set on all three EAS environments **and** `.env.local` | — |
| 4 | **First Android build** | 🔄 `development` profile, build `6c18ddab-73ac-4ac5-93ad-e7b5a9faa7c8`, versionCode 1. Queued 2026-07-31. Its log confirmed all three env vars loaded and the right keystore used | Testing |
| 5 | **OAuth consent screen** | ❌ **Still in "Testing" mode.** Only `parsaxavier@gmail.com` can sign in with Google | **Google sign-in on any other account** |
| 6 | **Firebase / FCM V1** | ❌ Not started | **Remote push (the pager)**. Local notifications and the test alert work without it |
| 7 | **Play Console account** | ⚠️ Created 2026-07-31. **Personal**, account `8319744677397056181`, developer name corrected to `kagusoftware`. Three verifications outstanding: identity, phone, Android-device | The store only |
| 8 | **Android submit config** | ❌ `eas.json` `submit.production` has **iOS only**. Needs an `android` block + a Play service-account key | `eas submit --platform android` |
| 9 | **12 testers × 14 days** | ❌ Not started. Applies because the account is **Personal**; organisation accounts are exempt | Public release only |

**The critical sequencing fact:** items 5, 6 and 7 are independent of each
other and of the build. Do not let the Play Console verification queue —
which takes days — hold up device testing, which needs none of it.

**One borrowed-phone session covers three things at once**, and it is worth
planning as one sitting: install the **Play Console app** and sign in (clears
verification 7c), install the **dev-build APK** and run the test checklist,
and check **Google sign-in** — that last one only if item 5 is done first,
otherwise it fails in a way that looks like a broken app rather than a config
gate.

**Blocked / needs the owner:**

- **Rotate two credentials** — see Gotchas. Still outstanding from 2026-07-19.
- **A development build** — see *Roadmap* step 15. This is the gate on push.
- ~~**`20260730120000_drop_posture.sql` MUST WAIT for build 5**~~ — **resolved.
  It is applied**, confirmed by `npx supabase migration list` on 2026-08-03.
  The same sequencing rule now applies to the weight columns and the retired
  signal kinds, which the 08-03 round stopped reading but deliberately did NOT
  drop: a shipped build still selects them. They go in a later migration, once
  no installed client reads them.
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
- **Android Google Sign-In needs one Google Cloud client and one env var
  (2026-07-31).** The code is built and falls back to the browser flow while
  this is missing, so nothing is broken in the meantime — native Credential
  Manager just does not engage. Two steps:

  1. ~~**`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`**~~ — **DONE 2026-07-31.** Set on
     all three EAS environments (`development`, `preview`, `production`) and
     appended to `apps/mobile/.env.local`. Value is the Web client ID recorded
     in *Gotchas*.
  2. ~~**An Android OAuth client**~~ — **DONE 2026-07-31.** Created with the
     keystore's SHA-1; both recorded in *Gotchas*.
  3. **The OAuth consent screen is still in Testing mode** — see *Gotchas*.
     Until it is published, Google sign-in works **only for listed test
     users**. Publishing needs no verification review because every scope is
     non-sensitive. **This is the last thing between the app and a working
     Google sign-in for anyone who is not the owner.**

     Before publishing, read back the **Branding** page — app name, support
     email, privacy/terms links — because those become visible to every person
     who signs in. The privacy and terms pages already exist and are public at
     `personal-system-rho.vercel.app/privacy` and `/terms`; paste them in while
     you are there, since Play will ask for them anyway.

- **Google Play Console — three verifications, all outstanding (2026-07-31).**
  None of them block building or device-testing; they gate *publishing*.
  1. **Identity** — upload an official document. **The long pole: days.**
     Start it first.
  2. **Contact phone number** — quick, but Google gates it behind identity.
  3. **Android device access** — sign in to the **Play Console mobile app** on
     a real Android device. **Needs the borrowed phone**, so batch it with the
     testing session.

  The account is **Personal**, which means the **12-testers-for-14-days closed
  test** applies before production access. Organisation accounts are exempt,
  but that route needs a D-U-N-S number for Kagu Software, which takes days to
  weeks — it was considered and passed over on 2026-07-31 in favour of moving
  now. Internal testing (up to 100 testers, no review, the real TestFlight
  equivalent) works as soon as the account is verified.

- **`eas.json` has no Android submit block.** `submit.production` carries only
  `ios.ascAppId`. Before the first `eas submit --platform android`, add an
  `android` entry pointing at a **Play service-account key** (Play Console →
  Setup → API access → create service account → grant release permissions →
  download JSON). That JSON is a real secret: never commit it.

  **The Android keystore now exists** (created 2026-07-31, EAS-managed,
  fingerprints in *Gotchas*). **It is the app's permanent identity on
  Android** — lose it and a Play listing can never be updated again. EAS holds
  it; a local backup was downloaded to `apps/mobile/*.jks`, which
  `.gitignore` covers via `*.jks`. **Move that file out of the repo** to a
  password manager or backup drive; do not commit it, and note that
  `eas credentials` prints its passwords to the terminal when downloading.

  A locally-built debug APK and an EAS build have **different** fingerprints,
  and Play App Signing adds a **third**, so each needs its own SHA-1
  registered against the Android client. Getting it wrong presents as
  `DEVELOPER_ERROR` and nothing else — the app falls back to the browser flow,
  so it looks like the native sheet simply never appears rather than like a
  misconfiguration.

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
| `packages/core/pixels.ts` | The pixel wall: layout, the mask, the reveal order, the SVG paths, the caption. **The mask and the unlit cells must render in the SAME colour** — see its docblock. |
| `packages/core/font5x7.ts` | A hand-drawn 5×7 bitmap font, written as `#`/`.` pictures and parsed at import. **Throws on a malformed glyph**, so a bad edit fails `npm test` rather than rendering a smeared letter. |
| `packages/core/mood.ts` | The 1–100 daily reading and `facePath` — the frowny→smiley mouth, computed once so both clients draw the same face. |
| `packages/core/playbook.ts` | Activity rules: `MAX_ACTIVITIES` (10), `rankActivities` (the single answer to "the top three"), and `retireCandidate` — which row an implicit create may evict, and when it must evict nothing. |
| `apps/web/app/proof/page.tsx` · `proof/wall.tsx` | The pixel wall. The page is a server component; `wall.tsx` exists only to MEASURE, because the cell count is an integer the message layout depends on. |
| `apps/mobile/src/app/(tabs)/proof.tsx` | The same wall, measured with `onLayout` inside `Frame`. |
| `apps/mobile/src/components/mood-slider.tsx` · `apps/web/app/components/mood-slider.tsx` | The dashboard's one question. Platform control, shared face. |
| `apps/mobile/src/components/activity-manager.tsx` · `apps/web/app/settings/activity-manager.tsx` | Activity CRUD. Lifted from the two lever managers — read those first. |
| `apps/web/app/api/monitor/check/route.ts` | Daily cron pass. Service-role, `CRON_SECRET`-authed, logs every run to `monitor_runs`. |
| `apps/web/app/globals.css` | Tailwind v4 `@theme` tokens. Normative in oklch. |
| `apps/web/proxy.ts` | Session refresh + route protection (Next 16 name for middleware). |
| `apps/web/vercel.ts` | Cron schedule. Inside the app dir because Vercel's Root Directory points there. |
| `packages/core/grid.ts` | The day-grid ramp, `leversOn` (how many levers existed on a given day, which is the denominator each cell is shaded against) **and `windowStart`** — why Home's block begins at day one on a new account and rolls thereafter. |
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
| `apps/mobile/src/components/button.tsx` | THE button — extracted from five drifting inline copies. Use it instead of a bare Pressable. Three variants: `default`, `subtle` (a real control below the CTA) and `provider` (a vendor's white pair — **the only colours in the app not from `theme.ts`**). Also `TextButton`, the boxless text link, which is still right for "← back" / "sign out" / "remove" and was deliberately NOT given a border in the 08-04 round. |
| `apps/mobile/src/lib/press.ts` | **Touch feedback.** `ripple()` (Android) and `pressFill()` (iOS), never both. Every Pressable in the app goes through it. |
| `apps/mobile/src/lib/haptics.ts` | **Haptics, named by meaning** — `committed` / `pickedUp` / `nudged`. Android uses real `HapticFeedbackConstants`; `impactAsync` is wrong there and needs a permission the app now blocks. |
| `apps/mobile/src/lib/back.ts` | `useAndroidBack()` — only for a screen running several steps inside ONE route. `gestureEnabled: false` does **not** stop the Android Back button. |
| `apps/mobile/src/lib/reduce-motion.ts` | `useReduceMotion()` — "Remove animations" / "Reduce Motion", owed on both platforms. The cue survives; only the movement goes. |
| `apps/mobile/src/components/snackbar.tsx` | The Android snackbar and `useNotify()`. **Statements only** — the four confirmations stay `Alert.alert` on both platforms. |
| `apps/mobile/src/components/sheet.tsx` | `<SheetHandle />` — the Android sheet's drag cue. `sheetGrabberVisible` is iOS-only, so Android had none. `null` on iOS. |
| `apps/mobile/plugins/with-android-dialog-theme.js` | Puts the palette on native dialogs. **AppCompat attributes, not Material 3** — RN builds them with AppCompat's builder. Third copy of the palette hexes; `check:contrast` cannot see it. |
| `scripts/make-notification-icon.mjs` | `npm run icon:notification`. Crops, scales and whitens the monochrome mark into a 96×96 alpha silhouette. Android reads **only the alpha** of a small icon. |
| `supabase/migrations/20260729030000_delete_account.sql` | `delete_own_account()` — security definer, no parameters, target comes from the JWT. Apple-required. |
| `apps/mobile/src/components/screen.tsx` | Every tab screen's frame. Owns the safe-area insets, the tab-bar allowance and the status-bar scrim. Also `Frame` — the same insets **without** a ScrollView, for the pixel wall. |
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
19. ~~Apple Developer enrollment and iOS credentials~~ — done 2026-07-30.
    Enrollment (Individual), EAS env vars on all three environments,
    distribution credentials, APNs push key,
    `ITSAppUsesNonExemptEncryption` set.

    **This step was previously written as "a development build" and that is
    wrong** — corrected 2026-08-03 by reading `eas build:list`. **Every iOS
    build that has ever existed is `production` / STORE distribution.** There
    has never been an iOS build with `developmentClient: true`, so there is
    nothing installed on the owner's phone that can connect to Metro, and
    scanning the `expo start` QR simply opens the TestFlight app, which runs
    its own bundled JS. See *Seeing a change on the owner's iPhone* in
    Gotchas.
20. ~~First store build on TestFlight~~ — done 2026-07-30. Build 4 (0.1.0)
    submitted via `eas submit` (ASC app `6796259740`, name **FOUR**, API key
    stored on EAS so future submits are non-interactive). `/privacy` and
    `/terms` live and public; the FOUR mark on all four icon surfaces via
    `scripts/make-mark.ps1`.
21. **← ACTIVE (iOS track): build 5, then external testers.** Build 5 carries the
    2026-07-30 owner-feedback round (posture removal, settings text, TimeRow,
    keyboard, walkthrough) **and the 2026-07-31 grid-swap round** (trailing-30
    Home, calendar History, the day panel, `prompt=select_account`, the
    `DELETE` confirm). **None of the 07-31 work has been seen on a device** —
    check the two grid layouts, tapping a day on each, and a blank day's
    wording before submitting. Then: add it to both TestFlight groups, submit
    the external group for **Beta App Review** (needs Test Information + a demo
    account in the review notes; the public link is dead until approval), and
    Apple + Google sign-in still need
    verifying on the TestFlight build — Google has worked once since the
    account-picker fix; Apple is unproven.
22. ~~The Android-native pass~~ — done 2026-07-31, **not yet seen on hardware.**
    The app was built iOS-first; everything below the structural line now uses
    Android's own idioms. Ripples on all 17 press targets, real
    `HapticFeedbackConstants` (and the `VIBRATE` permission dropped),
    `includeFontPadding` on every type primitive, a Material snackbar for the
    nine informational alerts (the four confirmations stay dialogs), Material
    summary rows in Settings, an M3 segmented button group, a sheet drag
    handle, hardware-Back through onboarding and the walkthrough, edge-to-edge
    declared, a real notification icon, a second notification channel for the
    reminder, an AppCompat dialog theme, and **native Google Sign-In via
    Credential Manager**. Verified: **162 tests, tsc clean across all three
    workspaces, `expo lint` clean, both bundles export, the web app builds, and
    30/30 contrast pairs pass** — the contrast check caught three of this
    pass's own defects at 1.35:1. Full notes in `apps/mobile/AGENTS.md`.
23. **← ACTIVE (Android track): get the Android build onto a device.** The first Android build
    ever (`6c18ddab-73ac-4ac5-93ad-e7b5a9faa7c8`, development profile,
    versionCode 1) was queued on 2026-07-31 — check
    [the builds page](https://expo.dev/accounts/parsa-mansouri/projects/uptime/builds)
    for its artifact rather than assuming it succeeded. Then:
    **(a)** publish the OAuth consent screen, or Google sign-in works only for
    `parsaxavier@gmail.com`; **(b)** set up Firebase/FCM if the pager needs to
    fire; **(c)** borrow an Android phone once and do all three
    phone-dependent things in one sitting — Play Console app sign-in, APK
    install, and the ranked test checklist under *Written but NOT verified*.
    Full state table in *Current status → The Android release*.
24. ~~The proof/mood/activities round~~ — done 2026-08-03, **not yet seen on
    hardware.** Five owner-requested changes across both clients: `/proof`
    gutted and rebuilt as the pixel wall; one mood slider on the dashboard
    replacing energy + sleep; Home's grid pinned to day one until the account
    is thirty days old; History paged one month per swipe; per-lever activities
    editable and capped at ten. The journal and optional weight were removed
    with the old `/proof`. Two migrations, both applied. Verified: **264 core
    tests, tsc ×3, both linters, 39 migration checks, contrast, the web build,
    both bundles export.** Full notes under *Current status*.
25. ~~The auth-screen round~~ — done 2026-08-04, **not yet seen on hardware.**
    Four owner observations, all of them the sign-in screen failing to signal
    what was tappable: Google's button drew no mark on iOS (and violated
    Google's guidelines doing it); "Authentication required." read as a system
    error; and the two email alternatives were 12px grey text. `Button` gained
    `icon`, `variant="provider"` (the vendor's white pair) and
    `variant="subtle"` (a real control one step below the CTA); `ui.tsx` gained
    `GoogleMark`. `TextButton` was deliberately left alone. Mirrored on web.
    Verified: **tsc ×3, contrast, both bundles export, the web build.** Full
    notes under *Current status*.
26. Then: **custom SMTP** (it unblocks the Magic Link template, which the OTP
    screen depends on — see *Blocked*) · store listings · Play Console identity
    verification · the `eas.json` Android submit block.

## Deliberately partial — grows later (scope ledger)

| Area | What ships now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Levers | Fully user-defined on web: table, CRUD actions, Settings manager, 1–4 layout | Same on mobile | Done on web |
| Onboarding | Web: one screen (rule + 1–4 levers). Mobile: four steps + a first-open walkthrough | Unchanged | Done both, 2026-07-30 |
| Auth | Email + password, explicit create-account, magic link | Apple · Google · 6-digit code | With mobile |
| Day grid | Lightness ramp, generated per lever count | Unchanged; steps grow with user-defined levers | Done |
| Proof | **The pixel wall** — cells lit to `days up ÷ days in month`, unlit ones spelling `KEEP GOING`. The trend charts, both 1–5 scales and the journal were deleted 2026-08-03 | Unchanged — this IS the intended shape | Both done 2026-08-03 |
| Felt state | **One mood slider on the dashboard**, continuous 1–100, replacing energy + sleep. Platform control, shared `facePath` | Unchanged | Both done 2026-08-03 |
| Weight | **Removed 2026-08-03**, with the journal. Owner decision. Columns and rows are kept — a shipped build still selects them — and drop in a later migration | — | Closed |
| Posture | **Removed 2026-07-30** — strict-only, one voice. The column drop is applied as of 2026-08-03 | — | Closed |
| Walkthrough | **Mobile: 7-page manual of real rendered components**, auto-once per device, reopens from About. Web: none | Web parity if anyone asks | Mobile done 2026-07-30 |
| Activities | **Editable and capped at ten per lever**, from the log sheet (long-press a chip, or "manage activities") and Settings → Activities. Rename, delete, restore a retired one. The cap ARCHIVES rather than refusing on the logging path | Unchanged | Both done 2026-08-03 |
| Mobile levers | Full: create, rename, archive, with native alerts | Unchanged | Done |
| Mobile auth | **Email + password, Sign in with Apple, Google, and a 6-digit email code** (the code doubles as forgot-password: sign in by code, set a new password in Settings). All built 2026-07-29; Apple/Google/OTP are inert until the Supabase dashboard config in *Blocked* is done. **Screen restyled 2026-08-04** — Google's mark, no "Authentication required.", the two email alternatives as real buttons | Verified on device, with custom SMTP | Config, then device test |
| Auth screen chrome | **Both clients, 2026-08-04.** One filled primary, two outlined secondaries splitting the width, then the provider buttons under a rule. Web's second secondary says "email a link", not mobile's "email a code" — **the two flows genuinely differ** (web sends a magic link with nothing to type; mobile verifies a 6-digit token) and matching the wording would misdescribe one | Unchanged — this IS the intended shape | Done both 2026-08-04 |
| Daily reminder | **Mobile: opt-in toggle + native time picker in Alerts and onboarding; local notification, reconciled on app start.** Web: none | Unchanged — the reminder is a phone thing | Mobile done 2026-07-29 |
| Account management | **Mobile: change email, change password, export JSON, delete account (RPC + typed confirm), sync row, About/privacy/terms/support.** Web: none of it | Web gets parity eventually | Mobile done 2026-07-29 |
| App icon | The FOUR mark (JetBrains Mono 700, 2×2), generated by `scripts/make-mark.ps1` on all four surfaces | Real branding pass | Placeholder by design, 2026-07-30 |
| Widgets | None | Interactive Home/Lock Screen widget: tap a lever without opening the app | v1.1 — SwiftUI + Glance, App Groups |
| Alerts | Telegram | Native push, same escalation ladder | Step 8 |
| Playbook | **No tab.** Still exists, still self-populates from logging, still feeds the lever sheet and the takeover | Unchanged — browsing it is not coming back | Decided 2026-07-28 |
| Daily note | **Removed 2026-08-03** with the rest of the old `/proof`. Existing note rows are kept and still render in the day panel where they were written | — | Closed |
| Outage annotation | `annotateOutage` action exists; no UI | Tap an outage in `/history` to label it | After real outages exist |
| Undo | **Mobile: there is no undo control.** A logged lever stays tappable; its sheet offers "add what else you did" or "remove today's <lever>". Web: still a per-lever undo | Same on web | Mobile done 2026-07-29 |
| Lever order | **Mobile: long-press and drag.** Drag to the trash to archive | Same on web (the RPC is shared and ready) | Mobile done 2026-07-29 |
| Settings layout | **Mobile: an index pushing into eight sub-screens on a native stack** (levers, activities, alerts, account, change-email, change-password, delete-account, about). Web: one flat page | Same shape on web | Mobile done 2026-07-29; Tracking replaced by Activities 2026-08-03 |

| Archive motion | **Mobile: fade + collapse, with the list carried up.** Web: instant | Same on web | Mobile done 2026-07-29 |
| Settings "accessibility" section | None. The owner named it as an example of the pattern; there is nothing real to put in it — reduce-motion and text size are OS settings the app already honours | **Ask before inventing one** | Undecided |
| Day grid | **Both clients: Home is 30 cells (10×3) beginning at day one until the account is 30 days old, then rolling; History is one calendar month per swipe (7 wide, padded to 6 rows).** Today pulses on both. Every day opens a read-only panel | Done — this is the final shape | 07-31, revised 2026-08-03 |
| Day panel | Levers + their detail text + that day's signals, read-only. Historical `energy`/`sleep`/`note` rows still render here; only `mood` is written going forward. **No `amount`** — that column exists only after the optional-weight migration, and nothing reads it any more | Unchanged | Done 2026-07-31 |
| iOS device testing | **The owner's iPhone is registered to the Apple team** (2026-08-03), so ad-hoc builds can install. Expo Go also boots again since google-signin went lazy. **No iOS development build has ever been made** | A dev build, then push and native sign-in verified on it | Just needs the build |
| Android nativeness | **Full pass done 2026-07-31, unseen on hardware.** Ripples, Android haptic constants, Material snackbar, summary settings rows, M3 segmented group, sheet drag handle, hardware Back, edge-to-edge, notification icon, two channels, dialog theme, Credential Manager sign-in | Unchanged — this IS the intended shape | Needs a device |
| Android widgets | None | Glance/Kotlin, same as the iOS WidgetKit one | v1.1 |
| Android launcher shortcuts | **None.** Long-press → "log a lever" is genuinely native and genuinely wanted | A `shortcuts.xml` config plugin + a deep-link route | Deferred with the widget work — same surface, same build |
| Material You | **Not doing it.** Dynamic colour contradicts the locked two-hue palette | — | Closed |
| Timezone | Defaults to Europe/Istanbul in DB | Device-detected at signup, editable | With mobile |
| Monetization | Free | Undecided. **The usual paywalls are all ruled out by the thesis**, not by preference — lever count is the product's name, longer history attacks re-entry, gamification fails a build test. Any model has to sell something other than a feature | Post-launch |

## Gotchas / open issues

- **Seeing a change on the owner's iPhone: there is no zero-build path, and
  the reasons compound (established 2026-08-03).**
  1. **Expo Go cannot run this app** and has not since 2026-07-31 —
     `@react-native-google-signin/google-signin` is a native module and is not
     in its binary. Scanning the QR opens Expo Go's project page and it
     reports "No EAS Update branches".
  2. **There has never been an iOS development build.** `eas build:list`
     shows six iOS builds, all `production` / STORE. Roadmap step 19 claimed
     otherwise until this was checked. So scanning `expo start`'s QR opens the
     installed TestFlight app — which is a production build, runs its own
     bundled JS, and ignores Metro. It looks like it worked; it is showing old
     code.
  3. **EAS Update is not configured.** `expo-updates` is not a dependency and
     there is no `runtimeVersion` or `updates` block in `app.json`. So there
     is no over-the-air JS path either — and adding one requires a build,
     which is circular.
  4. **A local iOS build needs macOS + Xcode.** The dev machine is Windows.

  **Two of the four are now resolved (2026-08-03):**

  - **(1) is fixed.** `src/lib/google-native.ts` loads the module lazily and
    returns `null` when `Constants.executionEnvironment === "storeClient"`, so
    **Expo Go boots the app again**. It is the only dependency outside Expo
    Go's bundled set — everything else in `package.json` is pure JS. Expo Go
    is therefore a real zero-build way to look at a JS round. What it cannot
    do: **push notifications** and **native Google sign-in**, both of which
    need a real binary.
  - **(2)'s prerequisite is done.** **The owner's iPhone is registered to
    Apple team `BR42V976FS`** — UDID `00008110-000674641EEA201E`, confirmed
    by `eas device:list` on 2026-08-03. Ad-hoc builds can now install on it.
    An iOS development build has still never been MADE; the gate is now just
    running the build.

  **The fix is one `--profile development` build**, and it is a ONE-TIME
  cost: a dev build is a native shell, so every JS change afterwards streams
  from Metro over localhost with no rebuild. Rebuild only when the native
  module list changes, which has happened twice since July.

  **Register before you build, never after.** The ad-hoc provisioning profile
  embeds the allowed UDIDs at generation time, so a profile made before the
  device existed produces a binary that downloads fine and then refuses to
  install. EAS regenerates credentials on the next build, which is what picks
  the device up.

  **Worth doing in the same build:** add `expo-updates` and a channel, so
  JS-only rounds afterwards reach the phone with no build at all.

  **The zero-build alternative is the web app**, which shares `packages/core`
  and therefore the identical wall geometry, face, month maths and activity
  rules. Run it and open it from the phone's browser on the same wifi. It
  cannot test the RN-specific risks — `Frame`'s tab-bar inset, the native
  slider, the pager gesture — but it shows the round. Needs
  `apps/web/.env.local`, which is **not on the work PC**; pull from Vercel.

- **The Google button's colours are the one exception to the palette, and they
  are not ours to tune (2026-08-04).** `PROVIDER_BG` / `PROVIDER_INK` in
  `components/button.tsx` and the four hues in `GoogleMark` are fixed by
  Google's identity guidelines; a recoloured or monochrome G is a rejection at
  review. So `variant="provider"` is white in a **dark-only app** — deliberately
  the only light surface in it. Three consequences worth knowing before
  touching it:
  - `check:contrast` carries them as **literal sRGB byte triples**, not oklch
    tokens, because there is nothing to convert and nothing we may change.
  - **The mark's four hues are EXEMPT** (the yellow measures 1.71:1 on white).
    That is correct: the mark carries no information — the label does, at
    16.48:1 — and the G is identified by SHAPE. Do not "fix" it.
  - **The button has no border.** Its own fill is the edge, at 19.08:1 against
    the page. A `line-hi` stroke on white reads as a grey halo.
  The same reasoning governs the **string**: "Sign in with Google" is title
  case, the one place the app's lowercase convention yields, because a vendor's
  wording is no more ours to restyle than their mark is.

- **The pixel wall's message is made of cells that must be INVISIBLE.** The
  masked cells and the not-yet-earned cells are drawn in exactly the same
  colour (`line`). If they ever separate by one step, `KEEP GOING` is legible
  at zero percent and the screen stops being something the month reveals.
  `check:contrast` records that pair at 1.00:1 as an EXEMPT row with the
  reasoning, precisely so nobody "fixes" it. The pair that DOES owe a floor is
  lit-against-unearned, at 11.37:1.

- **`GOING` is 29 cells wide, and that is what sets the wall's cell size.**
  Five glyphs of five columns plus four gaps, before any margin. A wall
  narrower than that cannot draw the word and silently degrades to `KEEP`
  alone. `GRID_TARGET` is 8dp for that reason — at the day grid's 14dp a
  390pt phone yields 23 columns and loses half the message. Do not raise it
  without recomputing that; `pixels.test.ts` has a regression test across four
  screen sizes.

- **The activity cap must never `raise`.** `isPermanent` in
  `apps/mobile/src/lib/outbox.ts` treats SQLSTATE `23xxx` as unrecoverable and
  dead-letters the queued item forever, so a constraint violation on the
  playbook would convert "you already have ten activities" into "the day you
  logged in the gym is gone". Both the trigger (`cap_playbook()`) and the
  client rule (`retireCandidate`) archive instead. The client picks the row —
  never pinned, never used more than once, and nothing at all if neither
  applies — and archives it first, so the trigger finds room and does not have
  to choose for itself.

- **A hard delete of a playbook row was impossible until 2026-08-03, and
  nothing had noticed.** `entries_playbook_fk` is composite —
  `(user_id, playbook_id)` → `playbook (user_id, id)` — with a bare
  `on delete set null`, which nulls EVERY referencing column, including
  `entries.user_id`, which is `not null`. So the delete failed its own
  cascade. It went unnoticed because nothing had ever deleted a playbook row.
  Fixed with Postgres 15's column list: `on delete set null (playbook_id)`.
  **The migration test now covers it**, because the composite key's intent
  (an entry cannot borrow another user's activity) is right and must not be
  lost while fixing the action.

- **The plateau threshold is a fraction of the scale, not a number of points.**
  It was `last - first <= 0.25` against raw 1–5 values. When the reading became
  a 1–100 slider the same literal became 0.25% of the range — a threshold
  nothing could ever clear, so every month would have read as a plateau and the
  pager would have fired constantly. It is `PLATEAU_FLAT_FRACTION` (0.0625)
  against a normalised range now, and `evaluatePlateau` filters on `mood`
  only: mixing a historical 1–5 `energy` row into a 1–100 average produces a
  number that is on neither scale.

- **The log sheet is measured exactly once, so nothing in it may grow.**
  `apps/mobile/src/app/log.tsx` is a `formSheet` with
  `sheetAllowedDetents: "fitToContents"`, which is why it reads
  `cachedStatus()` rather than subscribing. Activity editing therefore arrives
  as a long-press `Alert` (no layout change) and one always-present "manage
  activities" link that is part of the single measurement. That link uses
  `router.replace`, **not `push`** — returning to a sheet measured before an
  edit would show the chips it was measured with. `Alert.prompt` is iOS-only,
  so Android's "Rename" routes to the full editor instead of silently doing
  nothing.

- **Both status loaders now return the playbook UNORDERED, archived rows
  included.** They used to sort in SQL and they sorted differently — the web
  query tie-broke on `last_used_at` and the mobile one did not — so "the top
  three" could be a different three on a phone than in a browser. Every
  consumer passes the array through `rankActivities`, which sorts and drops
  archived rows. A new consumer that forgets will show retired activities.


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

- **Google Cloud was re-audited in the browser on 2026-07-31 for the Android
  work, and came back consistent with the earlier audit.** Recorded so nobody
  re-runs it:
  - Project **`high-office-503913-q9`**, named "four".
  - **Exactly one** OAuth client: *Web application*, created 2026-07-29, full
    ID `1017110614147-rj86ghgjdvgass9stp01bi2jvv04h0rn.apps.googleusercontent.com`.
    Sole authorised redirect URI
    `https://yqphirnsvcqzstwjfshs.supabase.co/auth/v1/callback`, no JS origins.
    A client secret **is** present — that is correct and belongs to the
    server-side web flow Supabase runs. **Credential Manager does not use it;
    do not rotate it.**
  - **An Android OAuth client was created later that day** — `four (Android)`,
    ID `1017110614147-naissv1ogrlht1ba3rpmgekdn3ssbbtp.apps.googleusercontent.com`,
    package `com.kagusoftware.uptime`, SHA-1
    `EC:2F:BB:F3:74:79:CE:55:E0:0F:11:85:03:02:68:2A:E4:1A:39:30`. Android
    clients carry **no secret**. **The app never names this client** — it only
    ever sends the *Web* ID; the Android one exists so Google recognises the
    package + signature pair. Nothing to wire up.
  - **⚠ The OAuth consent screen is in TESTING mode**, surfaced by the
    creation dialog: *"OAuth access is restricted to the test users listed on
    your OAuth consent screen."* **Google sign-in therefore works only for
    accounts explicitly listed as test users** — which will look like a broken
    native sheet on any device signed into someone else's Google account.
    The app requests only `email` / `profile` / `openid`, all **non-sensitive**,
    so publishing the consent screen needs **no Google verification review**
    and is effectively one click. Do that before testing sign-in on a device
    that is not the owner's. **Unresolved as of 2026-07-31.**
  - The full Web client ID is **not a secret** (a client ID is an identifier),
    which is why it is written here and shipped as `EXPO_PUBLIC_`.

- **⚠ The Android keystore is the app's permanent identity — treat it that
  way.** Created 2026-07-31, EAS-managed, SHA-1
  `EC:2F:BB:F3:74:79:CE:55:E0:0F:11:85:03:02:68:2A:E4:1A:39:30` (a certificate
  fingerprint is public, which is why it is written here). **Lose it after a
  Play release and that listing can never be updated again** — there is no
  recovery, no support ticket, nothing. EAS holds the canonical copy and signs
  server-side, so ordinary work is safe.

  A local `.jks` backup was downloaded to `apps/mobile/` on 2026-07-31 —
  actually two, because the download ran twice and EAS renamed the first to
  `*_OLD_1.jks`. Both are covered by the `*.jks` rule in
  `apps/mobile/.gitignore`, so they cannot be committed by accident.
  **They should be moved out of the repo directory** to a password manager or
  backup drive. `eas credentials` prints the keystore and key passwords to the
  terminal when downloading, so that scrollback is sensitive — the passwords
  were exposed in chat on 2026-07-31, judged low-risk because the `.jks` file
  itself never left the machine, and rotation was offered while it was still
  free. **After a Play release, rotation stops being possible at all.**

- **⚠ Expo Go can no longer run this app, as of 2026-07-31.**
  `@react-native-google-signin/google-signin` is a native module and is not in
  Expo Go's binary. This was the owner's explicit decision that day ("full
  native, dev build required"), taken to get Credential Manager sign-in. **The
  Android testing loop is now an EAS dev build**, which `eas.json` already has
  a profile for. `npm run android` / `npm run ios` are still
  `expo start --<platform>` on purpose — `expo prebuild` rewrites them to
  `expo run:*`, which needs a local Android SDK / Xcode; change them back if
  you ever run one.

- **Three Android things are invisible to every JS-only check** and only exist
  in a real build: the notification icon, the dialog theme, and edge-to-edge.
  `tsc`, `expo lint` and `expo export` all pass with them completely broken.
  The way to verify them without shipping is
  `npx expo prebuild --platform android --no-install --clean`, read the
  generated `android/app/src/main/res/values/{styles,colors}.xml` and
  `AndroidManifest.xml`, then `rm -rf android`. `/android` is gitignored, so
  that is free and disposable. It is how the dialog plugin's first version was
  caught writing Material 3 attributes that React Native never reads.

- **`expo install @react-native-google-signin/google-signin` adds a config
  plugin entry that breaks BOTH builds.** With no options it takes the
  plugin's *Firebase* branch and then requires `google-services.json` and
  `GoogleService-Info.plist`. This project has neither and does not use
  Firebase. **The entry was removed from `app.json` deliberately** — the native
  module still autolinks, and Credential Manager needs only `webClientId` at
  runtime. Do not "fix" its absence.

- **`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is the *Web* client ID, never the
  Android one.** Android's own OAuth client is matched by package name plus
  SHA-1 and is never named in code; the Web client is the audience the returned
  `idToken` is minted for. Confusing them fails with `DEVELOPER_ERROR`, which
  says nothing about which is wrong. **Unset, the app falls back to the browser
  flow and still works** — that fallback is deliberate, so a missing variable
  degrades rather than breaks.

- **`npm run check:contrast` caught three defects in the Android pass's own new
  code**, both at **1.35:1**: the sheet drag handle and the segmented-group
  divider, each written with `line` where the ground was `surface`. Both are
  `line-hi` now. The palette did not change — but **a familiar token on a new
  ground is a new measurement**, and Android's rearranged surfaces create a lot
  of those. Add a case for every new pair; there are 30 enforced now.
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
- **`eas submit` failing with `getaddrinfo ENOTFOUND idmsa.apple.com` is DNS,
  not credentials.** It looks like an auth failure — it appears straight after
  the Apple ID password prompt — but the request never left the machine. This
  network's resolver is a corporate domain controller
  (`SUPERPAYDC.superpay.tech`, 192.168.168.7) and intermittently fails external
  lookups. Confirm with `nslookup idmsa.apple.com`; if it resolves, just retry.
  Happened 2026-07-31. **`ascAppId` is now set in `eas.json`
  (`submit.production.ios`), which skips the Apple Developer Portal login that
  step needed** — the upload itself uses the App Store Connect API key already
  stored on EAS, so submits should no longer touch `idmsa.apple.com` at all.
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
# ⚠ EXPO GO NO LONGER WORKS as of 2026-07-31 — a native module is in the tree.
#   Install a dev build first; see "Development builds and push" below.
npm run mobile           # Expo dev server; open it with the DEV BUILD
npm run mobile:ios
npm run mobile:android
npm run icon:notification  # regenerate the Android notification icon
# The export is the only proof the module graph resolves. Do BOTH platforms.
cd apps/mobile && npx expo export --platform ios --platform android
cd apps/mobile && npx expo lint
npm run build

# Verify the Android native config (theme, notification icon, edge-to-edge).
# No JS-only check can see any of it. /android is gitignored, so this is free.
cd apps/mobile && npx expo prebuild --platform android --no-install --clean
#   read android/app/src/main/res/values/{styles,colors}.xml and AndroidManifest.xml
rm -rf apps/mobile/android
#   then put package.json's "android"/"ios" scripts back to `expo start --…`,
#   which prebuild rewrites to `expo run:…`

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
Everything below is run from `apps/mobile`.

**The setup below is already DONE** — login, `init`, and all three env vars on
all three environments. It is kept as the from-scratch reference for a new
machine or a new project, not as a to-do list.

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init      # creates the project, writes extra.eas.projectId into app.json

# EAS Build does NOT see .env.local — it is gitignored and never uploaded.
# The keys live in EAS instead, so nothing lands in a public repo.
# NOTE: `env:create` is deprecated in favour of `env:set`; both work today.
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://<ref>.supabase.co" --visibility plaintext --scope project \
  --environment development --environment preview --environment production
#  ...same for EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#  ...and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (added 2026-07-31)

# Read them back — this is how you rebuild a lost .env.local:
npx eas-cli@latest env:list development

npx eas-cli@latest build --profile development --platform android  # APK, no Apple account
npx eas-cli@latest build --profile development --platform ios      # needs an Apple Developer account
```

**Watch the first lines of any build's output.** It prints which *environment*
it resolved and names every variable it loaded. If a variable is missing there,
it is missing from the bundle — `EXPO_PUBLIC_*` values are inlined at build
time, not read at runtime, so **adding one always requires a rebuild.**

**Why a dev build is needed at all:** as of 2026-07-31 it is the only way to
run the app on Android at all, because a native module is in the tree. Beyond
that, `expo-notifications` cannot issue a push token without an EAS
`projectId`, and remote push has never worked in Expo Go — so the escalation
ladder is untestable without one either way. `registerForPush` fails soft and
says why, so nothing crashes in the meantime.

**Android is still the cheap path**: EAS builds an APK you install directly, no
Apple account and no Mac, and **no Play Console account either** — sideloading
needs nothing. Play Console ($25 once) is only for distributing to other people
through the store. iOS device builds need an Apple Developer account ($99/yr)
or Xcode on the team's Mac.

If the Expo account is an **organisation** rather than a personal one, add
`"owner": "<org-slug>"` to `app.json` first, or `eas init` creates the project
under the wrong account.
