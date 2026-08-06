import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { pixelPaths, pixelWall, wallGrid } from "@four/core";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button, TextButton } from "@/components/button";
import { useTabBarInset } from "@/components/screen";
import { Body, Label } from "@/components/ui";
import { useAndroidBack } from "@/lib/back";
import { nudged } from "@/lib/haptics";
import { useReduceMotion } from "@/lib/reduce-motion";
import { tourStep } from "@/lib/tour";
import { color, radius, space } from "@/theme";

/**
 * The first-run tour: a spotlight that walks the LIVE app.
 *
 * This replaced a seven-page written manual (2026-08-04, owner decision). The
 * manual explained everything at the one moment the user had seen nothing,
 * then disappeared. The tour teaches on the real screens instead: everything
 * dims except one real element at a time, two short sentences each — and the
 * steps that matter are PERFORMED, not read. Logging, reordering and the
 * History swipe each keep their element live under the hole; the real action
 * landing is what advances the tour. Nothing is faked.
 *
 * **It crosses screens.** Dashboard (the number, the levers — log one — the
 * grid, the hold gesture, the mood question), then History (swipe a month),
 * then Proof, then a closing card back on Home. The step index lives in
 * `lib/tour.ts`; each participating screen mounts a `<TourOverlay screen=…>`
 * with refs to its own elements, and only the overlay whose screen owns the
 * current step renders. Advancing onto a step from another screen navigates
 * there.
 *
 * **Doing vs explaining is stated, not implied.** An explaining step says
 * "tap anywhere to continue" on the card and carries a calm static ring. A
 * doing step gets a labelled pill pointing into the hole ("tap one",
 * "hold + drag", "swipe"), a ring that breathes with the pill, and a
 * "skip this step" out on the card. A doing step whose action is IMPOSSIBLE
 * right now (one lever — nothing to reorder; one month — nothing to swipe)
 * quietly degrades to an explaining step rather than dead-ending.
 *
 * The scrim is four plain views around a hole, not an SVG mask. The hole is
 * literally uncovered screen, which is what makes the doing steps work:
 * there is nothing to forward touches through, because there is nothing
 * there. On explaining steps a transparent pressable sits in the hole so
 * "tap anywhere" stays true everywhere.
 *
 * Motion doctrine: the spotlight flies on a spring, the overlay fades in and
 * out (never a hard cut), the pill and ring breathe as one object, and every
 * advance ticks `nudged()`. Under reduce-motion all of it collapses to
 * static cues in place — the cue survives, the movement goes.
 *
 * The native tab bar stays bright. It cannot be covered from JS
 * (`NativeTabs` owns it), and it is real chrome rather than tour content — a
 * dimmed screen with live chrome is how every platform sheet already looks.
 */

export type TourScreen = "home" | "history" | "proof";

const ROUTE = {
  home: "/",
  history: "/history",
  proof: "/proof",
} as const;

type Rect = { x: number; y: number; w: number; h: number };
type Anchor = "hero" | "levers" | "grid" | "mood" | "months" | "wall";
type AdvanceOn = "tap" | "log" | "reorder" | "swipe";

export type TourTargets = Partial<Record<Anchor, React.RefObject<View | null>>>;
export type TourCounts = Partial<Record<"log" | "reorder" | "swipe", number>>;

type StepDef = {
  screen: TourScreen;
  anchor: Anchor | null;
  copy: (loggedInTour: boolean) => string;
  advanceOn: AdvanceOn;
  /** The pill's word on a doing step. */
  cue?: string;
};

