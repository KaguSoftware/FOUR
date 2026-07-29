# Product

<!-- impeccable:product-schema 1 -->

> Lives at the monorepo root, not in `apps/web`, because it is the product record
> for every client — `apps/web` today, `apps/mobile` next.

## Platform

adaptive

Native iOS and Android via Expo / React Native, plus the existing Next.js web
client. Scope confirmed 2026-07-28 — **one visual system, two interaction
layers**:

**Adapts per OS.** Navigation structure and back behaviour (iOS tab bar,
navigation stack, edge-swipe back; Android navigation bar, predictive Back),
control idioms (iOS switch and action sheet; Material switch, bottom sheet and
snackbar), iconography (SF Symbols / Material Symbols), motion curves and
transition patterns, and haptic vocabulary.

**Identical everywhere.** Palette, type ramp, spacing rhythm, the day grid, the
hero metric's scale, copy, and the ops register. The brand is not re-expressed
per platform; only the interaction layer is.

**Platform guarantees owed on both regardless:** safe-area and window insets,
system back, scalable type (Dynamic Type / `sp`), reduced-motion, and touch
target minimums (≥44pt iOS, ≥48dp Android).

### Native by default (confirmed 2026-07-28, binding)

**Where the platform provides a component, use the platform's component.** Not a
lookalike, not a re-implementation. This covers: the back gesture and back
button, navigation bars and tab bars, sheets and modals, switches, pickers,
alerts and action sheets, list rows, text inputs, snackbars/toasts, refresh
controls, haptics, and share sheets. They are themed with this product's
palette and type — theming is the layer the platform leaves open — but their
behaviour, gestures and accessibility come from the OS.

**Custom is reserved for what has no native equivalent:** the day grid, the hero
readout, the lever buttons, and the takeover. Those are the product; everything
around them is the platform.

The test is the one both platform guides state: would a fluent user of this OS
trust the app, or pause at an off-spec control? A re-implemented back gesture or
a Cupertino-shaped switch on Android is the "ported from a website" tell, and it
is not acceptable here.

## Users

Anyone trying to keep something going, in any domain. The levers are
user-defined, so the product is deliberately goal-agnostic — gym, food,
writing, practice, medication, sobriety, study.

The user's situation is the specific thing: they are not looking for help on
good days. They have kept something going before, hit an interruption, and not
restarted. The thing did not die during the pause — it died because nothing
pulled them back in.

The job: **show up once today, and know the system is still up.**

## Product Purpose

Catch the fade early and make restarting trivial.

The only score is uptime — did the system stay up today. A day is **up** if the
user logs one small real thing. Not all of them. No minimum, no quality bar.

Success is not a high score. Success is that the user is still logging months
later, including after a bad week — and that a bad week reads as an incident
with a start date rather than a failure.

## Positioning

**We create the package; the user builds the goal.**

The product ships the system — uptime, runs, outages, a pager, a playbook, and
a re-entry path — and stays silent about what the user should be doing with it.
It supplies structure, never content. It has no opinion about whether the goal
is a gym session or a page of writing, and it never grades the goal's quality.

Three properties follow from that and are load-bearing:

- **Showing up is the entire bar.** One lever, any quality, counts as up.
- **Nothing can be reset to zero**, structurally. There is no stored counter.
- **The system is quiet until it matters**, then pages, then gets out of the way.

Stated on its own terms, not against any competitor. Confirmed 2026-07-28.

## Operating Context

- Used on a phone, in short bursts — often late at night or early morning. The
  primary interaction is a single tap that takes seconds.
- The most important moment of use is the **worst** one: several days down,
  reopening the app after avoiding it. Design decisions are weighted toward
  that moment over the good-day moment.
- The logical day rolls at **04:00 local**, not midnight, so a 01:30 session
  counts for the day it feels like rather than the one the calendar says.
- Alerts arrive out of app, on the lock screen, unprompted. That channel is
  part of the product, not a notification setting.
