import { Platform, type PressableProps } from "react-native";

import { color } from "@/theme";

/**
 * Touch feedback, and it is different on the two platforms on purpose.
 *
 * iOS answers a press by darkening or lightening the control for as long as
 * the finger is down — a state, held. Android answers with a ripple that
 * starts where the finger landed and finishes on its own — an event, played.
 * They are not interchangeable, and shipping the iOS one on Android is the
 * loudest "this was ported" tell an app can have: every button in the system
 * ripples except the ones in this app.
 *
 * Seventeen Pressables wrote the iOS version inline before this existed. They
 * now all call these two.
 *
 * **The two must never both fire.** A background swap under a ripple reads as
 * a flash followed by a smear — worse than either alone — so `pressFill`
 * returns the resting colour unchanged on Android and `ripple` returns
 * `undefined` on iOS. Each platform gets exactly one answer.
 */

/**
 * The Android ripple, bounded by the control's own shape.
 *
 * `foreground: true` is load-bearing rather than a preference. A background
 * ripple is drawn *behind* the view's content, so on anything with its own
 * `backgroundColor` — which is every button in this app — it is invisible,
 * and on a rounded control it paints the corners square because the
 * background drawable, not the outline, does the clipping. In the foreground
 * it draws over the content and follows the border radius. (API 23+; the
 * app's minimum is far above that.)
 *
 * The tones are the same three surfaces the iOS pressed states use, so the
 * two platforms are answering with the same palette even though they are
 * answering differently.
 */
export function ripple(
  tone: "line" | "surface" | "down" = "line",
): PressableProps["android_ripple"] {
  if (Platform.OS !== "android") return undefined;
  const tones = {
    line: color.line,
    surface: color.surfaceHi,
    down: color.downDim,
  } as const;
  return { color: tones[tone], foreground: true, borderless: false };
}

/**
 * The iOS held-press fill.
 *
 * Returns `base` on Android so the control stays still under its ripple.
 * Call it in the function form of `style`:
 *
 * ```tsx
 * style={({ pressed }) => ({
 *   backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
 * })}
 * ```
 */
export function pressFill(
  base: string,
  pressed: string,
  isPressed: boolean,
): string {
  if (Platform.OS === "android") return base;
  return isPressed ? pressed : base;
}

/**
 * The same thing for a control whose resting state is the page itself.
 *
 * A transparent-backed row cannot use `pressFill` directly — "transparent" is
 * not a palette colour and typing it as one invites someone to pass it where
 * a real surface belongs.
 */
export function pressFillFlat(
  pressed: string,
  isPressed: boolean,
): string {
  if (Platform.OS === "android") return "transparent";
  return isPressed ? pressed : "transparent";
}
