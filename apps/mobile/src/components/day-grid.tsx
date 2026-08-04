import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import { useFocusEffect } from "expo-router";
import {
  addDays,
  gridFill,
  leversOn,
  monthGrid,
  monthsBetween,
  WEEKDAY_INITIALS,
  windowStart,
  type Entry,
  type LeverSpan,
} from "@four/core";
import { Label, Mono } from "./ui";
import { pressDim, ripple } from "@/lib/press";
import { useReduceMotion } from "@/lib/reduce-motion";
import { color, radius, size, space } from "@/theme";

/**
 * The day grid — the signature component, and one of the four things in this
 * app that is deliberately NOT a platform control.
 *
 * The ramp is computed by `@four/core`, not here. Two clients generating
 * their own shades would be two answers to "how did that day look", and the
 * whole reason core exists is that there is one. A day where more of your
 * levers fired is lighter — proportionally, so two of three is two thirds of
 * the way to ink — and a down day is a bordered surface with no fill at all.
 *
 * **Each day is shaded against the levers that existed on THAT day**, via
 * `leversOn`. Using today's count meant adding a fourth lever quietly dimmed
 * every complete three-lever day already on screen, which is history changing
 * because of a decision made after it.
 *
 * **The cell is a whole cell, always.** Its brightness carries how much of the
 * day's levers fired; it is never subdivided into a partial bar. A bar draws
 * the remainder as a visible hole, and a hole reads as *you did not finish*,
 * which is the one thing this grid must never say. A dim cell is still a whole
 * cell.
 *
 * Down cells carry a border that up cells do not, so state never rests on
 * colour alone — which is also what keeps the dimmest up-day from reading as a
 * gap in the row.
 *
 * Two shapes, because the two screens ask different questions:
 *
 * - **`DayGrid`** on Home: thirty days, ten to a row, no calendar structure at
 *   all. "How has it been lately." Ten and not seven on purpose — a seven-wide
 *   row invites reading a weekday pattern down the columns, and this layout
 *   does not encode one. It begins at day one until the account is thirty days
 *   old and rolls thereafter; see `windowStart`.
 * - **`MonthStack`** on History: every month since the first entry, seven
 *   columns, so a column IS a weekday. "Which months, and which days do I
 *   actually lose." The calendar earns its place here and not on Home, where
 *   it reset to nearly empty on the 1st of every month.
 */

/** Home's trailing block. Ten across, so 30 days is three even rows. */
const TRAILING_COLS = 10;
/** History's calendar. Seven across, because a column is a weekday. */
const MONTH_COLS = 7;
const GAP = 6;

/** Distinct levers per day, indexed once rather than scanned per cell. */
function firedByDate(entries: readonly Entry[]) {
  const fired = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = fired.get(e.logged_for) ?? new Set<string>();
    set.add(e.lever);
    fired.set(e.logged_for, set);
  }
  return fired;
}

/**
 * The earliest logged day, or null.
 *
 * Scanned rather than read off `entries[0]`. The query does order ascending,
 * but Home passes a re-assembled array — the server list filtered, with
 * optimistic taps appended — and "the first element is the oldest" is a
 * property nobody maintaining that assembly would think to preserve.
 */
function firstLogged(entries: readonly Entry[]): string | null {
  let first: string | null = null;
  for (const e of entries) {
    if (first === null || e.logged_for < first) first = e.logged_for;
  }
  return first;
}

