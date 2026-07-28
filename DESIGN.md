---
name: uptime
description: Instrument panel for one system — a status readout you can log to in one tap.
colors:
  bg: "#0d1013"
  surface: "#15191c"
  surface-hi: "#1e2226"
  line: "#2c3136"
  line-hi: "#61676d"
  ink: "#eceff1"
  ink-dim: "#b4b8bc"
  ink-mute: "#858a8f"
  degraded: "#f2ab35"
  degraded-dim: "#664610"
  down: "#f05653"
  down-dim: "#6e2826"
typography:
  wordmark:
    fontFamily: "Archivo Black, sans-serif"
    fontSize: "1.125rem"
    lineHeight: 1
    letterSpacing: "-0.035em"
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "4rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.2
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  cell: "1px"
  md: "4px"
  sheet: "12px"
  full: "9999px"
spacing:
  grid-gap: "3px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "20px"
  section: "32px"
components:
  lever-button:
    backgroundColor: "{colors.surface-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px 16px"
    height: "64px"
    typography: "{typography.label}"
  lever-button-done:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-mute}"
    rounded: "{rounded.md}"
    padding: "20px 16px"
    height: "64px"
  day-cell-up:
    backgroundColor: "{colors.ink-dim}"
    rounded: "{rounded.cell}"
  day-cell-down:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.cell}"
  status-pill-up:
    textColor: "{colors.ink-mute}"
    typography: "{typography.label}"
  status-pill-degraded:
    textColor: "{colors.degraded}"
    typography: "{typography.label}"
  playbook-chip:
    backgroundColor: "{colors.surface-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "44px"
---

# Design System: uptime

## Overview

**Creative North Star: "The Instrument Panel"**

The metaphor is not decorative — it is named in the source itself, at the top of
`globals.css`, and it decides everything downstream. This is a readout for a
system that is either up or it isn't. It borrows from the visual tradition of
status pages, monitoring dashboards, and equipment panels: a dominant numeric
readout, a dense state grid, flat unlit surfaces, and status colour that appears
only when something is wrong.

The governing move is **restraint as signal**. `UP` has no colour at all,
because the absence of an alarm *is* the information. Amber and red are the only
saturated values in the system and they are never decorative — the moment they
appear anywhere ornamental, the panel stops meaning anything. Every surface is
flat; there is not one shadow in the product. Depth comes from tonal layering
across five near-black steps, the way a physical panel is separated by material
rather than by lighting.

The palette is committed dark, and this is not a theme choice — the product is
opened at 6am and at 11pm, and a white screen at either hour is hostile. Density
is high but calm: numbers are monospaced and tabular so they never jitter as
they change, labels are small and tracked out, and the composition holds a
single-column measure at phone width even on a large display.

**Key Characteristics:**
- Flat by absolute rule — zero shadows, depth by tonal step only
- One dominant numeric readout per screen, at a scale nothing else approaches
- Colour reserved exclusively for degraded and down states
- Monospaced tabular numerals everywhere a number can change
- Uppercase, tracked-out micro-labels as the connective vocabulary
- Single narrow column, phone-first, at every viewport

## Colors

A five-step near-black slate, tinted very slightly blue (hue 250), carrying two
reserved status hues and nothing else.

### Primary

The system has no brand accent. Its primary expressive colour is **ink on
near-black** — the readout itself. This is deliberate and load-bearing.

- **Readout White** (`#eceff1`): the hero metric, primary text, and a fully-lit
  day cell. Measured 16.52:1 on the background.

### Secondary

Reserved status. These never appear outside a state they describe.

- **Signal Amber** (`#f2ab35`): the `DEGRADED` state — logged nothing yet today,
  or a partial window. 9.68:1.
- **Alarm Red** (`#f05653`): a genuine down state. 5.60:1.
- **Amber Shadow** (`#664610`) / **Alarm Shadow** (`#6e2826`): the dimmed
  counterparts, used only for a status stroke or a dormant indicator, never for
  text.

### Neutral

- **Panel Black** (`#0d1013`): the ground. Never lightened for emphasis.
- **Raised Slate** (`#15191c`): a resting surface — a logged lever, an unlit
  day cell, an input well.
- **Lifted Slate** (`#1e2226`): an interactive surface at rest — an untapped
  lever button, a playbook chip.
- **Hairline** (`#2c3136`): the quiet divider. Structural separation only.
- **Live Edge** (`#61676d`): a stroke that carries state — the ring marking
  today, an interactive border, the pressed state. 3.33:1, above the WCAG
  1.4.11 non-text floor.
- **Dimmed Ink** (`#b4b8bc`): secondary text and a singly-logged day cell.
  9.56:1.
- **Muted Ink** (`#858a8f`): micro-labels and de-emphasised text. 5.48:1.

### Named Rules

