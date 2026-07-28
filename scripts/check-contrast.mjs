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
  ["onboarding · step counter 1/2", "ink-mute", "bg", TEXT],
  ["posture · SELECTED title", "ink", "surface-hi", TEXT],
  ["posture · SELECTED detail", "ink-mute", "surface-hi", TEXT],
  ["posture · SELECTED check mark", "ink", "surface-hi", NONTEXT],
  ["posture · SELECTED border (state)", "line-hi", "bg", NONTEXT],
  ["posture · unselected title", "ink-dim", "surface", TEXT],
  ["posture · unselected detail", "ink-mute", "surface", TEXT],
  ["posture · footnote", "ink-mute", "bg", TEXT],
  ["milestone SOFT · panel title", "ink", "surface", TEXT],
  ["milestone SOFT · panel note", "ink-mute", "surface", TEXT],
  ["milestone STRICT · flat line", "ink-dim", "bg", TEXT],
  ["takeover · DOWN N DAYS", "down", "bg", TEXT],
  ["takeover · posture sentence", "ink-mute", "bg", TEXT],
  ["takeover · prompt label", "ink-mute", "bg", TEXT],
  ["takeover · mark-it-up lever text", "ink-dim", "bg", TEXT],
  // The button has NO fill, so this stroke is the entire button. It owes 3:1.
  ["takeover · mark-it-up lever border", "line-hi", "bg", NONTEXT],
  ["settings · posture heading", "ink", "bg", TEXT],
  ["login · create-account button", "ink", "surface-hi", TEXT],
];

const EXEMPT = [
  [
    "posture · selected vs unselected fill",
    "surface-hi", "surface",
    "Selection is carried by the ✓ (13.86:1) and by the border stepping line → line-hi (1.45 → 3.33 against the page). The fill shift is reinforcement, and state never rests on it.",
  ],
  [
    "posture · unselected card border",
    "line", "bg",
    "A quiet divider on a filled card, not a boundary anything depends on — the card is identifiable by its fill and its text, and the state that matters (selected) is the one drawn at 3.33:1.",
  ],
  [
    "milestone SOFT · panel border",
    "line", "bg",
    "Non-interactive container. Nothing is identified or operated by this stroke.",
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
