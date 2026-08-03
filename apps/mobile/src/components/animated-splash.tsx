import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/lib/reduce-motion";
import { color } from "@/theme";

/**
 * The branded loading moment between the native splash and the app.
 *
 * The native splash is a static image the OS paints before any JS runs. The
 * first frame here reproduces it exactly — the SAME `splash-icon.png`, at the
 * SAME width as `imageWidth` in app.json, centred on the same background — so
 * `SplashScreen.hideAsync()` (fired from `onLayout`, i.e. only once this is
 * actually painted) is a seamless handoff, not a flash.
 *
 * Then the play on the mark itself: the logo is FOUR set as a 2x2 grid —
 * F O / U R — so the four quadrants each slide a few points out along their
 * own diagonal and settle back, staggered F→O→U→R. Four pieces, snapping into
 * the grid. Each quadrant is an `overflow: hidden` crop window over the full
 * image; only transforms animate, nothing re-lays-out.
 *
 * The overlay sits on top of the navigator, which mounts underneath the
 * moment the session gate resolves — routing is never delayed. The fade-out
 * waits for BOTH the animation and `canFinish`; if the session is slow the
 * mark simply idles assembled (no looping motion — this is a splash, not a
 * spinner).
 *
 * Reduce Motion: the settle is skipped entirely and the assembled mark holds
 * briefly before the fade. The cue (the brand frame) survives; only the
 * movement goes.
 */

/** Must match `imageWidth` in app.json's expo-splash-screen config. */
const MARK = 160;
const HALF = MARK / 2;

/** Settle choreography. */
const STAGGER = 60;
const OUT_MS = 240;
const BACK_MS = 340;
/** Start-to-last-settle, plus a beat to breathe. */
const PLAY_MS = 3 * STAGGER + OUT_MS + BACK_MS + 120;
/** How long the assembled mark holds under Reduce Motion. */
const STILL_MS = 300;
const FADE_MS = 250;

/** Quadrant order is F, O, U, R — reading order — each with its own diagonal. */
const QUADS = [
  { row: 0, col: 0, dx: -1, dy: -1 },
  { row: 0, col: 1, dx: 1, dy: -1 },
  { row: 1, col: 0, dx: -1, dy: 1 },
  { row: 1, col: 1, dx: 1, dy: 1 },
] as const;

function Quad({ index, still }: { index: number; still: boolean }) {
  const { row, col, dx, dy } = QUADS[index];
  const out = useSharedValue(0);

  useEffect(() => {
    // `useReduceMotion` resolves asynchronously, so `still` can arrive a
    // frame after mount — snap home rather than finish the settle.
    if (still) {
      cancelAnimation(out);
      out.value = 0;
      return;
    }
    out.value = withDelay(
      index * STAGGER,
      withSequence(
        withTiming(14, { duration: OUT_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: BACK_MS, easing: Easing.back(1.8) }),
      ),
    );
  }, [still, index, out]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx * out.value }, { translateY: dy * out.value }],
  }));

  return (
    <Animated.View style={[{ width: HALF, height: HALF, overflow: "hidden" }, style]}>
      <Image
        source={require("../../assets/images/splash-icon.png")}
        style={{
          width: MARK,
          height: MARK,
          marginLeft: -col * HALF,
          marginTop: -row * HALF,
        }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export function AnimatedSplash({
  canFinish,
  onDone,
}: {
  canFinish: boolean;
  onDone: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const [played, setPlayed] = useState(false);
  const [fading, setFading] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // If Reduce Motion arrives (its read is async), the hold shortens from
    // wherever the clock already is — the mark just fades sooner.
    const t = setTimeout(
      () => setPlayed(true),
      reduceMotion ? STILL_MS : PLAY_MS,
    );
    return () => clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (!played || !canFinish || fading) return;
    setFading(true);
    opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [played, canFinish, fading, opacity, onDone]);

  const overlay = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: color.bg, alignItems: "center", justifyContent: "center" },
        overlay,
      ]}
      // Once the fade starts the app underneath is live; stop eating taps.
      pointerEvents={fading ? "none" : "auto"}
      onLayout={() => {
        // The first painted frame matches the native splash exactly — drop it.
        SplashScreen.hideAsync();
      }}
    >
      <View style={{ width: MARK, height: MARK, flexDirection: "row", flexWrap: "wrap" }}>
        {QUADS.map((_, i) => (
          <Quad key={i} index={i} still={reduceMotion} />
        ))}
      </View>
    </Animated.View>
  );
}
