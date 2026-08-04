/**
 * Contrast check — `npm run check:contrast`.
 *
 * "Contrast is measured, never assumed" is a project rule, and this is what
 * makes it runnable rather than aspirational. It has already caught real
 * defects twice: a `--color-line-hi` at 2.27:1 drawing the ring that marks
 * TODAY, and a 1–5 scale whose selected step sat at 1.10:1 against its
 * siblings.
 *
 * The ratios recorded in DESIGN.md are all measured against --color-bg. Any
 * copy on --color-surface or --color-surface-hi is on a lighter ground, so
 * those numbers do not transfer and the pair has to be measured again.
 *
 * The token values below are transcribed from `apps/web/app/globals.css`,
 * which is normative. **Re-run this after any palette change**, and add a case
 * whenever a screen introduces a pair that is not already here.
 *
 * Cases are split by what the pair actually OWES, not by what would be nice:
 *   ENFORCED   — a floor the pair must clear, per WCAG 1.4.3 (4.5:1 text) or
 *                1.4.11 (3:1 for anything carrying component or state info).
 *   EXEMPT     — measured and printed, but no floor, with the reason stated.
 *                A pair goes here only when something ELSE carries the meaning.
 */
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function bytes(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => {
    const c = clamp01(v);
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp01(g) * 255);
  });
}
const dec = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = ([r, g, b]) => 0.2126 * dec(r / 255) + 0.7152 * dec(g / 255) + 0.0722 * dec(b / 255);
const ratio = (x, y) => {
  const [hi, lo] = [lum(x), lum(y)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

// Straight from app/globals.css @theme.
const T = {
  bg: bytes(0.17, 0.008, 250),
  surface: bytes(0.21, 0.009, 250),
  "surface-hi": bytes(0.25, 0.01, 250),
  line: bytes(0.31, 0.011, 250),
  "line-hi": bytes(0.51, 0.013, 250),
  ink: bytes(0.95, 0.004, 250),
  "ink-dim": bytes(0.78, 0.008, 250),
  "ink-mute": bytes(0.63, 0.01, 250),
  down: bytes(0.66, 0.19, 25),

  // Google's sign-in button, and the only colours here that are NOT ours.
  // Their identity guidelines fix the fill, the text and the mark's four hues,
  // so these are literal sRGB rather than an oklch token — there is nothing to
  // convert and nothing we are allowed to tune. They are measured for the same
  // reason everything else is: the pair ships on our screen.
  "google-bg": [255, 255, 255],
  "google-ink": [31, 31, 31],
  "google-blue": [66, 133, 244],
  "google-green": [52, 168, 83],
  "google-yellow": [251, 188, 5],
  "google-red": [234, 67, 53],
};

const TEXT = 4.5, NONTEXT = 3;

const ENFORCED = [
  ["onboarding · rule statement", "ink", "bg", TEXT],
  ["onboarding · 'no streaks' line", "ink-mute", "bg", TEXT],
  ["onboarding · lever field text", "ink", "surface", TEXT],
  ["onboarding · lever field placeholder", "ink-mute", "surface", TEXT],
  ["onboarding · focus ring on a field", "line-hi", "bg", NONTEXT],
  ["onboarding · add-a-lever (dashed)", "ink-mute", "bg", TEXT],
  ["onboarding · continue button", "ink", "surface-hi", TEXT],
  ["onboarding · continue button border", "line-hi", "bg", NONTEXT],
  ["onboarding · step counter", "ink-mute", "bg", TEXT],
  ["milestone · flat line", "ink-dim", "bg", TEXT],
  ["takeover · DOWN N DAYS", "down", "bg", TEXT],
  ["takeover · prompt label", "ink-mute", "bg", TEXT],
  ["takeover · mark-it-up lever text", "ink-dim", "bg", TEXT],
  // The button has NO fill, so this stroke is the entire button. It owes 3:1.
  ["takeover · mark-it-up lever border", "line-hi", "bg", NONTEXT],
  ["login · create-account button", "ink", "surface-hi", TEXT],
  // The tab bar. These exist because the selected tab was invisible on any
  // device without Liquid Glass: `iconColor` and `labelStyle.color` were set as
  // flat values, which apply to the selected state too and silently override
  // `tintColor`, so selected and unselected rendered identically. iOS 26 hid it
  // behind the glass selection pill. Nothing here may rest on that pill.
  ["tabs · selected label/icon", "ink", "bg", TEXT],
  ["tabs · unselected label/icon", "ink-mute", "bg", TEXT],
  // The one that actually encodes "which tab am I on" without the glass. It is
  // state carried by colour, so it owes the 3:1 non-text floor against the
  // OTHER state rather than against the background.
  ["tabs · selected vs unselected", "ink", "ink-mute", NONTEXT],
  // Android's Material 3 indicator pill is the primary selection affordance
  // there, so it has to be visible against the bar itself.
  ["tabs · android indicator pill", "line-hi", "bg", NONTEXT],

  // --- The Android surfaces, added 2026-07-31 -----------------------------
  //
  // These are the pairs the Android-native pass introduced. Android diverges
  // from iOS in ARRANGEMENT, never in palette, so none of these is a new
  // colour — but each is a colour on a ground it had not sat on before, and
  // "contrast is measured, never assumed" does not care which platform the
  // pair appears on.

  // The snackbar replaces the modal alert for transient failures. It floats
  // over screens that already hold `surface` panels, so it sits one tonal step
  // up on `surface-hi` — which means its text is on a LIGHTER ground than the
  // `bg` most body copy is measured against, and the old number does not
  // transfer.
  ["snackbar · message text", "ink", "surface-hi", TEXT],
  ["snackbar · action label", "ink", "surface-hi", TEXT],
  // The mood chart's bars, on the page. `line-hi` is a past day's reading and
  // `line` is a day nobody answered — the two MUST stay distinguishable from
  // each other and from the ground, because "you skipped this" and "this was
  // rough" are the one distinction the whole control exists to make.
  ["mood chart · a past day's bar", "line-hi", "bg", NONTEXT],
  ["mood chart · today's bar", "ink", "bg", NONTEXT],
  // The value beside the slider, which is also the button that opens the
  // number pad. Set and unset are different tokens on the same ground.
  ["mood chart · value readout", "ink", "bg", TEXT],
  ["mood chart · value when unset", "ink-mute", "bg", TEXT],
  // DESIGN.md forbids shadows, so the border is what separates the snackbar
  // from whatever is under it. That makes the stroke the whole boundary, and a
  // boundary that carries the component's edge owes WCAG 1.4.11's 3:1.
  ["snackbar · edge against a surface panel", "line-hi", "surface", NONTEXT],
  ["snackbar · edge against the page", "line-hi", "bg", NONTEXT],

  // The Android settings row states its value as a summary line UNDER the
  // title instead of to the right of it. Same token, same ground, but it is
  // now the only thing carrying that information — on iOS the chevron and the
  // right-alignment help identify it as a value, and on Android nothing does.
  ["settings · android summary line", "ink-mute", "surface", TEXT],
  ["settings · android row title", "ink", "surface", TEXT],

  // Material's segmented button group is CONNECTED, so its border is doing two
  // jobs at once: the outline of the whole control against the page, and the
  // divider between two adjacent segments. It owes 3:1 in both roles.
  //
  // This was written with `line` first and measured at 1.35:1 against the
  // unselected fill — a group that renders as one undivided button. `line-hi`
  // is the token for a boundary that has to read, and it is now used on both
  // states rather than only the selected one.
  ["segmented · android outline vs page", "line-hi", "bg", NONTEXT],
  ["segmented · android divider vs unselected", "line-hi", "surface", NONTEXT],
  // The check that marks the selected segment on Android. It is a fourth
  // signal on top of fill, border and weight, but it is drawn ON the selected
  // fill and has to survive there on its own.
  ["segmented · android selected check", "ink", "line", NONTEXT],
  ["segmented · android selected label", "ink", "line", TEXT],
  ["segmented · android unselected label", "ink-mute", "surface", TEXT],

  // The Android sheet's drag handle. `sheetGrabberVisible` is iOS-only, so
  // this is content rather than chrome, and it is the only cue that the sheet
  // can be dragged away — an affordance, not a divider, which is why it takes
  // `line-hi`. It measured 1.35:1 as `line`.
  ["sheet · android drag handle", "line-hi", "surface", NONTEXT],

  // The Android ripple, against EVERY ground it is drawn on.
  //
  // There is one neutral — `ink-mute` — because a ripple is a translucent
  // radial wash rather than a held fill, and the per-surface tones this used
  // to take (`line`, `surface`, `down-dim`) measured 1.00–1.81:1 against
  // their own grounds. Twenty-eight controls rippled and none of them drew.
  // Material carries one `colorControlHighlight` per theme for exactly this
  // reason, so the pairs below are the whole set: if a new surface appears,
  // it has to clear this token, not pick its own.
  //
  // `line` is the tightest and is real — the selected cell of the proof scale
  // and of `Segmented`. `ink` is the brightest a day cell can reach.
  ["ripple · on the page", "ink-mute", "bg", NONTEXT],
  ["ripple · on a panel", "ink-mute", "surface", NONTEXT],
  ["ripple · on a control", "ink-mute", "surface-hi", NONTEXT],
  ["ripple · on a selected segment", "ink-mute", "line", NONTEXT],
  ["ripple · on a full day cell", "ink-mute", "ink", NONTEXT],

  // The destructive ripple: sign out, delete account, and "didn't happen" in
  // the log sheet. A statement rather than a surface match, and the one place
  // the ripple takes a hue. It was `down-dim` at 1.52:1, which is nothing.
  ["ripple · destructive on a panel", "down", "surface", NONTEXT],

  // --- the pixel wall ------------------------------------------------------
  //
  // The wall is TWO states drawn and a third that must be indistinguishable
  // from one of them. A lit cell against an unlit one is the entire readout —
  // it carries the whole month — so it is measured as a non-text graphic.
  //
  // The masked cells (the message stencil) are deliberately NOT a third
  // colour: they are drawn in exactly `surface`, the same as an unearned
  // cell. If they ever separate, the message becomes legible at zero percent
  // and the screen's whole idea collapses. That is why there is no
  // "mask vs dark" row here — a difference of zero is the requirement, and a
  // contrast floor is the wrong tool for it.
  ["pixel wall · lit against unearned", "ink", "line", NONTEXT],

  // --- the mood slider -----------------------------------------------------
  //
  // A real `<input type=range>` on web and the platform Slider on mobile, so
  // only the skin is ours. The thumb is the control; the filled track states
  // how far along it is; the face above states the same thing again in a
  // second modality, which is what keeps this off colour alone.
  ["mood slider · thumb against the page", "ink", "bg", NONTEXT],
  ["mood slider · filled track against the rest", "ink-dim", "line", NONTEXT],
  ["mood slider · unset thumb against the page", "line-hi", "bg", NONTEXT],
  ["mood slider · face at rest", "ink", "bg", NONTEXT],
  ["mood slider · face before it is set", "ink-mute", "bg", NONTEXT],

  // --- the Google sign-in button, added 2026-08-04 -------------------------
  //
  // The white provider button on iOS and on any Android without Play Services.
  // On Android WITH the native module this is Google's own view and none of
  // these apply.
  //
  // It is the only light surface in a dark-only app, which is exactly why it
  // is measured: every ratio recorded elsewhere is a light token on a dark
  // ground, and this pair inverts that. The label is ours to place even though
  // the colours are not ours to choose.
  ["google button · label on white", "google-ink", "google-bg", TEXT],
  // The button has no stroke — the fill IS the edge, so it owes 3:1 against
  // the page the way any component boundary does. At 16:1 it is not close.
  ["google button · white against the page", "google-bg", "bg", NONTEXT],
];

const EXEMPT = [
  [
    "google button · the mark's four hues on white",
    "google-yellow", "google-bg",
    "1.71:1 for the yellow — the weakest of the four, and it does not owe a floor because the mark carries NO information. What the button says is carried entirely by its label at 16.48:1 (enforced above); the G is identification, and it is identified by SHAPE, which is the signal that survives a colour-blind viewer and a dimmed screen. It is also not ours to fix: Google's identity guidelines fix these four hues exactly, and a recoloured or monochrome G is a rejection at review. Recorded so the number is on the table and nobody 'corrects' it. The other three (blue, green, red) sit either side of the same line and are exempt for the same reason.",
  ],
  [
    "pixel wall · unearned cell against the page",
    "line", "bg",
    "1.45:1, and it does not owe 3:1 because it carries no information. What the wall SAYS is carried entirely by lit-against-unearned (11.36:1, enforced above); this pair only decides whether you can see that there is a grid there at all when the month is empty. It was `surface` at 1.08:1 and the screen read as blank rather than as a wall waiting to fill, which is why it moved up a step. Above `line` the unlit state starts reading as lit, which would be worse than invisible — it would be wrong.",
  ],
  [
    "pixel wall · the message stencil against an unearned cell",
    "line", "line",
    "1.00:1, and that is the REQUIREMENT rather than a failure. The message is made of cells that never light, and they are drawn in exactly the same colour as a cell that has not been earned yet. If these two ever separate by even one step, the message becomes legible at zero percent and the entire idea of the screen — that it is revealed by the month rather than printed on it — stops working. Recorded here so nobody 'fixes' it.",
  ],
  [
    "onboarding · resting field border",
    "line", "bg",
    "PRE-EXISTING, app-wide: login, lever manager and playbook all draw inputs this way. Every field carries a placeholder at 5.08:1, which is what identifies it. Flagged for the owner rather than restyled here — changing it is an app-wide decision, not an onboarding one.",
  ],
  [
    "onboarding · field fill vs page",
    "surface", "bg",
    "Same pre-existing pattern; recorded so the number is on the table when that decision gets made.",
  ],
  [
    "segmented · android selected fill vs unselected",
    "line", "surface",
    "The fill difference alone does NOT have to clear 3:1, because selection here never rests on it: the selected segment also carries Inter_500Medium instead of Regular, ink instead of ink-mute text (11.37:1 and 5.08:1 on their own grounds), and a leading check mark at 11.37:1. That check is a change of SHAPE, which is the one signal that survives a colour-blind viewer and a dimmed screen — the same reasoning recorded for the tab bar, where the fix was to add a non-colour cue rather than to brighten a fill. Measured so the number is on the table.",
  ],
  [
    "ripple · the old per-surface tone, on a control",
    "line", "surface-hi",
    "1.22:1. Kept as a standing record of what the ripple looked like from the Android pass until 2026-08-02: a real RippleDrawable, correctly bounded, drawn in a colour one tonal step off its own ground. An iOS held-press CAN live at that step, because it fills the whole control and the eye catches its edge; a ripple has no edge and decays in ~300ms. This row is why the tone is no longer a per-call decision.",
  ],
];

let failures = 0;
console.log("ENFORCED");
console.log("pair                                        ratio   floor  verdict");
console.log("-".repeat(70));
for (const [what, fg, bg, floor] of ENFORCED) {
  const r = ratio(T[fg], T[bg]);
  const ok = r >= floor;
  if (!ok) failures++;
  console.log(
    `${what.padEnd(43)} ${r.toFixed(2).padStart(5)}   ${String(floor).padStart(4)}   ${ok ? "pass" : "FAIL"}`,
  );
}

console.log("\nEXEMPT — measured, no floor, reason stated");
console.log("-".repeat(70));
for (const [what, fg, bg, why] of EXEMPT) {
  console.log(`${what.padEnd(43)} ${ratio(T[fg], T[bg]).toFixed(2).padStart(5)}`);
  console.log(`  ${why}\n`);
}

console.log("-".repeat(70));
console.log(failures ? `${failures} FAILING PAIR(S)` : "every enforced pair clears its floor");
process.exitCode = failures ? 1 : 0;
