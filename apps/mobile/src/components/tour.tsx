import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { TextButton } from "@/components/button";
import { useTabBarInset } from "@/components/screen";
import { Body, Label } from "@/components/ui";
import { useAndroidBack } from "@/lib/back";
import { useReduceMotion } from "@/lib/reduce-motion";
import { color, radius, space } from "@/theme";

/**
 * The first-run tour: a spotlight on the LIVE dashboard.
 *
 * This replaced a seven-page written manual (2026-08-04, owner decision). The
 * manual explained everything at the one moment the user had seen nothing,
 * then disappeared — the proof screen already carries a comment about the
 * cost of that. The tour teaches on the real screen instead: everything dims
 * except one real element at a time, one sentence each, and the one step that
 * matters is performed rather than read — the lever buttons stay live under
 * the hole, a real tap opens the real log sheet, and the real write landing
 * is what advances the tour. Nothing is faked; the "logged" state the user
 * sees is their own first entry.
 *
 * The scrim is four plain views around a hole, not an SVG mask. The hole is
 * literally uncovered screen, which is what makes the interactive step work:
 * there is nothing to forward touches through, because there is nothing
 * there. On every other step a transparent pressable sits in the hole so
 * "tap anywhere advances" stays true everywhere.
 *
 * The native tab bar stays bright. It cannot be covered from JS (`NativeTabs`
 * owns it), and it is real chrome rather than tour content — a dimmed screen
 * with live chrome is how every platform sheet already looks.
 *
 * The ring is the cue that is not colour-alone, and it survives reduce-motion
 * as a static outline — the movement goes, the cue stays.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Anchor = "hero" | "levers" | "grid";

export type TourTargets = Record<Anchor, React.RefObject<View | null>>;

type StepDef = {
  anchor: Anchor | null;
  copy: (loggedInTour: boolean) => string;
  /** The lever step: the hole is live and a real log is what advances. */
  interactive?: boolean;
};

const STEPS: StepDef[] = [
  {
    anchor: "hero",
    copy: () => "days up, out of the last 30. one lever is enough.",
  },
  {
    anchor: "levers",
    interactive: true,
    copy: () => "tap a lever when it's true — that's all logging is.",
  },
  {
    anchor: "grid",
    // Two sentences for one step: if a log just landed, the lesson is the
    // cell they lit; if they skipped, the grid is described instead of shown
    // working.
    copy: (logged) =>
      logged
        ? "there's today lighting up. brighter = more of your levers."
        : "each cell is a day. brighter = more levers. outlined = down.",
  },
  {
    anchor: "levers",
    copy: () => "hold a lever to reorder or archive. four max.",
  },
  {
    anchor: null,
    copy: () => "silent while you're fine. it pages you when you're down. that's it.",
  },
];

/**
 * `color.bg` at 0.78 over the content. The composite grounds this produces
 * are measured in `scripts/check-contrast.mjs` — change one, change both.
 */
const SCRIM = "rgba(13, 16, 19, 0.78)";
const RING_PAD = 6;
const TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };

