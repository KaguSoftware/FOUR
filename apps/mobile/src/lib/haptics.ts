import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptics, named by what they MEAN rather than by how they feel.
 *
 * The two platforms have genuinely different vocabularies and the mapping is
 * not one-to-one, so call sites ask for "a lever was logged" and this file
 * decides what that is on the device in hand.
 *
 * **`impactAsync` is the wrong call on Android and expo-haptics says so
 * outright** — its own type docs read "Android's `Vibrator` API is not
 * recommended for implementing haptics feedback. Instead, you should use
 * `performAndroidHapticsAsync`, which is similar to iOS haptic feedback and
 * does not require `VIBRATE` permission." The old code used `impactAsync`
 * everywhere, which meant Android got a raw buzz of a fixed duration where
 * the OS has a whole set of tuned constants, AND the app declared a
 * permission it did not need. `app.json` now blocks `VIBRATE` outright, which
 * is only safe because nothing below reaches for the vibrator on Android.
 *
 * iOS keeps the exact `ImpactFeedbackStyle` values it already shipped. These
 * were tuned on a device and this file is not the place to relitigate them.
 *
 * Every function is fire-and-forget. A haptic that fails is not worth a
 * rejected promise reaching a call site that was about to log a day.
 */

const android = Platform.OS === "android";

/** Swallow the rejection. A missing vibrator must never break a tap. */
const fire = (run: () => Promise<void>) => {
  run().catch(() => {});
};

/**
 * A lever was logged, un-logged, or a commit landed.
 *
 * One crisp confirmation that the tap registered — not a celebration. The
 * register forbids that, on both platforms. `Confirm` is Android's constant
 * for exactly this: "the confirmation or successful completion of a user
 * interaction".
 */
export function committed() {
  fire(() =>
    android
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
}

/**
 * A lever has just been picked up by a long press and is now under the finger.
 *
 * Android names this one precisely — `Drag_Start` is "the user has started a
 * drag-and-drop gesture; the drag target has just been picked up" — where iOS
 * has only the generic impact the old code used.
 */
export function pickedUp() {
  fire(() =>
    android
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Drag_Start)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
}

/**
 * The dragged lever crossed into a new slot.
 *
 * Fires many times in a single drag, so it has to be the softest thing
 * available. `Segment_Tick` is documented as the constant for "switching
 * between a series of potential choices" and is specified to be gentle enough
 * to survive repetition — which is the whole problem with using a general
 * impact here.
 */
export function nudged() {
  fire(() =>
    android
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );
}