export function DayGrid({
  entries,
  today,
  spans,
  days = 30,
  onPressDay,
}: {
  entries: Entry[];
  today: string;
  /** Every lever's lifespan, archived included. */
  spans: LeverSpan[];
  days?: number;
  /** Omitted where the grid is a specimen rather than a control. */
  onPressDay?: (date: string) => void;
}) {
  const fired = firedByDate(entries);

  /**
   * Where the block begins — day one, until there is a full window of history.
   *
   * See `windowStart`. The short version: a plain rolling window is read
   * backwards on a new account. Three days in, twenty-seven cells were blank
   * and the three real ones sat at the bottom-right, so the grid appeared to
   * fill from the end — and every cell shifted one place left overnight, so
   * yesterday's square was never where you left it.
   */
  const start = windowStart(firstLogged(entries), today, days);
  const cells = Array.from({ length: days }, (_, i) => addDays(start, i));
  const elapsed = cells.filter((d) => d <= today).length;

  /**
   * The cell size, measured once and floored to a whole pixel.
   *
   * **`flex: 1` + `aspectRatio: 1` is what made the rows drift.** Ten cells and
   * nine 6pt gaps divide a phone's content width into a FRACTIONAL cell — 29.6pt
   * at 390, 30.8 at 402, 33.4 at 428. Flex happily lays those out at sub-pixel
   * widths, but `aspectRatio` then derives each cell's HEIGHT from its own
   * fractional width and the platform rounds that to the pixel grid
   * independently per cell. The rows ended up a fraction of a point apart and
   * offset differently from one another, which reads exactly as the owner
   * described it: rows shifted left and right. Reported on device 2026-08-04.
   *
   * Measuring once and flooring gives every cell in every row the identical
   * integer box, so the three rows cannot disagree. The remainder (under 10pt)
   * is absorbed by the row's `justifyContent`, not smeared across the cells.
   *
   * Same doctrine as `lever-buttons.tsx`, which measures its container and
   * positions fixed-size cells rather than letting flex round them.
   */
  const [width, setWidth] = useState(0);
  const size =
    width > 0
      ? Math.floor((width - GAP * (TRAILING_COLS - 1)) / TRAILING_COLS)
      : 0;

  /**
   * Chunked into explicit rows, never left to `flexWrap`.
   *
   * The column count is a design decision (see the docblock). Wrapping makes it
   * whatever happens to fit — and with a measured, fractional cell width, ten
   * cells plus nine gaps can total a hair MORE than the container after
   * rounding, so the tenth wraps and the grid silently renders nine across.
   * That shipped once. Rows are explicit now and the cells size themselves with
   * `flex: 1`, which fills the width exactly and cannot round wrong.
   */
  const rows: string[][] = [];
  for (let i = 0; i < cells.length; i += TRAILING_COLS) {
    rows.push(cells.slice(i, i + TRAILING_COLS));
  }

  return (
    <View
      // "Last 30 days" is a lie while the block is pinned to day one — most of
      // it has not happened yet. It says which day of the window this is
      // instead, which is also the more useful thing to hear on day three.
      accessibilityLabel={
        elapsed < days
          ? `Day ${elapsed} of ${days}. ${fired.size} logged.`
          : `Last ${days} days. ${fired.size} logged.`
      }
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        // Only on a real change: onLayout fires on every re-render on Android.
        setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
      }}
      style={{ gap: GAP }}
    >
      {size > 0 &&
        rows.map((row, r) => (
          <View key={r} style={{ flexDirection: "row", gap: GAP }}>
            {row.map((date) => (
              <DayCell
                key={date}
                date={date}
                size={size}
                fill={gridFill(
                  fired.get(date)?.size ?? 0,
                  leversOn(spans, date),
                )}
                isToday={date === today}
                // Days the block reaches that have not happened yet. Drawn as
                // nothing, exactly as a calendar's trailing pad is — a day that
                // has not arrived is not a day that was missed. Only reachable
                // while the block is pinned to day one.
                future={date > today}
                onPress={onPressDay}
                // Home's cells land near 31pt — under the 44pt minimum, and the
                // reason History's calendar is the comfortable place to open a
                // day. No hitSlop: at a 6pt gap the slop regions would overlap
                // and the tap would become a guess between two days.
              />
            ))}
          </View>
        ))}
    </View>
  );
}

/**
 * Every month since the first entry, **one per swipe**, oldest on the left.
 *
 * It was a vertical stack, and an account a year old made History a page you
 * scrolled through thirteen calendars of to reach the incident list under
 * them. Months are peers — you look at one, then at another — and a stack made
 * them a single long document.
 *
 * Anchors come from core so the walk cannot skip a month; stepping back from
 * the 31st with naive date maths lands in March twice and never in February.
 *
 * **The order is reversed HERE, not in core.** `monthsBetween` returns newest
 * first, which put the current month at the far left and last month to its
 * right: going back in time meant swiping the wrong way, against the direction
 * every other timeline in this app runs. Reported on device (2026-08-04).
 *
 * Core is left alone because the web pager reads the same function and labels
 * its arrows to match (`month-pager.tsx`); flipping the shared helper would
 * silently invert the browser and its tests to fix a phone. The pager opens on
 * the LAST index for the same reason it used to open on the first — the month
 * you want to see is this one.
 */