**The Quiet-Is-Good Rule.** `UP` gets no colour. Status colour exists only to
mark *degraded* and *down*. Any proposal to give the healthy state its own hue
is rejected on sight — it would make the absence of alarm indistinguishable from
the presence of one at a glance, which is the entire job of the panel.

**The Two-Hue Ceiling.** Amber and red are the only saturated hues the system
owns. No third status colour, no accent, no category colours for levers. A
lever is never colour-coded; colour is reserved for status, never for identity.

**The Measured-Not-Assumed Rule.** The web source is normative in `oklch`; the
hex above is its exact sRGB rendering (verified, zero gamut clipping) and is
what React Native consumes, since RN cannot parse `oklch`. When any value here
changes, re-measure the contrast rather than assuming it held.

## Typography

**Display Font:** Archivo Black — wordmark only
**Body Font:** Inter (with `ui-sans-serif`, `system-ui`)
**Numeric/Mono Font:** JetBrains Mono (with `ui-monospace`, `SF Mono`)

**Character:** A workhorse UI sans doing all the reading, a monospace doing all
the counting, and a single heavy grotesque appearing exactly once. The pairing
reads as instrumentation rather than editorial: nothing here has a personality
that competes with the number.

### Hierarchy

- **Display** (JetBrains Mono, 4rem, tabular, line-height 1): the uptime metric,
  and nothing else. One per screen, ever.
- **Headline** (Inter Medium, 1.375rem): screen-level figures on History.
- **Title** (Inter Medium, 1.125rem): section headings, the wordmark's optical
  partner.
- **Body** (Inter Regular, 0.9375rem, line-height 1.5): all reading text.
- **Label** (Inter Medium, 0.6875rem, `0.08em` tracking, uppercase): the
  connective vocabulary of the entire product — status pills, section captions,
  lever names, metric subtitles.

### Named Rules

**The One Readout Rule.** Exactly one element per screen is set at Display
scale, and it is always the number that answers the screen's question. If a
second element competes with it, the screen has two subjects and needs splitting.

**The Tabular Rule.** Every numeral that can change is monospaced and set with
tabular figures (`tnum`). A number that reflows as it counts reads as unstable,
and this product's whole claim is that the readout is trustworthy.

**The Scalable-Type Rule (native).** On iOS and Android the ramp maps onto the
platform's scaled type systems — Dynamic Type text styles and `sp` units — never
hard-coded points. The single exception is Display: the hero metric is capped so
it cannot overflow its line at the largest accessibility sizes, and it degrades
by reducing its own size before it wraps. A wrapped hero metric is a broken
screen.

## Layout

A single column, `max-width` 28rem, centred, with a 20px gutter at every
viewport. The product is phone-first and does not gain a second column on a
desktop display — a monitoring readout that spreads to fill a 27" monitor stops
reading as an instrument.

Vertical rhythm runs on a 4px base: 4 / 8 / 12 / 20 / 32. More space sits above
a heading than below it, binding each label to the block it introduces.

**The day grid is 15 columns wide**, always. Fifteen reads as a readout rather
than a tile wall, and it divides evenly into both the 30-day dashboard view (two
rows) and the 90-day history view (six rows). Cells are square, separated by a
3px gutter, and size fluidly from the container.

On native, layout is inset by the platform's safe areas and window insets on
every edge — status bar, notch, home indicator, navigation bar, display cutout,
and the keyboard. Nothing interactive ever sits under system chrome.

## Elevation & Depth

**There are no shadows in this product.** Not one, at any elevation, in any
state. This is verified in the source, and it is an invariant rather than a
current condition.

Depth is carried entirely by **tonal layering**: `bg` → `surface` →
`surface-hi`, with `line` and `line-hi` as strokes. A surface rises by getting
lighter, never by casting. On Android this maps onto Material's tonal elevation
model directly; the platform's default shadow-based elevation is overridden.

### Named Rules

**The No-Cast Rule.** A surface that needs to feel raised gets the next tonal
step. If three steps are not enough separation, the layout is too dense — fix
the spacing, not the lighting. Glassmorphism, blur, glow, and drop shadows are
all outside the system.

**The System-Chrome Exception.** One carve-out, and only one: **the platform's
own materials are permitted on the platform's own chrome** — the iOS tab bar
and sheets may use the system translucent material, because on iOS that
material *is* the native affordance and hand-rolling an opaque substitute is
the "ported from a website" tell. Content never gets glass. Android gets no
blur at all, since Material conveys elevation tonally, which is what this
system already does. The prohibition above remains aimed exactly where it was
written: hand-rolled decorative glass in content.

## Shapes

Corners are tight and mechanical. A 4px radius (`rounded.md`) on buttons,
chips, inputs and surfaces reads as machined rather than soft, and it is the
default for nearly everything.

