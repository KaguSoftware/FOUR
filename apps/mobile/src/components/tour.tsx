import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { pixelPaths, pixelWall, wallGrid } from "@uptime/core";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { TextButton } from "@/components/button";
import { useTabBarInset } from "@/components/screen";
import { Body, Label } from "@/components/ui";
import { useAndroidBack } from "@/lib/back";
import { useReduceMotion } from "@/lib/reduce-motion";
import { tourStep } from "@/lib/tour";
import { color, radius, space } from "@/theme";

/**
 * The first-run tour: a spotlight that walks the LIVE app.
 *
 * This replaced a seven-page written manual (2026-08-04, owner decision). The
 * manual explained everything at the one moment the user had seen nothing,
 * then disappeared. The tour teaches on the real screens instead: everything
 * dims except one real element at a time, two short sentences each, and the
 * step that matters is performed rather than read — the lever buttons stay
 * live under the hole, a real tap opens the real log sheet, and the real
 * write landing is what advances the tour. Nothing is faked.
 *
 * **It crosses screens.** Dashboard (the number, the levers — performed —
 * the grid, the hold gesture), then History, then Proof, then a closing card
 * back on Home. The step index lives in `lib/tour.ts`; each participating
 * screen mounts a `<TourOverlay screen=…>` with refs to its own elements, and
 * only the overlay whose screen owns the current step renders. Advancing
 * onto a step from another screen navigates there.
 *
 * **Explaining vs doing is stated, not implied.** An explaining step has a
 * calm static ring and "tap anywhere to continue". The one doing step gets a
 * "tap one" pill pointing into the hole and a ring that breathes — and under
 * reduce-motion the breath becomes a thicker static ring: the cue survives,
 * the movement goes.
 *
 * The scrim is four plain views around a hole, not an SVG mask. The hole is
 * literally uncovered screen, which is what makes the doing step work: there
 * is nothing to forward touches through, because there is nothing there. On
 * every other step a transparent pressable sits in the hole so "tap anywhere
 * advances" stays true everywhere.
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
type Anchor = "hero" | "levers" | "grid" | "months" | "wall";

export type TourTargets = Partial<Record<Anchor, React.RefObject<View | null>>>;

type StepDef = {
  screen: TourScreen;
  anchor: Anchor | null;
  copy: (loggedInTour: boolean) => string;
  /** The lever step: the hole is live and a real log is what advances. */
  interactive?: boolean;
};

const STEPS: StepDef[] = [
  {
    screen: "home",
    anchor: "hero",
    copy: () =>
      "your uptime — how many of the last 30 days at least one real thing got logged. one lever is enough for a day to count.",
  },
  {
    screen: "home",
    anchor: "levers",
    interactive: true,
    copy: () =>
      "these are your levers. done one of them today? tap it — that's all logging is.",
  },
  {
    screen: "home",
    anchor: "grid",
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
    copy: () =>
      "hold a lever to pick it up. drag to reorder, or drop it on the trash to archive — four is the ceiling.",
  },
  {
    screen: "history",
    anchor: "months",
    copy: () =>
      "history — one calendar per month, swipe to go back in time. tap any day to see exactly what it held.",
  },
  {
    screen: "proof",
    anchor: "wall",
    copy: () =>
      "one cell lights here for every day up this month. the cells that never light spell something — like the sample above, most of a month in.",
  },
  {
    screen: "home",
    anchor: null,
    copy: () =>
      "that's the whole system. the pager stays silent while you're fine and pages when you're down — everything else is in settings.",
  },
];

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
/** How far the ring breathes outward on the doing step. */
const PULSE = 4;
/** The "tap one" pill block: pill + arrow + gap, reserved above the hole. */
const PILL_BLOCK = 38;
const TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };

