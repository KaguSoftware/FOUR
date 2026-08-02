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
 * ## One colour, because a ripple is not a fill
 *
 * This took four tones — `line`, `line-hi`, `surface`, `down` — chosen as
 * "the same three surfaces the iOS pressed states use, so the two platforms
 * are answering with the same palette". That was the wrong model, and it made
 * **every ripple in the app invisible**. Measured against the ground each one
 * is actually drawn on:
 *
 * ```
 *              bg   surface  surface-hi  line
 *   line      1.45    1.35      1.22     1.00
 *   surface   1.19    1.10      1.00     1.22
 *   down-dim  1.81    1.68      1.52     1.25
 * ```
 *
 * An iOS pressed state can live at 1.2:1 because it is a *held fill over the
 * whole control*: a large uniform area with a hard edge, and the edge is what
 * the eye catches. A ripple is a translucent radial wash that peaks and
 * decays in ~300ms, drawn by `RippleDrawable` at its own alpha — so the
 * number above is an upper bound on an effect that is already weaker than it.
 * At 1.2:1 there is nothing to see. The Android pass added ripples to
 * twenty-eight controls and none of them ever drew.
 *
 * Material's own model is one `colorControlHighlight` for the whole theme,
 * not one per surface, for exactly this reason. **`ink-mute` is the only
 * token in this palette that clears 3:1 against every ground the app ripples
 * on** — 5.48 on `bg`, 5.08 on `surface`, 4.60 on `surface-hi`, 3.77 on
 * `line`, and 3.02 against `ink` itself, which is the brightest a day cell
 * can get. So there is one neutral, and picking a tone per control is no
 * longer a decision anyone has to make correctly.
 *
 * `destructive` is the one exception, and it is a statement rather than a
 * surface match: the two rows that sign you out and delete your account, and
 * the "didn't happen" control in the log sheet. `down` at 3.85–5.60 across
 * those grounds. It was `down-dim` at 1.52, which is to say it was nothing.
 */
export function ripple(
  tone: "neutral" | "destructive" = "neutral",
): PressableProps["android_ripple"] {
  if (Platform.OS !== "android") return undefined;
  return {
    color: tone === "destructive" ? color.down : color.inkMute,
    foreground: true,
    borderless: false,
  };
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

/**
 * The third iOS held-press form: dimming, for a control whose fill IS content.
 *
 * A day cell has no resting colour to step to — its fill is the day's value,
 * computed by `@uptime/core`, and swapping it for a pressed surface would say
 * the day changed. So iOS answers by fading the whole cell instead.
 *
 * Android returns `1`: the ripple is already the answer, and the same rule
 * that keeps `pressFill` still under one applies here. A cell that both dims
 * and ripples reads as a flicker, and on the grid it reads as the *data*
 * flickering.
 */
export function pressDim(isPressed: boolean, dim = 0.6): number {
  if (Platform.OS === "android") return 1;
  return isPressed ? dim : 1;
}