const STEPS: StepDef[] = [
  {
    screen: "home",
    anchor: "hero",
    advanceOn: "tap",
    copy: () =>
      "your uptime — how many of the last 30 days at least one real thing got logged. one lever is enough for a day to count.",
  },
  {
    screen: "home",
    anchor: "levers",
    advanceOn: "log",
    cue: "tap one",
    copy: () =>
      "these are your levers. done one of them today? tap it — that's all logging is.",
  },
  {
    screen: "home",
    anchor: "grid",
    advanceOn: "tap",
    // Two sentences for one step: if a log just landed, the lesson is the
    // cell they lit; if they skipped, the grid is described instead of shown
    // working.
    copy: (logged) =>
      logged
        ? "that's today, lit. each cell is one day — brighter means more of your levers fired."
        : "each cell is one day. brighter means more of your levers fired; an outlined cell is a day the system was down.",
  },
  {
    screen: "home",
    anchor: "levers",
    advanceOn: "reorder",
    cue: "hold + drag",
    copy: () =>
      "hold a lever to pick it up, then drag it somewhere else. drop it on the trash instead to archive — four is the ceiling.",
  },
  {
    screen: "home",
    anchor: "mood",
    advanceOn: "tap",
    copy: () =>
      "one question, once a day — slide how it felt and let go; letting go saves. the bars are the last 14 days, so a rough stretch shows early.",
  },
  {
    screen: "history",
    anchor: "months",
    advanceOn: "swipe",
    cue: "swipe",
    copy: () =>
      "history — one calendar per month, swipe to go back in time. tap any day to see exactly what it held.",
  },
  {
    screen: "proof",
    anchor: "wall",
    advanceOn: "tap",
    copy: () =>
      "one cell lights here for every day up this month. the cells that never light spell something — like the sample above, most of a month in.",
  },
  {
    screen: "home",
    anchor: null,
    advanceOn: "tap",
    copy: () =>
      "that's the whole system. the pager stays silent while you're fine and pages when you're down — everything else is in settings.",
  },
];

/** What the screen reader is told to do, per advance mode. */
const HINT: Record<AdvanceOn, string> = {
  tap: "tap anywhere to continue.",
  log: "tap one of your levers to continue, or skip this step.",
  reorder: "hold and drag a lever to continue, or skip this step.",
  swipe: "swipe the calendar to continue, or skip this step.",
};

/** Whether the running tour's CURRENT step belongs to this screen. */
export function useTourOn(screen: TourScreen): boolean {
  const step = useSyncExternalStore(tourStep.subscribe, tourStep.get);
  return step !== null && STEPS[step]?.screen === screen;
}

/**
 * `color.bg` at 0.78 over the content. The composite grounds this produces
 * are measured in `scripts/check-contrast.mjs` — change one, change both.
 */
const SCRIM = "rgba(13, 16, 19, 0.78)";
/** Breathing room between the element and the scrim edge. */
const HOLE_PAD = 6;
const RING_PAD = 6;
/** How far the ring breathes outward on a doing step. */
const PULSE = 4;
/** The pill block: pill + arrow + gap, reserved above the hole. */
const PILL_BLOCK = 38;
/** The spotlight's flight. Springy enough to feel alive, no visible bounce. */
const SPRING = { damping: 22, stiffness: 190, mass: 0.9 };

