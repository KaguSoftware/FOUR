import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
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
  windowStart,
  type Entry,
  type LeverSpan,
} from "@uptime/core";
import { Label, Mono } from "./ui";
import { pressDim, ripple } from "@/lib/press";
import { useReduceMotion } from "@/lib/reduce-motion";
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
      style={{ gap: GAP }}
    >
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: GAP }}>
          {row.map((date) => (
            <DayCell
              key={date}
              date={date}
              fill={gridFill(fired.get(date)?.size ?? 0, leversOn(spans, date))}
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
 * Every month since the first entry, newest first, **one per swipe**.
 *
 * It was a vertical stack, and an account a year old made History a page you
 * scrolled through thirteen calendars of to reach the incident list under
 * them. Months are peers — you look at one, then at another — and a stack made
 * them a single long document.
 *
 * Anchors come from core so the walk cannot skip a month; stepping back from
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
  const [width, setWidth] = useState(0);
  const fired = firedByDate(entries);
  // From the first entry rather than from signup: a pager that opens on empty
  // months is a stack of nothing in front of the real history.
  const earliest = firstLogged(entries) ?? today;
  const anchors = monthsBetween(earliest, today);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // Every page is `minWeeks: 6` tall, so this never changes between
      // months and the incident list below it does not jump on each swipe.
      // Measured from the widest month a calendar can be: six rows plus the
      // header block.
      accessibilityHint="Swipe left for earlier months"
    >
      {width > 0 && (
        <FlatList
          data={anchors}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(anchor) => anchor}
          // Fixed page width, so `getItemLayout` is exact and the list can
          // jump straight to an index without measuring anything.
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <View style={{ width }}>
              <MonthView
                anchor={item}
                fired={fired}
                today={today}
                spans={spans}
                onPressDay={onPressDay}
                position={`${index + 1} of ${anchors.length}`}
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
  onPress,
}: {
  date: string;
  fill: string | null;
  isToday: boolean;
  future?: boolean;
  onPress?: (date: string) => void;
}) {
  // Today breathes on BOTH grids. The pulse exists because a static ring did
  // not read as "you are here" on a real phone, and Home — the screen opened
  // to decide whether today is done — is where that has to land hardest.
  if (isToday) {
    return <TodayCell fill={fill} date={date} onPress={onPress} />;
  }

  const style = {
    // The row is a fixed number of cells wide, so equal flex divides it exactly
    // — no measurement, and no rounding that can push a cell onto a new line.
    flex: 1,
    aspectRatio: 1,
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
      // This cell is the hardest ground in the app for a ripple: its fill is
      // the DATA and runs the whole ramp from `surface` to nearly `ink`, so
      // the one neutral has to read against both ends. `ink-mute` is 5.08:1
      // on the dim end and 3.02:1 on the bright one. See `ripple`.
      android_ripple={ripple()}
      style={({ pressed }) => [style, { opacity: pressDim(pressed) }]}
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
  fill,
  date,
  onPress,
}: {
  fill: string | null;
  date: string;
  onPress?: (date: string) => void;
}) {
  const phase = useSharedValue(0);
  // Was an inline subscription here — the only one in the app. It is
  // `lib/reduce-motion` now, because the snackbar has the same obligation.
  const reduceMotion = useReduceMotion();

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

  // The outer element carries the `flex: 1` that divides the row; the animated
  // box fills it. Splitting them keeps the flex sizing off the element whose
  // style is being driven on the UI thread.
  const box = [
    {
      width: "100%" as const,
      aspectRatio: 1,
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

  if (!onPress) {
    return (
      <View style={{ flex: 1 }}>
        <Animated.View style={box} />
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
        {
          flex: 1,
          // Invisible — this element has no fill and no border; the animated
          // box inside carries both. It exists so the foreground ripple has
          // an outline to clip to, or it paints a square over a rounded cell.
          borderRadius: radius.sm,
        },
        { opacity: pressDim(pressed) },
      ]}
    >
      <Animated.View style={box} />
    </Pressable>
  );
}
