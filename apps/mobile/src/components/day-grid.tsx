import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
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
 * Two modes, because the two screens ask different questions:
 *
 * - **`month`** on Home: the actual calendar month, seven columns, today in the
 *   column its weekday falls on. "Where am I in this month."
 * - **`trailing`** on History: a dense block of the last N days with no
 *   calendar structure at all. "How has the last quarter looked."
 */
export function DayGrid({
  entries,
  today,
  spans,
  days = 30,
  mode = "trailing",
}: {
  entries: Entry[];
  today: string;
  /** Every lever's lifespan, archived included. */
  spans: LeverSpan[];
  /** `trailing` only. */
  days?: number;
  mode?: "trailing" | "month";
}) {
  // How many distinct levers fired on each day. Keyed by date because that is
  // what the ramp is a function of — never by lever identity.
  const fired = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = fired.get(e.logged_for) ?? new Set<string>();
    set.add(e.lever);
    fired.set(e.logged_for, set);
  }

  if (mode === "month") {
    return <MonthView fired={fired} today={today} spans={spans} />;
  }

  const start = addDays(today, -(days - 1));
  const cells = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Last ${days} days. ${fired.size} logged.`}
    >
      {cells.map((date) => {
        const fill = gridFill(
          fired.get(date)?.size ?? 0,
          leversOn(spans, date),
        );
        const isToday = date === today;

        return (
          <View
            key={date}
            style={{
              width: 21,
              height: 21,
              borderRadius: radius.sm,
              backgroundColor: fill ?? color.surface,
              // A down day is an outline; an up day is a fill. Today gets the
              // brighter ring on top of whichever it is.
              borderWidth: fill && !isToday ? 0 : 1,
              borderColor: isToday ? color.lineHi : color.line,
            }}
          />
        );
      })}
    </View>
  );
}

/** Columns, and the gap between them. The cell sizes itself from the width. */
const COLS = 7;
const GAP = 6;

function MonthView({
  fired,
  today,
  spans,
}: {
  fired: Map<string, Set<string>>;
  today: string;
  spans: LeverSpan[];
}) {
  const [width, setWidth] = useState(0);
  const month = monthGrid(today);

  const upThisMonth = month.cells.filter(
    (d) => d !== null && (fired.get(d)?.size ?? 0) > 0,
  ).length;

  const cell = width > 0 ? (width - GAP * (COLS - 1)) / COLS : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${month.label}. Day ${month.dayOfMonth} of ${month.daysInMonth}. ${upThisMonth} logged.`}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[3],
        }}
      >
        <Label>{month.label}</Label>
        <Mono style={{ fontSize: size.xs, color: color.inkMute }}>
          {month.dayOfMonth} / {month.daysInMonth}
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

          const fill = gridFill(
            fired.get(date)?.size ?? 0,
            leversOn(spans, date),
          );
          const isToday = date === today;
          // Days later this month have not happened yet. Also not a down day:
          // the trailing grid never had this problem because it stopped at
          // today, and a calendar has to say "not yet" without saying "missed".
          const future = date > today;

          if (isToday) {
            return <TodayCell key={date} size={cell} fill={fill} />;
          }

          return (
            <View
              key={date}
              style={{
                width: cell,
                height: cell,
                borderRadius: radius.sm,
                backgroundColor: future
                  ? "transparent"
                  : (fill ?? color.surface),
                borderWidth: fill && !future ? 0 : 1,
                borderColor: future ? color.surface : color.line,
              }}
            />
          );
        })}
      </View>
    </View>
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
}: {
  size: number;
  fill: string | null;
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

  return (
    <Animated.View
      style={[
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
      ]}
    />
  );
}