Two deliberate exceptions: **day cells take a 1px radius** — effectively square,
because they are readout pixels rather than objects — and **bottom sheets take
12px on the top corners only**, matching each platform's native sheet.

Borders are 1px hairlines. There are no decorative rules, dividers-as-ornament,
gradients, or textures anywhere in the system.

## Components

### Buttons

- **Shape:** machined corners (4px radius), full width within their column.
- **Lever (primary action):** lifted slate fill (`#1e2226`), readout white
  label, live-edge 1px border, 64px tall. Uppercase label at Label scale. This
  is the most important control in the product and it is sized accordingly.
- **Lever, logged:** drops to the resting surface (`#15191c`) with muted ink and
  a hairline border, and becomes non-interactive. State is shown by recession,
  never by a check-coloured success treatment.
- **Pressed:** steps up one tonal level. 150ms.
- **Focus:** a 2px dimmed-ink outline at 2px offset. Never removed.

### Chips

- **Playbook chip:** lifted slate, readout white, 4px radius, 44px minimum
  height. Used inside the lever sheet as one-tap shortcuts to a previously
  logged detail.
- **State:** chips are actions, not filters. There is no selected state.

### Cards / Containers

The product has no card component. Content sits directly on the ground, grouped
by spacing and by Label headings. Where a container is genuinely needed (the
lever sheet, an input well), it is a tonal step with a hairline border and no
shadow.

### Inputs / Fields

- **Style:** resting surface fill, hairline border, 4px radius, 44px tall.
- **Focus:** border steps to live edge; the standard focus outline applies.
- **Minimum 16px text on touch devices** — below that, iOS force-zooms the
  viewport on focus, which reads as breakage.

### Navigation

Small uppercase Label-scale links, muted ink at rest, readout white when
active. On native this is replaced by the platform's own navigation — an iOS
tab bar or an Android navigation bar — themed with these colours rather than
reimplemented.

A pending-navigation dot fades in only **after 120ms**, so a fast transition
never flashes an indicator.

### The Day Grid (signature component)

The product's most distinctive element. Thirty (or ninety) square cells, 15 per
row, 3px apart. **Binary — a day is up, or it is not.**

- **Down:** resting surface with a hairline border — present but unlit.
- **Up:** dimmed ink fill. Identical whether one lever fired or all four.
- **Today:** a 1px live-edge ring at 1px offset.

### Named Rules

**The No-Remainder Rule.** The grid may never depict how much of something was
left undone. Encodings that subdivide a cell — segmented level meters,
quadrants, filled fractions — draw the *absence* as a visible hole, and a hole
reads as *you did not finish*. The product's thesis is that one lever is
enough, so an encoding that shows a remainder contradicts it however elegant it
looks.

This is why the grid is binary rather than counting levers, and why the earlier
dim-for-one / bright-for-both treatment was retired: with four levers it would
have turned thirty days into thirty progress bars. Lever detail belongs to
*tapping a day* in History — a deliberate inspection, where curiosity is the
motive, rather than a glance, where comparison is.

**Up is set at `ink-dim`, not `ink`.** Thirty cells at full readout white
become a slab brighter than the hero metric, and exactly one element per screen
is allowed to be the readout. Down cells also carry a border that up cells do
not, so state never rests on fill alone.

## Do's and Don'ts

### Do:

- **Do** reserve amber (`#f2ab35`) and red (`#f05653`) exclusively for degraded
  and down states.
- **Do** set every changeable numeral in JetBrains Mono with tabular figures.
- **Do** convey elevation with the next tonal step (`#0d1013` → `#15191c` →
  `#1e2226`).
- **Do** keep exactly one Display-scale element per screen.
- **Do** map the type ramp onto Dynamic Type and `sp` on native so text follows
  the user's reading-size setting.
- **Do** re-measure contrast whenever a colour value changes; the ratios in this
  file are measured, not estimated.
- **Do** hold the single 28rem column at every viewport.

### Don't:

- **Don't** add a shadow. Anywhere. At any elevation.
- **Don't** subdivide a day cell — no segments, quadrants, or fractional fills.
  Anything that draws a remainder says "you did not finish", which is the one
  thing the grid must never say.
- **Don't** put blur or translucency on content. System materials are permitted
  on system chrome only (see The System-Chrome Exception).
- **Don't** give the healthy state a colour — quiet is the signal.
- **Don't** colour-code levers, or introduce a third status hue.
- **Don't** use a status colour decoratively: not on a border, an icon, or a
  heading that isn't reporting a state.
- **Don't** hard-code point sizes on native, or let the hero metric wrap.
- **Don't** introduce a light theme, a theme toggle, gradients, blur, or glow.
- **Don't** mark a logged lever with a green or "success" treatment; it recedes
  instead.
- **Don't** let a native default (Material's shadow elevation, an iOS grouped
  list's own background) reintroduce a surface this system doesn't have.