export function Tour({
  targets,
  scrollRef,
  loggedCount,
  onDone,
}: {
  targets: TourTargets;
  scrollRef: React.RefObject<ScrollView | null>;
  /** How many levers read as logged today — the outbox-overlaid count. */
  loggedCount: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const overlayRef = useRef<View>(null);
  const reduce = useReduceMotion();
  const tabInset = useTabBarInset();

  // A log that happened DURING the tour, as opposed to today already having
  // one when a replay starts — the grid sentence only claims "there's today
  // lighting up" when they just lit it.
  const startCount = useRef(loggedCount);
  const loggedInTour = loggedCount > startCount.current;

  const def = STEPS[step];
  const interactive = !!def.interactive;
  const sentence = def.copy(loggedInTour);
  const last = step === STEPS.length - 1;

  /**
   * The scroll offset is OURS while the tour is up — the dashboard passes
   * `scrollEnabled={false}` — so a ref the tour writes is the truth, and
   * there is no listener to wire.
   */
  const scrollY = useRef(0);
  useEffect(() => {
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollRef]);

  /**
   * Where the hole goes. Window coordinates from `measureInWindow`, converted
   * into the overlay's own space by measuring the overlay the same way — the
   * overlay does not start at the window origin on Android edge-to-edge.
   *
   * If the target sits under the tab bar (or above the top), scroll it clear
   * and measure once more on the next frame. `retried` stops a target that
   * genuinely cannot fit from looping.
   */
  const measure = useCallback(
    (retried = false) => {
      if (!def.anchor) return setRect(null);
      const node = targets[def.anchor].current;
      const overlay = overlayRef.current;
      if (!node || !overlay) return setRect(null);
      node.measureInWindow((x, y, w, h) => {
        overlay.measureInWindow((ox, oy, _ow, oh) => {
          if (!w || !h) return setRect(null);
          const r = { x: x - ox, y: y - oy, w, h };
          const bottomMax = oh - tabInset;
          const topMin = space[12];
          let dy = 0;
          if (r.y + r.h > bottomMax) dy = r.y + r.h - bottomMax + space[4];
          else if (r.y < topMin) dy = Math.max(-scrollY.current, r.y - topMin);
          if (dy !== 0 && !retried && scrollRef.current) {
            scrollY.current += dy;
            scrollRef.current.scrollTo({
              y: scrollY.current,
              animated: false,
            });
            requestAnimationFrame(() => measure(true));
            return;
          }
          setRect(r);
        });
      });
    },
    [def.anchor, targets, scrollRef, tabInset],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [measure]);

  // The hole, animated. Rect state drives four shared values so the spotlight
  // FLIES between targets instead of cutting; reduce-motion assigns directly
  // (the ring is the cue and it stays), and the first placement never flies
  // in from nowhere.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!frame) return;
    // No anchor: a zero-size hole mid-screen, i.e. a full scrim.
    const t = rect ?? { x: frame.w / 2, y: frame.h * 0.35, w: 0, h: 0 };
    const jump = reduce || !placed.current;
    const to = (v: number) => (jump ? v : withTiming(v, TIMING));
    hx.value = to(t.x);
    hy.value = to(t.y);
    hw.value = to(t.w);
    hh.value = to(t.h);
    placed.current = true;
  }, [rect, frame, reduce, hx, hy, hw, hh]);

  const topStyle = useAnimatedStyle(() => ({
    height: Math.max(0, hy.value),
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    top: hy.value + hh.value,
  }));
  const leftStyle = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    width: Math.max(0, hx.value),
  }));
  const rightStyle = useAnimatedStyle(() => ({
    top: hy.value,
    height: hh.value,
    left: hx.value + hw.value,
  }));
  const holeStyle = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: hx.value - RING_PAD,
    top: hy.value - RING_PAD,
    width: hw.value + RING_PAD * 2,
    height: hh.value + RING_PAD * 2,
    opacity: hw.value > 0 ? 1 : 0,
  }));

  const advance = useCallback(() => {
    if (step >= STEPS.length - 1) onDone();
    else setStep(step + 1);
  }, [step, onDone]);

  // The interactive step advances when a log LANDS — same outbox-overlaid
  // count the grid renders from, so the cell lighting and the tour moving on
  // are one event. The count at step entry is the baseline, so a replay with
  // today already logged still works: a SECOND lever advances it, and skip is
  // always there.
  const entryCount = useRef(loggedCount);
  const latestCount = useRef(loggedCount);
  latestCount.current = loggedCount;
  useEffect(() => {
    if (STEPS[step].interactive) entryCount.current = latestCount.current;
  }, [step]);
  useEffect(() => {
    if (interactive && loggedCount > entryCount.current) advance();
  }, [interactive, loggedCount, advance]);

  // Back means "one step up", exactly as it did in the paged manual — the
  // navigator sees one route, so without this Back would pop the whole tab.
  useAndroidBack(
    useCallback(() => {
      if (step > 0) setStep(step - 1);
      else onDone();
      return true;
    }, [step, onDone]),
  );

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `step ${step + 1} of ${STEPS.length}. ${sentence}`,
    );
  }, [step, sentence]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame({ w: width, h: height });
    measure();
  };

  /**
   * On the interactive step the scrim consumes taps without advancing — the
   * levers are the control, skip is the explicit out — and it hides from the
   * screen reader so focus lands on the live levers and the card. Everywhere
   * else it IS the next button, but only ONE of the four rects says so: four
   * identical "next" stops in a row is noise, not access.
   */
  const scrim = (animated: object, a11y = false) => {
    const spoken = a11y && !interactive;
    return (
      <Animated.View
        style={[styles.scrim, animated]}
        accessibilityElementsHidden={!spoken}
        importantForAccessibility={spoken ? "auto" : "no-hide-descendants"}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={interactive ? () => {} : advance}
          accessibilityRole={spoken ? "button" : undefined}
          accessibilityLabel={spoken ? "next" : undefined}
        />
      </Animated.View>
    );
  };

  const card = (
    <View style={styles.card}>
      <Body tone="ink">{sentence}</Body>
      <View style={styles.cardRow}>
        <Label>
          {step + 1} / {STEPS.length}
        </Label>
        {!last && (
          <TextButton
            title={interactive ? "skip" : "skip the tour"}
            onPress={interactive ? advance : onDone}
            align="start"
          />
        )}
      </View>
    </View>
  );

  // Below the hole when the target sits in the top half, above it otherwise —
  // which is what keeps the card off the tab bar when the levers are lit.
  const cardAbove =
    rect && frame ? rect.y + rect.h / 2 > frame.h / 2 : false;

  return (
    <View
      ref={overlayRef}
      collapsable={false}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
      {scrim([styles.top, topStyle])}
      {scrim([styles.bottom, bottomStyle], true)}
      {scrim([styles.left, leftStyle])}
      {scrim([styles.right, rightStyle])}

      {/* Tap-anywhere includes the hole — except on the interactive step,
          where the hole is the live lever grid and must stay uncovered. */}
      {!interactive && rect && (
        <Animated.View style={[styles.hole, holeStyle]}>
          <Pressable style={{ flex: 1 }} onPress={advance} accessible={false} />
        </Animated.View>
      )}

      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      {rect && frame ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cardSlot,
            cardAbove
              ? { bottom: frame.h - rect.y + RING_PAD + space[3] }
              : { top: rect.y + rect.h + RING_PAD + space[3] },
          ]}
        >
          {card}
        </View>
      ) : (
        <View pointerEvents="box-none" style={styles.cardCenter}>
          {card}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    backgroundColor: SCRIM,
  },
  top: { left: 0, right: 0, top: 0 },
  bottom: { left: 0, right: 0, bottom: 0 },
  left: { left: 0 },
  right: { right: 0 },
  hole: { position: "absolute" },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: color.ink,
    borderRadius: radius.md,
  },
  cardSlot: {
    position: "absolute",
    left: space[5],
    right: space[5],
  },
  cardCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: space[5],
  },
  card: {
    backgroundColor: color.surfaceHi,
    borderWidth: 1,
    borderColor: color.lineHi,
    borderRadius: radius.lg,
    padding: space[4],
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space[2],
  },
});