export function TourOverlay({
  screen,
  targets,
  scrollRef,
  counts,
  can,
}: {
  screen: TourScreen;
  targets: TourTargets;
  /** Only for screens that scroll — the overlay brings targets into view. */
  scrollRef?: React.RefObject<ScrollView | null>;
  /**
   * Action counters the doing steps watch: Home passes `log` (the
   * outbox-overlaid logged count) and `reorder`; History passes `swipe`. A
   * counter growing past its at-step-entry baseline advances the step.
   */
  counts?: TourCounts;
  /**
   * Whether a doing step's action is possible at all right now. `reorder`
   * false = one lever; `swipe` false = one month. A false here turns that
   * step into an explaining one instead of a dead end.
   */
  can?: Partial<Record<"reorder" | "swipe", boolean>>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stepIndex = useSyncExternalStore(tourStep.subscribe, tourStep.get);
  const active = stepIndex !== null && STEPS[stepIndex].screen === screen;
  const def = stepIndex !== null ? STEPS[stepIndex] : null;

  const [rect, setRect] = useState<Rect | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const overlayRef = useRef<View>(null);
  const reduce = useReduceMotion();
  const tabInset = useTabBarInset();

  // A log that happened DURING the tour, as opposed to today already having
  // one when a replay starts — the grid sentence only claims "that's today,
  // lit" when they just lit it.
  const startLog = useRef(counts?.log ?? 0);
  const loggedInTour = (counts?.log ?? 0) > startLog.current;

  // A doing step degrades to explaining when its action is impossible.
  const doingKey =
    def && def.advanceOn !== "tap"
      ? def.advanceOn === "log" || can?.[def.advanceOn] !== false
        ? def.advanceOn
        : null
      : null;
  const doing = doingKey !== null;
  const sentence = def && active ? def.copy(loggedInTour) : "";
  const last = stepIndex === STEPS.length - 1;

  /**
   * The overlay's own opacity: fades in on arrival, fades OUT before the
   * step store is cleared, so ending the tour is never a hard cut. Reduce
   * motion skips both.
   */
  const fade = useSharedValue(0);
  useEffect(() => {
    if (active && frame) {
      fade.value = reduce ? 1 : withTiming(1, { duration: 250 });
    }
  }, [active, frame, reduce, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  /** End the tour: fade out, then clear — and land home if we are not there. */
  const finish = useCallback(() => {
    const clear = () => {
      tourStep.set(null);
      if (screen !== "home") router.navigate(ROUTE.home);
    };
    if (reduce) {
      fade.value = 0;
      clear();
      return;
    }
    fade.value = withTiming(0, { duration: 200 }, (done) => {
      if (done) runOnJS(clear)();
    });
  }, [reduce, fade, screen, router]);

  /**
   * Step changes, possibly across screens: set the index, then navigate if
   * the destination step lives elsewhere.
   */
  const go = useCallback(
    (next: number) => {
      tourStep.set(next);
      if (STEPS[next].screen !== screen)
        router.navigate(ROUTE[STEPS[next].screen]);
    },
    [screen, router],
  );

  const advance = useCallback(() => {
    if (stepIndex === null) return;
    nudged();
    if (stepIndex >= STEPS.length - 1) finish();
    else go(stepIndex + 1);
  }, [stepIndex, go, finish]);

  /** The top-right skip: a whole-tour exit, so it asks first. */
  const confirmSkip = useCallback(() => {
    Alert.alert(
      "Skip the tour?",
      "You can rerun it any time from Settings → About.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Skip", onPress: finish },
      ],
    );
  }, [finish]);

  /**
   * The scroll offset is OURS while the tour is on this screen — the screen
   * passes `scrollEnabled={false}` — so a ref the tour writes is the truth,
   * and there is no listener to wire.
   */
  const scrollY = useRef(0);
  useEffect(() => {
    if (!active) return;
    scrollY.current = 0;
    scrollRef?.current?.scrollTo({ y: 0, animated: false });
  }, [active, scrollRef]);

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
      if (!active || !def) return;
      if (!def.anchor) return setRect(null);
      const node = targets[def.anchor]?.current;
      const overlay = overlayRef.current;
      if (!node || !overlay) return setRect(null);
      node.measureInWindow((x, y, w, h) => {
        overlay.measureInWindow((ox, oy, _ow, oh) => {
          if (!w || !h) return setRect(null);
          const r = {
            x: x - ox - HOLE_PAD,
            y: y - oy - HOLE_PAD,
            w: w + HOLE_PAD * 2,
            h: h + HOLE_PAD * 2,
          };
          const bottomMax = oh - tabInset;
          const topMin = space[12];
          let dy = 0;
          if (r.y + r.h > bottomMax) dy = r.y + r.h - bottomMax + space[4];
          else if (r.y < topMin) dy = Math.max(-scrollY.current, r.y - topMin);
          if (dy !== 0 && !retried && scrollRef?.current) {
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
    [active, def, targets, scrollRef, tabInset],
  );

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(id);
  }, [active, measure]);

  // Arriving on this screen mid-tour (History and Proof mount fresh when the
  // tour navigates to them; Home is returned to): measure once the screen
  // actually has focus, and place the spotlight without flying in from a
  // stale rect.
  const placed = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      placed.current = false;
      const id = requestAnimationFrame(() => measure());
      return () => cancelAnimationFrame(id);
    }, [active, measure]),
  );
  useEffect(() => {
    if (!active) placed.current = false;
  }, [active]);

  // The hole, animated. Rect state drives four shared values so the
  // spotlight FLIES between targets on a spring instead of cutting;
  // reduce-motion assigns directly (the ring is the cue and it stays), and
  // the first placement never flies in from nowhere.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  useEffect(() => {
    if (!frame || !active) return;
    // No anchor: a zero-size hole mid-screen, i.e. a full scrim.
    const t = rect ?? { x: frame.w / 2, y: frame.h * 0.35, w: 0, h: 0 };
    const jump = reduce || !placed.current;
    const to = (v: number) => (jump ? v : withSpring(v, SPRING));
    hx.value = to(t.x);
    hy.value = to(t.y);
    hw.value = to(t.w);
    hh.value = to(t.h);
    placed.current = true;
  }, [rect, frame, active, reduce, hx, hy, hw, hh]);

  // A doing step's ring and pill breathe together, from one value; cancelled
  // the moment the step is not a doing one. Under reduce-motion it never
  // starts — the static ring is thickened instead, below.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active && doing && !reduce) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [active, doing, reduce, pulse]);

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
  const ringStyle = useAnimatedStyle(() => {
    const pad = RING_PAD + pulse.value * PULSE;
    return {
      left: hx.value - pad,
      top: hy.value - pad,
      width: hw.value + pad * 2,
      height: hh.value + pad * 2,
      opacity: hw.value > 0 ? 1 : 0,
      borderWidth: doing && reduce ? 3 : 2,
    };
  });
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (pulse.value - 0.5) * 6 }],
  }));

  // A doing step advances when its ACTION lands — the same counters the
  // screens themselves render from, so the UI changing and the tour moving
  // on are one event. The counter at step entry is the baseline, so a replay
  // with today already logged still works: a SECOND lever advances it, and
  // "skip this step" is always there.
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const baseline = useRef(0);
  useEffect(() => {
    if (active && doingKey)
      baseline.current = countsRef.current?.[doingKey] ?? 0;
    // stepIndex is the real trigger: a NEW step needs a new baseline.
  }, [active, doingKey, stepIndex]);
  useEffect(() => {
    if (!active || !doingKey) return;
    if ((counts?.[doingKey] ?? 0) > baseline.current) advance();
  }, [active, doingKey, counts, advance]);

  // Back means "one step up", exactly as it did in the paged manual — the
  // navigator sees one route, so without this Back would pop the whole tab.
  useAndroidBack(
    useCallback(() => {
      if (!active || stepIndex === null) return false;
      if (stepIndex > 0) go(stepIndex - 1);
      else finish();
      return true;
    }, [active, stepIndex, go, finish]),
  );

  useEffect(() => {
    if (!active || stepIndex === null || !def) return;
    AccessibilityInfo.announceForAccessibility(
      `step ${stepIndex + 1} of ${STEPS.length}. ${sentence} ${
        doing ? HINT[def.advanceOn] : HINT.tap
      }`,
    );
  }, [active, stepIndex, def, sentence, doing]);

  if (!active || stepIndex === null || !def) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame({ w: width, h: height });
    measure();
  };

  /**
   * On a doing step the scrim consumes taps without advancing — the element
   * is the control, "skip this step" is the explicit out — and it hides from
   * the screen reader so focus lands on the live element and the card.
   * Everywhere else it IS the next button, but only ONE of the four rects
   * says so: four identical "next" stops in a row is noise, not access.
   */
  const scrim = (animated: object, a11y = false) => {
    const spoken = a11y && !doing;
    return (
      <Animated.View
        style={[styles.scrim, animated]}
        accessibilityElementsHidden={!spoken}
        importantForAccessibility={spoken ? "auto" : "no-hide-descendants"}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={doing ? () => {} : advance}
          accessibilityRole={spoken ? "button" : undefined}
          accessibilityLabel={spoken ? "next" : undefined}
        />
      </Animated.View>
    );
  };

  const card = (
    <Animated.View
      key={stepIndex}
      entering={reduce ? undefined : FadeInDown.duration(200)}
      style={styles.card}
    >
      {/* The wall step shows a SAMPLE, because a brand-new user's real wall
          behind the scrim is uniformly dark — the sentence would describe
          something invisible. It renders in the card, never on the screen:
          the real wall stays honest. "PROOF" is deliberately NOT in core's
          monthly pool, so the sample can never spoil the month's own word. */}
      {def.anchor === "wall" && <DemoWall />}
      <Body tone="ink">{sentence}</Body>
      <View style={styles.cardRow}>
        <Label>
          {stepIndex + 1} / {STEPS.length}
        </Label>
        {doing ? (
          <TextButton title="skip this step" onPress={advance} align="start" />
        ) : (
          !last && <Label>tap anywhere to continue</Label>
        )}
        {!doing && last && <Label>tap anywhere to finish</Label>}
      </View>
    </Animated.View>
  );

  // Below the hole when the target sits in the top half, above it otherwise —
  // which is what keeps the card off the tab bar when the levers are lit. A
  // hole taller than half the screen (the wall) gets the card laid OVER its
  // lower edge instead: "above" would push it into the header and "below"
  // under the tab bar.
  const tall = rect && frame ? rect.h > frame.h * 0.55 : false;
  const cardAbove =
    rect && frame ? rect.y + rect.h / 2 > frame.h / 2 && !tall : false;
  const cardPlace = () => {
    if (!rect || !frame) return {};
    if (tall) return { bottom: frame.h - (rect.y + rect.h) + space[3] };
    if (cardAbove)
      return {
        bottom:
          frame.h - rect.y + RING_PAD + space[3] + (doing ? PILL_BLOCK : 0),
      };
    return { top: rect.y + rect.h + RING_PAD + space[3] };
  };

  return (
    <Animated.View
      ref={overlayRef}
      collapsable={false}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, fadeStyle]}
      onLayout={onLayout}
    >
      {scrim([styles.top, topStyle])}
      {scrim([styles.bottom, bottomStyle], true)}
      {scrim([styles.left, leftStyle])}
      {scrim([styles.right, rightStyle])}

      {/* Tap-anywhere includes the hole — except on a doing step, where the
          hole is the live element and must stay uncovered. */}
      {!doing && rect && (
        <Animated.View style={[styles.hole, holeStyle]}>
          <Pressable style={{ flex: 1 }} onPress={advance} accessible={false} />
        </Animated.View>
      )}

      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      {/* The doing cue: a pill pointing into the hole, breathing with the
          ring. Explaining steps get nothing here — the calm ring alone —
          which is the whole distinction between "look" and "do". */}
      {doing && rect && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pillSlot,
            { top: rect.y - RING_PAD - PILL_BLOCK },
            pillStyle,
          ]}
        >
          <View style={styles.pill}>
            <Label style={{ color: color.bg }}>{def.cue}</Label>
          </View>
          <View style={styles.pillArrow} />
        </Animated.View>
      )}

      {/* The whole-tour exit, parked out of the content's way. A real
          bordered button, not a text link — grey 12px text over a scrim was
          invisible to the person most likely to want out (owner, 2026-08-06).
          It still asks first: an accidental everything-dismissal is the one
          tap this overlay must not make cheap, and the confirm is also what
          names the Settings → About replay path. Hidden on the closing step,
          where a tap anywhere IS the exit. */}
      {!last && (
        <View
          style={[styles.skipSlot, { top: insets.top + space[2] }]}
        >
          <Button title="skip tour" variant="subtle" onPress={confirmSkip} />
        </View>
      )}

      {rect && frame ? (
        <View pointerEvents="box-none" style={[styles.cardSlot, cardPlace()]}>
          {card}
        </View>
      ) : (
        <View pointerEvents="box-none" style={styles.cardCenter}>
          {card}
        </View>
      )}
    </Animated.View>
  );
}