export function TourOverlay({
  screen,
  targets,
  scrollRef,
  loggedCount = 0,
}: {
  screen: TourScreen;
  targets: TourTargets;
  /** Only for screens that scroll — the overlay brings targets into view. */
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Home only: how many levers read as logged today (outbox-overlaid). */
  loggedCount?: number;
}) {
  const router = useRouter();
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
  const startCount = useRef(loggedCount);
  const loggedInTour = loggedCount > startCount.current;

  const interactive = !!def?.interactive;
  const sentence = def && active ? def.copy(loggedInTour) : "";
  const last = stepIndex === STEPS.length - 1;

  /**
   * Step changes, possibly across screens: set the index, then navigate if
   * the destination step lives elsewhere. `null` ends the tour — and lands
   * back on Home if it ends anywhere else, so "skip the tour" from History
   * does not strand someone on a screen they never chose.
   */
  const go = useCallback(
    (next: number | null) => {
      if (next === null) {
        tourStep.set(null);
        if (screen !== "home") router.navigate(ROUTE.home);
        return;
      }
      tourStep.set(next);
      if (STEPS[next].screen !== screen) router.navigate(ROUTE[STEPS[next].screen]);
    },
    [screen, router],
  );

  const advance = useCallback(() => {
    if (stepIndex === null) return;
    go(stepIndex >= STEPS.length - 1 ? null : stepIndex + 1);
  }, [stepIndex, go]);

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

  // The hole, animated. Rect state drives four shared values so the spotlight
  // FLIES between targets instead of cutting; reduce-motion assigns directly
  // (the ring is the cue and it stays), and the first placement never flies
  // in from nowhere.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  useEffect(() => {
    if (!frame || !active) return;
    // No anchor: a zero-size hole mid-screen, i.e. a full scrim.
    const t = rect ?? { x: frame.w / 2, y: frame.h * 0.35, w: 0, h: 0 };
    const jump = reduce || !placed.current;
    const to = (v: number) => (jump ? v : withTiming(v, TIMING));
    hx.value = to(t.x);
    hy.value = to(t.y);
    hw.value = to(t.w);
    hh.value = to(t.h);
    placed.current = true;
  }, [rect, frame, active, reduce, hx, hy, hw, hh]);

  // The doing step's ring breathes; cancelled the moment the step is not the
  // doing one. Under reduce-motion it never starts — the static ring is
  // thickened instead, below.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active && interactive && !reduce) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [active, interactive, reduce, pulse]);

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
      borderWidth: interactive && reduce ? 3 : 2,
    };
  });

  // The doing step advances when a log LANDS — same outbox-overlaid count the
  // grid renders from, so the cell lighting and the tour moving on are one
  // event. The count at step entry is the baseline, so a replay with today
  // already logged still works: a SECOND lever advances it, and skip is
  // always there.
  const entryCount = useRef(loggedCount);
  const latestCount = useRef(loggedCount);
  latestCount.current = loggedCount;
  useEffect(() => {
    if (active && interactive) entryCount.current = latestCount.current;
  }, [active, interactive, stepIndex]);
  useEffect(() => {
    if (active && interactive && loggedCount > entryCount.current) advance();
  }, [active, interactive, loggedCount, advance]);

  // Back means "one step up", exactly as it did in the paged manual — the
  // navigator sees one route, so without this Back would pop the whole tab.
  useAndroidBack(
    useCallback(() => {
      if (!active || stepIndex === null) return false;
      go(stepIndex > 0 ? stepIndex - 1 : null);
      return true;
    }, [active, stepIndex, go]),
  );

  useEffect(() => {
    if (!active || stepIndex === null) return;
    AccessibilityInfo.announceForAccessibility(
      `step ${stepIndex + 1} of ${STEPS.length}. ${sentence}`,
    );
  }, [active, stepIndex, sentence]);

  if (!active || stepIndex === null || !def) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame({ w: width, h: height });
    measure();
  };

  /**
   * On the doing step the scrim consumes taps without advancing — the levers
   * are the control, skip is the explicit out — and it hides from the screen
   * reader so focus lands on the live levers and the card. Everywhere else it
   * IS the next button, but only ONE of the four rects says so: four
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
        {!last && (
          <TextButton
            title={interactive ? "skip this" : "skip the tour"}
            onPress={interactive ? advance : () => go(null)}
            align="start"
          />
        )}
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
  const cardTop = () => {
    if (!rect || !frame) return {};
    if (tall)
      return { bottom: frame.h - (rect.y + rect.h) + space[3] };
    if (cardAbove)
      return {
        bottom:
          frame.h -
          rect.y +
          RING_PAD +
          space[3] +
          (interactive ? PILL_BLOCK : 0),
      };
    return { top: rect.y + rect.h + RING_PAD + space[3] };
  };

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

      {/* Tap-anywhere includes the hole — except on the doing step, where the
          hole is the live lever grid and must stay uncovered. */}
      {!interactive && rect && (
        <Animated.View style={[styles.hole, holeStyle]}>
          <Pressable style={{ flex: 1 }} onPress={advance} accessible={false} />
        </Animated.View>
      )}

      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      {/* The doing cue: a pill pointing into the hole. Explaining steps get
          nothing here — the calm ring alone — which is the whole distinction
          between "look at this" and "do this now". */}
      {interactive && rect && (
        <View
          pointerEvents="none"
          style={[styles.pillSlot, { top: rect.y - RING_PAD - PILL_BLOCK }]}
        >
          <View style={styles.pill}>
            <Label style={{ color: color.bg }}>tap one</Label>
          </View>
          <View style={styles.pillArrow} />
        </View>
      )}

      {rect && frame ? (
        <View pointerEvents="box-none" style={[styles.cardSlot, cardTop()]}>
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
