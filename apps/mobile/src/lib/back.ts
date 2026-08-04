import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Android's Back, for a screen that holds its own steps.
 *
 * Almost nothing in this app needs this: routes are on a native stack, so Back
 * pops a screen, the predictive-Back peek animates, and none of it is written
 * here. Two screens are different, and both were broken because of it — each
 * runs a multi-step flow inside ONE route, so the navigator sees a single
 * screen and Back leaves the whole thing regardless of which step you are on.
 *
 * - **Onboarding.** `gestureEnabled: false` in the root layout blocks the iOS
 *   edge-swipe and has no effect whatsoever on the Android Back button, so
 *   Back on step 3 of 4 signed the user out of a setup they had not finished.
 * - **The tour** (and the seven-page manual it replaced). Several steps in one
 *   route; Back would leave the whole thing from step 4 of 5.
 *
 * On Android, Back means "up one step" — the step is the unit of navigation
 * the user perceives, not the route. Returning `true` says the press was
 * handled and stops it propagating; returning `false` lets the system do
 * whatever it would have.
 *
 * **iOS mounts nothing.** There is no hardware Back there, the listener would
 * never fire, and `BackHandler` on iOS is a documented no-op — but not
 * subscribing at all is the honest version.
 */
export function useAndroidBack(handler: () => boolean) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [handler]);
}