export function MonthStack({
  entries,
  today,
  spans,
  onPressDay,
  onPageChange,
}: {
  entries: Entry[];
  today: string;
  spans: LeverSpan[];
  onPressDay?: (date: string) => void;
  /**
   * A completed swipe to another page. The tour's History step advances on
   * it; nothing else listens today. Fires on settle, not per frame.
   */
  onPageChange?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const fired = firedByDate(entries);
  // From the first entry rather than from signup: a pager that opens on empty
  // months is a stack of nothing in front of the real history.
  const earliest = firstLogged(entries) ?? today;
  // Oldest → newest, so time runs left to right. `toReversed` is not available
  // on this Hermes; `slice().reverse()` copies rather than mutating core's array.
  const anchors = monthsBetween(earliest, today).slice().reverse();
  const last = anchors.length - 1;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // Every page is `minWeeks: 6` tall, so this never changes between
      // months and the incident list below it does not jump on each swipe.
      // Measured from the widest month a calendar can be: six rows plus the
      // header block.
      accessibilityHint="Swipe right for earlier months"
    >
      {width > 0 && (
        <FlatList
          data={anchors}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(anchor) => anchor}
          // Opens on this month, which is now the last page rather than the
          // first. Safe to jump to without measuring because `getItemLayout`
          // below is exact — without it, an initial index on a horizontal list
          // is what makes a pager land between two pages.
          initialScrollIndex={last}
          // Fixed page width, so `getItemLayout` is exact and the list can
          // jump straight to an index without measuring anything.
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={onPageChange}
          renderItem={({ item, index }) => (
            <View style={{ width }}>
              <MonthView
                anchor={item}
                fired={fired}
                today={today}
                spans={spans}
                onPressDay={onPressDay}
                // Counted from the newest month, so this month is always
                // "1 of n" however far back the history goes. The pages are
                // ordered oldest-first for the swipe; the COUNT is what a
                // person would say out loud, and nobody calls this month
                // "fourteen of fourteen".
                position={`${last - index + 1} of ${anchors.length}`}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

function MonthView({
  anchor,
  fired,
  today,
  spans,
  onPressDay,
  position,
}: {
  anchor: string;
  fired: Map<string, Set<string>>;
  today: string;
  spans: LeverSpan[];
  onPressDay?: (date: string) => void;
  /** "1 of 14" — where this page sits, since a swipe has no other cue. */
  position?: string;
}) {
  /**
   * Six rows, always.
   *
   * A real month occupies four, five or six depending on how its 1st falls,
   * which was fine in a vertical stack where each was simply as tall as it
   * was. In a pager the container takes the height of the page on screen, so
   * swiping between a four-row February and a six-row August would resize the
   * whole screen and shunt the incident list under it up and down.
   */
  const month = monthGrid(anchor, { minWeeks: 6 });

  // Days already past, so the current month does not count its own future as
  // days that failed to happen.
  const upThisMonth = month.cells.filter(
    (d) => d !== null && d <= today && (fired.get(d)?.size ?? 0) > 0,
  ).length;

  // `monthGrid` pads to whole weeks, so this is always exact rows of seven —
  // which is what lets every cell be `flex: 1` and fill the width exactly.
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < month.cells.length; i += MONTH_COLS) {
    weeks.push(month.cells.slice(i, i + MONTH_COLS));
  }

  return (
    <View
      accessibilityLabel={`${month.label} ${month.year}. ${upThisMonth} logged.`}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[3],
        }}
      >
        <Label>
          {month.label} {month.year}
        </Label>
        <Mono style={{ fontSize: size.xs, color: color.inkMute }}>
          {position ? `${position} · ` : ""}
          {upThisMonth} up
        </Mono>
      </View>

      <View style={{ flexDirection: "row", gap: GAP, marginBottom: space[2] }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Mono
            key={i}
            // `flex: 1`, matching the cells below, so a header always sits over
            // its own column whatever the screen width.
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: size["2xs"],
              color: color.inkMute,
            }}
          >
            {d}
          </Mono>
        ))}
      </View>

      <View style={{ gap: GAP }}>
        {weeks.map((week, w) => (
          <View key={w} style={{ flexDirection: "row", gap: GAP }}>
            {week.map((date, i) => {
              // Padding from the neighbouring month. Drawn as nothing at all —
              // a day outside this month has no state, and an empty bordered
              // cell here would read as a missed day.
              if (date === null) {
                return (
                  <View
                    key={`pad-${w}-${i}`}
                    style={{ flex: 1, aspectRatio: 1 }}
                  />
                );
              }

              return (
                <DayCell
                  key={date}
                  date={date}
                  fill={gridFill(
                    fired.get(date)?.size ?? 0,
                    leversOn(spans, date),
                  )}
                  isToday={date === today}
                  // Days later this month have not happened yet. Also not a
                  // down day: a calendar has to say "not yet" without saying
                  // "missed".
                  future={date > today}
                  onPress={onPressDay}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One day.
 *
 * A `Pressable` rather than a `View` wherever `onPress` is supplied — the grid
 * is the only record of what a day held, and it was previously unopenable.
 * Where no handler is given (the manual's specimens) it stays inert rather
 * than offering a tap that goes nowhere.
 *
 * **Press feedback is per-platform, like every other control in this app.**
 * Both cells shipped `pressed && { opacity: 0.6 }` on both platforms — the
 * iOS held-press idiom, rendered on Android too. The grid was written before
 * `lib/press` existed and was the one thing the Android pass missed, so the
 * signature component of the product was also the only surface on Home and
 * History that answered an Android tap the iOS way. Android ripples; iOS
 * keeps the exact fade it already had. Never both — see `lib/press`.
 */
function DayCell({
  date,
  fill,
  isToday,
  future = false,
  size,
  onPress,
}: {
  date: string;
  fill: string | null;
  isToday: boolean;
  future?: boolean;
  /**
   * A measured, whole-pixel side. Home passes one; History does not.
   *
   * Home's ten columns divide a phone into a fractional cell, and letting each
   * one round its own `aspectRatio` height made the three rows drift apart —
   * see `DayGrid`. History's seven columns are wider and it pads short weeks
   * with flex spacers, so it keeps the simpler sizing.
   */
  size?: number;
  onPress?: (date: string) => void;
}) {
  // Today breathes on BOTH grids. The pulse exists because a static ring did
  // not read as "you are here" on a real phone, and Home — the screen opened
  // to decide whether today is done — is where that has to land hardest.
  if (isToday) {
    return <TodayCell fill={fill} date={date} size={size} onPress={onPress} />;
  }

  const style = {
    // A measured integer box where one was given, so every row agrees to the
    // pixel. Otherwise equal flex, which History's wider columns can afford.
    ...(size ? { width: size, height: size } : { flex: 1, aspectRatio: 1 }),
    borderRadius: radius.sm,
    backgroundColor: future ? "transparent" : (fill ?? color.surface),
    /**
     * **Every cell carries a border, always.** A filled day's border is simply
     * its own fill, so it is invisible while still occupying the box.
     *
     * This used to be `borderWidth: fill ? 0 : 1`, which meant an up day and a
     * down day were DIFFERENT SIZES: React Native draws a border inside the
     * box, so a 1px border shrinks the painted square by 2px against a
     * borderless neighbour. Mixed rows therefore sat a couple of pixels out
     * from each other and the grid read as shifted left and right — reported
     * on device 2026-08-04, and correctly traced by the owner to the ring
     * around today, which is 2px and was the most visible offender.
     *
     * Keeping the width constant and moving only the COLOUR is the same
     * technique `TodayCell` already uses to stop its pulse resizing the cell.
     */
    borderWidth: 1,
    borderColor: future
      ? color.surface
      : isToday
        ? color.lineHi
        : (fill ?? color.line),
  } as const;

  // Future days are not openable: there is nothing to show, and a sheet that
  // says so is a sheet that had to be dismissed for no reason.
  if (!onPress || future) return <View style={style} />;

  return (
    <Pressable
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityLabel={`${date}: ${fill ? "up" : "down"}`}
      // This cell is the hardest ground in the app for a ripple: its fill is
      // the DATA and runs the whole ramp from `surface` to nearly `ink`, so
      // the one neutral has to read against both ends. `ink-mute` is 5.08:1
      // on the dim end and 3.02:1 on the bright one. See `ripple`.
      android_ripple={ripple()}
      style={({ pressed }) => [style, { opacity: pressDim(pressed) }]}
    />
  );
}

/**
 * The dash pattern and its march. `DASH_ON + DASH_OFF` is one period, and the
 * loop animates the offset by EXACTLY one period with linear easing, so the
 * seam where the repeat restarts is invisible — the motion reads as one
 * continuous rotation. ~2.6s per period: a slow instrument, not a spinner.
 */
const DASH_ON = 9;
const DASH_OFF = 6;
const DASH_PERIOD = DASH_ON + DASH_OFF;
const MARCH_MS = 2600;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Today's cell: a dashed ring marching anti-clockwise around the border.
 *
 * It replaced a colour pulse (owner call, 2026-08-04): the moving dashes are
 * a SHAPE cue, so "you are here" no longer rests on a colour ramp at all —
 * and every bright hue in this palette is reserved for status anyway (amber
 * is degraded, red is down), so today cannot borrow one. It is identical
 * whether the day is up or down, deliberately.
 *
 * This is a liveness indicator, not a celebration — the register `DESIGN.md`
 * forbids is triumph, and an instrument panel marking its current sample is
 * the opposite of that.
 *
 * The direction: an SVG rect's path winds clockwise, and a growing
 * `strokeDashoffset` slides the pattern against the path's own direction, so
 * the dashes travel anti-clockwise. (Flagged in HANDOFF for a device check —
 * this is exactly the kind of fact a simulator screenshot cannot prove.)
 *
 * Two things it must do: stop when the screen is not focused, or it animates
 * forever behind three other tabs; and hold still under Reduce Motion — a
 * static dashed ring keeps the cue, and an indefinite loop is precisely what
 * that setting is for.
 */
function TodayCell({
  fill,
  date,
  size,
  onPress,
}: {
  fill: string | null;
  date: string;
  /** See `DayCell`. Home measures; History flexes. */
  size?: number;
  onPress?: (date: string) => void;
}) {
  const phase = useSharedValue(0);
  // Was an inline subscription here — the only one in the app. It is
  // `lib/reduce-motion` now, because the snackbar has the same obligation.
  const reduceMotion = useReduceMotion();
  // History's cells flex (no measured size), and the SVG ring needs real
  // pixels — so this cell measures itself there. Home passes `size` and the
  // measurement never runs.
  const [measured, setMeasured] = useState(0);
  const side = size ?? measured;

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      phase.value = withRepeat(
        withTiming(1, { duration: MARCH_MS, easing: Easing.linear }),
        -1,
        false,
      );
      return () => {
        cancelAnimation(phase);
        phase.value = 0;
      };
    }, [phase, reduceMotion]),
  );

  /**
   * The dash pattern, SCALED so a whole number of periods tiles the ring's
   * perimeter exactly. Unscaled, ~6.7 periods fit a 30pt cell and the
   * remainder piles up at the path's start as one mis-sized chunk in a
   * corner — which is precisely how it looked on the first device screenshot
   * (2026-08-04). The centreline perimeter of the rounded rect is
   * 4·L − 8r + 2πr for side L and corner radius r.
   */
  const inner = side - 2;
  const perimeter =
    side > 0 ? 4 * inner - 8 * radius.sm + 2 * Math.PI * radius.sm : 0;
  const periods = Math.max(4, Math.round(perimeter / DASH_PERIOD));
  const dashScale = perimeter > 0 ? perimeter / (periods * DASH_PERIOD) : 1;
  const dashOn = DASH_ON * dashScale;
  const dashOff = DASH_OFF * dashScale;

  const dashProps = useAnimatedProps(() => ({
    strokeDashoffset: phase.value * (dashOn + dashOff),
  }));

  const box = {
    // Fills whatever the outer element measures out to, so this matches the
    // plain cells exactly on both grids. NO border here: RN lays children out
    // INSIDE the border band, so a border shifted the SVG ring 2px down-right
    // and it overflowed the cell (device screenshot, 2026-08-04). The ring is
    // drawn OVER the fill's edge instead, which reads identically.
    width: "100%" as const,
    ...(size ? { height: size } : { aspectRatio: 1 }),
    borderRadius: radius.sm,
    backgroundColor: fill ?? color.surface,
  };

  // Stroke centred 1px in, so the 2px stroke hugs the cell edge the way the
  // old 2px border did. `pointerEvents="none"` — the ring is paint, not a
  // control.
  const ring =
    side > 0 ? (
      <Svg
        width={side}
        height={side}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <AnimatedRect
          x={1}
          y={1}
          width={inner}
          height={inner}
          rx={radius.sm}
          fill="none"
          stroke={color.ink}
          strokeWidth={2}
          strokeDasharray={`${dashOn} ${dashOff}`}
          animatedProps={dashProps}
        />
      </Svg>
    ) : null;

  const onBoxLayout =
    size === undefined
      ? (e: { nativeEvent: { layout: { width: number } } }) => {
          const w = Math.round(e.nativeEvent.layout.width);
          setMeasured((prev) => (Math.abs(prev - w) < 1 ? prev : w));
        }
      : undefined;

  // The outer element carries the sizing that divides the row; the animated box
  // fills it. Splitting them keeps the flex sizing off the element whose style
  // is being driven on the UI thread.
  const outer = size ? { width: size } : { flex: 1 };

  if (!onPress) {
    return (
      <View style={outer}>
        <View style={box} onLayout={onBoxLayout}>
          {ring}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityLabel={`${date}, today: ${fill ? "up" : "down"}`}
      android_ripple={ripple()}
      style={({ pressed }) => [
        outer,
        {
          // Invisible — this element has no fill and no border; the animated
          // box inside carries both. It exists so the foreground ripple has
          // an outline to clip to, or it paints a square over a rounded cell.
          borderRadius: radius.sm,
        },
        { opacity: pressDim(pressed) },
      ]}
    >
      <View style={box} onLayout={onBoxLayout}>
        {ring}
      </View>
    </Pressable>
  );
}
