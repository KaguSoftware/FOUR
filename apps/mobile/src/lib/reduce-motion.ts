import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS has been told to cut animation.
 *
 * "Reduce Motion" on iOS, "Remove animations" on Android. Both platforms'
 * guidelines require honouring it, and `PRODUCT.md` lists it as a guarantee
 * owed on both regardless of anything else — it is not a nice-to-have here.
 *
 * This lived inline in the day grid's today-cell, which was the only animation
 * in the app that respected it. Anything else that moves has to ask the same
 * question, so it is one hook now rather than a pattern to remember.
 *
 * **Subscribes, does not just read.** The setting can be changed while the app
 * is open — Android puts it in the notification-shade quick settings — and an
 * app that only checked at mount keeps animating until it is relaunched.
 *
 * The rule when it is on: **the CUE survives, only the MOVEMENT goes.** A
 * pulsing ring becomes a bright static ring; a sliding panel appears in place.
 * Removing the state along with the animation would take away information from
 * the users most likely to need it stated plainly.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
