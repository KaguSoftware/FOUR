import { Platform } from "react-native";

/**
 * The visual system, ported for React Native.
 *
 * `apps/web/app/globals.css` is normative and defines these in **oklch**, which
 * React Native cannot parse. Every value below is the exact sRGB rendering of
 * its oklch source — verified, zero gamut clipping — and every contrast ratio
 * was re-measured against the converted hex rather than assumed to survive the
 * conversion. The numbers in the comments are those measurements.
 *
 * If you change a colour here, change it in `globals.css` too and re-run
 * `npm run check:contrast` from the repo root. Two clients disagreeing about
 * what "degraded" looks like is the same class of bug as two clients
 * disagreeing about what "up" means.
 *
 * **Dark only, deliberately.** The app is opened at 6am and at 11pm, and a white
 * screen at either hour is hostile. There is no light theme and no toggle.
 */

export const color = {
  /** The ground. Never lightened for emphasis. */
  bg: "#0d1013",
  /** A resting surface — a logged lever, an unlit panel. */
  surface: "#15191c",
  /** An interactive surface at rest — an untapped lever. */
  surfaceHi: "#1e2226",
  /** The quiet divider. Structural separation only, carries no state. */
  line: "#2c3136",
  /**
   * A stroke that CARRIES state — the ring marking today, a button's edge.
   * 3.33:1 on bg. It was 2.27:1 once and failed WCAG 1.4.11; don't darken it.
   */
  lineHi: "#61676d",

  /** The hero metric and primary text. 16.52:1. */
  ink: "#eceff1",
  /** Secondary text. 9.56:1. */
  inkDim: "#b4b8bc",
  /** Micro-labels and de-emphasised text. 5.48:1. */
  inkMute: "#858a8f",

  /** Logged nothing yet today. 9.66:1. Reserved — never decorative. */
  degraded: "#f2ab35",
  /** A genuine down state. 5.60:1. Reserved — never decorative. */
  down: "#f05653",
  degradedDim: "#664610",
  downDim: "#6e2826",
} as const;

/**
 * Fixed rem-equivalent scale, ratio ~1.2, transcribed from the web `@theme`.
 * No fluid scaling: product UI is read at a consistent distance and a heading
 * that shrinks looks worse, not more responsive.
 *
 * These are the BASE sizes. Dynamic Type / `sp` scaling is applied by the
 * platform on top, which is why nothing here is expressed in absolute pixels
 * that resist it.
 */
export const size = {
  "2xs": 11,
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
  "2xl": 28,
  /** The hero readout. Deliberately outside the ramp — see PRODUCT.md. */
  hero: 64,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = { sm: 4, md: 6, lg: 10 } as const;

/**
 * Platform minimums, not suggestions: 44pt on iOS, 48dp on Android. Taking the
 * larger of the two everywhere is simpler than branching and costs nothing —
 * this app is operated one-handed, often at 6am.
 */
export const TAP = 48;

/** The lever button. Bigger than the minimum because it is the whole product. */
export const LEVER_HEIGHT = 64;

/**
 * The tab bar's own height, NOT counting whatever system inset sits under it.
 *
 * A constant because there is nothing to ask. `NativeTabs` exposes no height
 * (see `NativeTabsProps` in expo-router's
 * `native-tabs/NativeBottomTabs/types.d.ts` — the OS owns it), and expo-router 6
 * mounts no `BottomTabBarHeightContext`, so `useBottomTabBarHeight()` from
 * `@react-navigation/bottom-tabs` throws here rather than answering.
 *
 * Getting this wrong is not cosmetic: the bar is translucent, so content does
 * not stop at it — it slides underneath and stays readable-but-unreachable,
 * which is how the sign-out row, the add-lever button and the oldest incident
 * all ended up under the glass.
 *
 * **80 on Android is correct** — that is Material 3's navigation-bar height,
 * and `NativeTabs` renders a real one. (Material 2's was 56; do not "correct"
 * it to that.) 49 on iOS is `UITabBar`'s own height.
 *
 * Neither figure includes the system inset underneath it, which is why
 * `bottomInset()` exists and why nothing should add these by hand.
 *
 * **Always add it through `bottomInset()` below, never by hand.**
 */
export const TAB_BAR = Platform.select({ ios: 49, android: 80, default: 56 });

/**
 * The whole allowance under a tab screen: the bar, the system inset it sits
 * on, and a margin so the last element is not flush against the chrome.
 *
 * One function, because five call sites had `insets.bottom + TAB_BAR` written
 * out by hand and every one of them was a place this could go wrong.
 *
 * **The two bars STACK; they do not overlap.** A device photo on 2026-08-04
 * settled this: the Material tab bar sits fully above the 3-button navigation
 * bar, both visible, neither behind the other. `edgeToEdgeEnabled` lets the app
 * DRAW under the system bars, but `NativeTabs` still lays its own bar out above
 * the inset rather than across it. An earlier attempt at this fix took
 * `max(TAB_BAR, inset)` on the theory that 80dp already covered the navigation
 * bar — that was wrong, and it would have clipped by the whole ~48dp inset.
 *
 * So the sum is right on both platforms. What was missing is `CHROME_GAP`: the
 * old formula cleared the chrome to the exact pixel, which leaves a button's
 * border touching the tab bar and reads as clipped even when it is technically
 * reachable. The screens each add their own `space[n]` on top of this, but the
 * ones that came closest — Home's Save button, the takeover's — were still
 * landing hard against the bar.
 */
const CHROME_GAP = space[4];

export function bottomInset(safeAreaBottom: number): number {
  return safeAreaBottom + TAB_BAR + CHROME_GAP;
}