/** The sample wall's box height and fill, sized for one 5-letter word. */
const DEMO_H = 110;
const DEMO_PCT = 0.7;

function DemoWall() {
  const [w, setW] = useState(0);
  return (
    <View
      style={{ height: DEMO_H, marginBottom: space[3] }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel="a sample wall: most of a month lit, the word proof left dark inside it"
    >
      {w > 0 && <DemoWallSvg width={w} />}
    </View>
  );
}

function DemoWallSvg({ width }: { width: number }) {
  // The REAL geometry and reveal order from core, at a fixed fraction — the
  // same functions the live wall draws with, so the sample cannot drift from
  // the thing it is a sample of.
  const grid = wallGrid({ width, height: DEMO_H });
  const wall = pixelWall({
    cols: grid.cols,
    rows: grid.rows,
    pct: DEMO_PCT,
    message: "PROOF",
  });
  const paths = pixelPaths(wall, grid);
  const span = (n: number) => n * (grid.cell + grid.gap) - grid.gap;
  return (
    <Svg width={span(grid.cols)} height={span(grid.rows)}>
      <Path d={paths.ground} fill={color.line} />
      {paths.lit.map((band) => (
        <Path
          key={band.opacity}
          d={band.d}
          fill={color.ink}
          fillOpacity={band.opacity}
        />
      ))}
    </Svg>
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
    borderColor: color.ink,
    borderRadius: radius.md,
  },
  pillSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    backgroundColor: color.ink,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  pillArrow: {
    width: 0,
    height: 0,
    marginTop: 2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: color.ink,
  },
  skipSlot: {
    position: "absolute",
    right: space[4],
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
    minHeight: 28,
  },
});