- A **slammed mode** exists for genuinely overloaded stretches: it raises the
  alert thresholds rather than pausing the system.

## Capabilities and Constraints

**Confirmed and shipping (web):**

- One tap per lever logs the day. Re-tapping is idempotent, never a duplicate.
- Uptime as a 30-day rolling window; current run; days down; runs and outages
  derived from gaps; monotonic all-time figures.
- A **takeover** state replaces the whole dashboard at ≥3 days down.
- A **playbook** of things that previously worked, surfaced during re-entry.
- Daily monitor with escalating alerts and once-ever milestones.
- Per-user data isolation enforced at the database level.

**Confirmed and building:**

- **Up to four user-defined levers** replacing the hardcoded pair. The "any one
  counts" rule does not change.
- Levers can be **renamed freely and archived, never hard-deleted** — archiving
  must not alter past uptime.
- Multi-user accounts, open signup.
- Native push replacing the current Telegram channel, escalation ladder intact.
- Daily reminder **off by default**, opt-in only.
- **Posture (`STRICT` / `SOFT`)** — chosen at onboarding, changeable in
  Settings. See Brand Commitments for exactly what it may and may not change.
  Shipping on web as of 2026-07-28, reaching exactly two screens: one added
  sentence on the takeover, and whether a milestone is acknowledged in a panel
  or delivered in the identical flat line an alert would use.
- **Proof ships in v1** (confirmed 2026-07-28, reversing the earlier cut). The
  daily felt-state check-in and its trend are core, not optional.
- **The proof trend plots daily points**, matching the daily sampling rate.
  **Plateau detection still reads weekly** — these are two different readers of
  the same data and they must not be conflated. A plateau judged on raw days
  fires after four quiet days, which is a mood, not a trend.
- **Optional weight**, per the constraint below.

**Constraints that future work must preserve:**

- Uptime, runs and outages are **derived at read time**, never stored. A stored
  counter is a thing that can be reset, and "back to zero" is the exact failure
  this product exists to prevent.
- **No screen may render a zero for run length.** After a break, the product
  reports the last completed run instead.
- 30-day uptime must never drop more than 1/30 per elapsed day.
- Empty history reads as **0 days down**, never a large number.
- No calories, no quality scoring, no badges, no confetti, no coins, no
  leaderboards.
- **Weight is opt-in and off by default** (confirmed 2026-07-28, amending the
  earlier "no weight" rule). When switched on it is recorded and plotted, and
  that is the whole feature: it **never affects uptime**, there is no goal
  weight, no target, no "X above/below", no BMI, and no interpretation of the
  trend. It is a number the user chose to keep, never a score the product keeps
  on them. Switching it off hides it without deleting history.

**Owner-stated, 2026-07-28 — a technically polished result that breaks either
of these is wrong:**

- **Logging is one tap.** The playbook sheet is optional detail, never a
  required step. No confirmation dialog, no success toast, no extra screen. Any
  native pattern that adds a step has raised the bar the product exists to keep
  low.
- **The hero metric keeps its scale.** `24/30` is the thesis of the screen, not
  a statistic on it. Native type systems pull toward conventional heading sizes;
  the hero must resist that. If it shrinks into the platform's scale, the
  dashboard becomes a list with a number on it.

**Decided:**

- Product name: **`four`**, after the ceiling of four levers. The name IS the
  constraint, which also settles a monetization question permanently — lever
  count can never be a paid tier.

**Explicitly undecided:**

- Monetization. Free for v1; model undecided. Note that the usual paywalls are
  all ruled out by the thesis rather than by preference: more levers is the
  name, longer history attacks re-entry, and gamification is out of scope with
  a build-failing test enforcing it. Any model has to sell something other than
  a feature.
- The plateau thresholds themselves — `PLATEAU_WEEKS` (4) and
  `MIN_DAYS_PER_WEEK` (3) are educated guesses with no longitudinal data behind
  them yet. Revisit once roughly six weeks of real signal exists.

## Brand Commitments

