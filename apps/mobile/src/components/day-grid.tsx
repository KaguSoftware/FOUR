import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import {
  addDays,
  gridFill,
  leversOn,
  monthGrid,
  monthsBetween,
  WEEKDAY_INITIALS,
  type Entry,
  type LeverSpan,
} from "@uptime/core";
import { Label, Mono } from "./ui";
import { color, radius, size, space } from "@/theme";

/**
 * The day grid — the signature component, and one of the four things in this
 * app that is deliberately NOT a platform control.
 *
 * The ramp is computed by `@uptime/core`, not here. Two clients generating
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
 * - **`DayGrid`** on Home: the trailing 30 days, ten to a row, no calendar
 *   structure at all. "How has it been lately." Ten and not seven on purpose —
 *   a seven-wide row invites reading a weekday pattern down the columns, and
 *   this layout does not encode one.
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
  const [width, setWidth] = useState(0);
  const cell =
    width > 0 ? (width - GAP * (TRAILING_COLS - 1)) / TRAILING_COLS : 0;

  const start = addDays(today, -(days - 1));
  const cells = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}
      accessibilityLabel={`Last ${days} days. ${fired.size} logged.`}
    >
      {cells.map((date) => (
        <DayCell
          key={date}
          date={date}
          size={cell}
          fill={gridFill(fired.get(date)?.size ?? 0, leversOn(spans, date))}
          isToday={date === today}
          onPress={onPressDay}
          // Home's cells land near 31pt — under the 44pt minimum, and the
          // reason History's calendar is the comfortable place to open a day.
          // No hitSlop: at a 6pt gap the slop regions would overlap and the
          // tap would become a guess between two days.
        />
      ))}
    </View>
  );
}

/**
 * Every month since the first entry, newest first.
 *
 * Anchors come from core so the walk cannot skip a month — stepping back from
 * the 31st with naive date maths lands in March twice and never in February.
 */
export function MonthStack({
  entries,
  today,
  spans,
  onPressDay,
}: {
  entries: Entry[];
  today: string;
  spans: LeverSpan[];
  onPressDay?: (date: string) => void;
}) {
  const fired = firedByDate(entries);
  // From the first entry rather than from signup: a stack that opens on empty
  // months is a wall of nothing in front of the real history.
  const earliest = entries[0]?.logged_for ?? today;
  const anchors = monthsBetween(earliest, today);

  return (
    <View style={{ gap: space[8] }}>
      {anchors.map((anchor) => (
        <MonthView
          key={anchor}
          anchor={anchor}
          fired={fired}
          today={today}
          spans={spans}
          onPressDay={onPressDay}
        />
      ))}
    </View>
  );
}

function MonthView({
  anchor,
  fired,
  today,
  spans,
  onPressDay,
}: {
  anchor: string;
  fired: Map<string, Set<string>>;
  today: string;
  spans: LeverSpan[];
  onPressDay?: (date: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const month = monthGrid(anchor);

  // Days already past, so the current month does not count its own future as
  // days that failed to happen.
  const upThisMonth = month.cells.filter(
    (d) => d !== null && d <= today && (fired.get(d)?.size ?? 0) > 0,
  ).length;

  const cell = width > 0 ? (width - GAP * (MONTH_COLS - 1)) / MONTH_COLS : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
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
          {upThisMonth} up
        </Mono>
      </View>

      <View style={{ flexDirection: "row", gap: GAP, marginBottom: space[2] }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Mono
            key={i}
            style={{
              width: cell,
              textAlign: "center",
              fontSize: size["2xs"],
              color: color.inkMute,
            }}
          >
            {d}
          </Mono>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {month.cells.map((date, i) => {
          // Padding from the neighbouring month. Drawn as nothing at all — a
          // day outside this month has no state, and an empty bordered cell
          // here would read as a missed day.
          if (date === null) {
            return (
              <View key={`pad-${i}`} style={{ width: cell, height: cell }} />
            );
          }

          return (
            <DayCell
              key={date}
              date={date}
              size={cell}
              fill={gridFill(fired.get(date)?.size ?? 0, leversOn(spans, date))}
              isToday={date === today}
              // Days later this month have not happened yet. Also not a down
              // day: a calendar has to say "not yet" without saying "missed".
              future={date > today}
              onPress={onPressDay}
            />
          );
        })}
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
 */
function DayCell({
  date,
  size: cell,
  fill,
  isToday,
  future = false,
  onPress,
}: {
  date: string;
  size: number;
  fill: string | null;
  isToday: boolean;
  future?: boolean;
  onPress?: (date: string) => void;
}) {
  // Today breathes on BOTH grids. The pulse exists because a static ring did
  // not read as "you are here" on a real phone, and Home — the screen opened
  // to decide whether today is done — is where that has to land hardest.
  if (isToday) {
    return <TodayCell size={cell} fill={fill} date={date} onPress={onPress} />;
  }

  const style = {
    width: cell,
    height: cell,
    borderRadius: radius.sm,
    backgroundColor: future ? "transparent" : (fill ?? color.surface),
    // A down day is an outline; an up day is a fill. Today keeps the brighter
    // ring on top of whichever it is.
    borderWidth: fill && !isToday && !future ? 0 : 1,
    borderColor: future
      ? color.surface
      : isToday
        ? color.lineHi
        : color.line,
  } as const;

  // Future days are not openable: there is nothing to show, and a sheet that
  // says so is a sheet that had to be dismissed for no reason.
  if (!onPress || future) return <View style={style} />;

  return (
    <Pressable
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityLabel={`${date}: ${fill ? "up" : "down"}`}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    />
  );
}

/** ~2s each way. Slow enough to read as a heartbeat rather than a blink. */
const PULSE_MS = 1800;

/**
 * Today's cell, breathing.
 *
 * A static `lineHi` ring measures 3.33:1 and was not reading as "you are here"
 * on a real phone. The answer is motion rather than more colour: every bright
 * hue in this palette is reserved for status (amber is degraded, red is down),
 * so today cannot borrow one.
 *
 * This is a liveness indicator, not a celebration — the register `DESIGN.md`
 * forbids is triumph, and an instrument panel marking its current sample is the
 * opposite of that. It stays slow, greyscale, and identical whether the day is
 * up or down.
 *
 * Two things it must do: stop when the screen is not focused, or it animates
 * forever behind three other tabs; and collapse to a static ring under Reduce
 * Motion, since an indefinite loop is precisely what that setting is for.
 */
function TodayCell({
  size: cell,
  fill,
  date,
  onPress,
}: {
  size: number;
  fill: string | null;
  date: string;
  onPress?: (date: string) => void;
}) {
  const phase = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      phase.value = withRepeat(
        withTiming(1, {
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
      return () => {
        cancelAnimation(phase);
        phase.value = 0;
      };
    }, [phase, reduceMotion]),
  );

  const animated = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      phase.value,
      [0, 1],
      [color.lineHi, color.ink],
    ),
  }));

  const box = [
    {
      width: cell,
      height: cell,
      borderRadius: radius.sm,
      backgroundColor: fill ?? color.surface,
      // 2px at both ends of the pulse, so the cell does not resize as it
      // animates — only the colour moves.
      borderWidth: 2,
    },
    // Reduce Motion gets the bright end of the same ramp, statically. The
    // cue survives; only the movement goes.
    reduceMotion ? { borderColor: color.ink } : animated,
  ];

  if (!onPress) return <Animated.View style={box} />;

  return (
    <Pressable
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityLabel={`${date}, today: ${fill ? "up" : "down"}`}
    >
      <Animated.View style={box} />
    </Pressable>
  );
}