- **The register is a blunt ops voice.** `DOWN 3 DAYS`, `UP`, `DEGRADED`,
  `system stable`. This is the product's identity and its default.
- **The product never tells the user what their goal should be, and never
  evaluates how well they did it.**
- Existing wordmark: lowercase `four`, set in Archivo Black.
- Dark-only. Confirmed rationale: the app is opened at 6am and at 11pm, and a
  white screen at either hour is hostile.

### Posture — `STRICT` / `SOFT` (confirmed 2026-07-28)

The product is personalized: the user chooses how the system talks to them.
This is framed as **alert posture**, not "tone" — a monitoring system with a
configurable severity policy is native to the metaphor, not a dilution of it.

| | `STRICT` (default) | `SOFT` |
| --- | --- | --- |
| Re-entry takeover | Blunt. `DOWN 4 DAYS`, last run, the lightest things that worked. No comfort. | Same structure and same facts, warmer framing. The break is named as ordinary. |
| Milestones | Identical flat register to an alert. No colour, no motion, no acknowledgment. | Acknowledged as good news. Allowed a distinct treatment. |
| Alerts, thresholds, escalation | Identical in both | Identical in both |

**What posture may change:** wording, and whether good news is acknowledged as
good news.

**What posture may NEVER change — these are invariant in both modes:**

- What counts as up. One lever, any quality, no minimum.
- Every number: uptime window, run length, days down, all-time figures.
- The escalation ladder and its thresholds.
- The anti-shame invariants — no rendered zeros, monotonic all-time figures,
  graceful degradation.
- **`SOFT` is not gamification.** No badges, no confetti, no coins, no points,
  no streaks, no leaderboards, no celebratory animation. Softer means warmer
  words and permission to acknowledge a milestone. Anything that turns progress
  into a score is out of scope in both modes, permanently. This is the line
  that keeps `SOFT` from drifting into the category the product rejects.

Posture is chosen during onboarding rather than buried in settings, so it is a
deliberate choice from the first screen, and is changeable at any time.

## Evidence on Hand

- A working, deployed web client at `personal-system-rho.vercel.app`, in daily
  use by the owner.
- 153 passing tests encoding the product's invariants — `packages/core`.
- The mobile app running on real hardware as of 2026-07-29, in daily use.
- A verified end-to-end alert delivery (fade detected → alert composed →
  delivered to a phone), 2026-07-19.
- Recorded contrast measurements for the existing palette.

**Absences that future work must not fabricate:** there are no external users
yet, no testimonials, no reviews, no usage data, no press, and no retention
figures. There is one real user. Do not invent social proof, download counts,
or outcome claims for store listings or marketing.

## Product Principles

1. **Showing up is the entire bar.** One small real thing, any quality, keeps
   the system up. Any change that raises the bar is a change to the product's
   thesis, not a feature.
2. **Nothing resets to zero.** Metrics degrade gracefully or stay monotonic.
   The product is structurally incapable of telling someone to start over.
3. **We ship the package; the user brings the goal.** Structure, never content.
   No opinion about the goal, no grading of it.
4. **Silence is a feature.** The system says nothing while things are fine, so
   that when it speaks it is worth reading and does not get muted.
5. **Coming back must be lighter than starting.** Re-entry is the moment the
   product is really for; it gets the best design attention, not the leftovers.

## Accessibility & Inclusion

- **WCAG AA contrast is a confirmed, already-met commitment**, not an
  aspiration. Existing measured ratios on the current background: primary ink
  16.5:1, dimmed ink 9.6:1, muted ink 5.5:1, amber 9.7:1, red 5.6:1. Any
  palette port must re-verify rather than assume.
- Reduced-motion preference is respected today and must remain respected.
- Touch targets meet platform minimums (≥44pt iOS, ≥48dp Android).
- Status is never communicated by colour alone — the day grid distinguishes
  states by fill and border as well as hue.
- Inputs use a ≥16px font size on touch devices to prevent forced zoom.
