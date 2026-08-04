import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import {
  moodBarHeight,
  moodLabel,
  MOOD_MAX,
  MOOD_MIN,
  type MoodDay,
} from "@uptime/core";

import { Label, Mono } from "./ui";
import { committed, nudged } from "@/lib/haptics";
import { color, radius, size, space } from "@/theme";

/**
 * How was today — the week, and today's answer inside it.
 *
 * **This replaced a slider, and the reason was not that the slider looked
 * wrong.** The reading was effectively write-only: nothing in the app ever
 * showed it back except the day sheet, one day at a time behind a grid tap, as
 * the literal string `63 mood`. You fed it daily and never saw it again, which
 * is what made answering feel like a chore rather than a habit — and the
 * previous two rebuilds both treated that as a layout problem and both failed.
 *
 * So the control IS the readback. Seven bars: six days behind you, today last.
 * Drag anywhere on the row to set today. Every answer visibly joins a record,
 * and the gap left by a day you skipped is the only prompt the app needs to
 * make — it never asks.
 *
 * **Seven, because a week is the unit that matters.** `evaluatePlateau` folds
 * days into ISO weeks and throws away any week with fewer than three readings,
 * so this is exactly the window the monitor judges. It also makes each bar
 * twice as wide to hit as a fortnight would.
 *
 * **No Save button.** The slider grew one on 2026-08-04 because a drag taken to
 * browse the faces was indistinguishable from an answer. There are no faces to
 * browse now, a drag here has exactly one meaning, and the strip shows the
 * result immediately — so there is nothing left to confirm. Releasing writes.
 * Owner's call, 2026-08-04, reversing their own earlier one.
 *
 * **It still cannot affect uptime.** A day is up because a lever fired. This is
 * a note about the day, never a judgement of it, and skipping it costs nothing
 * — which is only true if the control never behaves as though it is owed an
 * answer. It has no empty state, no prompt, and no way to be wrong.
 */

/** Matches the day grid's gap, so the strip reads as its sibling. */
const GAP = 6;
const DAYS = 7;
/** Tall enough to drag with precision; short enough to leave Home unchanged. */
const TRACK = 44;

export function MoodStrip({
  week,
  onCommit,
  saving = false,
}: {
  /** Exactly `DAYS` entries, oldest first, today last. From `moodWeek`. */
  week: MoodDay[];
  /** Fired on release, never mid-drag. */
  onCommit: (value: number) => void;
  /** While the write is in flight. */
  saving?: boolean;
}) {
  /**
   * The bar width, measured once and floored to a whole pixel.
   *
   * NOT `flex: 1`. Seven bars and six gaps divide a phone into a fractional
   * width, and letting each bar round its own is exactly what made the day
   * grid's rows drift apart — see `DayGrid`. One integer, applied to all seven.
   */
  const [width, setWidth] = useState(0);
  const barW = width > 0 ? Math.floor((width - GAP * (DAYS - 1)) / DAYS) : 0;

  /**
   * The value under the finger, or null when nothing is being dragged.
   *
   * Separate from the stored week so the bar tracks at 60fps while the WRITE
   * happens once on release — a write per frame would be a hundred upserts for
   * one answer.
   */
  const [dragging, setDragging] = useState<number | null>(null);

  const today = week[week.length - 1] ?? { date: "", value: null };
  const live = dragging ?? today.value;
  const answered = week.filter((d) => d.value !== null).length;

  /**
   * The last value handed to JS, held on the UI thread.
   *
   * `onUpdate` fires every frame and a `runOnJS` per frame is precisely the
   * traffic this pattern exists to avoid, so the quantised value is compared
   * here and JS is only touched when it actually changes. Same trick as
   * `lastSlot` in `lever-buttons.tsx`.
   */
  const lastSent = useSharedValue(-1);

  // Read through a ref so the gesture below is never rebuilt mid-drag: the
  // parent re-renders on every value change and `onCommit` changes identity
  // with it.
  const handlers = useRef({ onCommit });
  handlers.current = { onCommit };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // No `activateAfterLongPress`. The levers need one because a tap there
        // logs a day and must never be ambiguous; nothing competes for a tap
        // here, so the drag starts under the finger immediately.
        .minDistance(0)
        .onBegin((e) => {
          lastSent.value = -1;
          const v = valueAt(e.y);
          lastSent.value = v;
          runOnJS(setDragging)(v);
        })
        .onUpdate((e) => {
          const v = valueAt(e.y);
          if (v === lastSent.value) return;
          lastSent.value = v;
          runOnJS(setDragging)(v);
          // The softest constant available, because this fires many times in
          // one drag. Never `impactAsync` on Android — see lib/haptics.
          runOnJS(nudged)();
        })
        .onEnd(() => {
          const v = lastSent.value;
          if (v < MOOD_MIN) return;
          runOnJS(committed)();
          runOnJS(handlers.current.onCommit)(v);
        })
        // Clearing on finalize rather than on end covers a CANCELLED gesture
        // too — a drag interrupted by a system sheet would otherwise leave the
        // bar stuck at a value that was never written.
        //
        // Safe to clear immediately even though the write has not landed: the
        // parent lays its in-flight value over the week it passes back (see
        // `justSaved` on Home), so `today.value` already carries it by the time
        // this render runs. Without that the bar would drop for one frame and
        // read as the drag having been rejected.
        .onFinalize(() => {
          runOnJS(setDragging)(null);
        }),
    [lastSent],
  );

  return (
    <View>
      {/* The label and the count share a row: the count is the only readback
          the header needs, and a second line would cost height this section
          has already been rebuilt twice to save. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[3],
        }}
      >
        <Label>how was today</Label>
        <Mono style={{ fontSize: size.xs, color: color.inkMute }}>
          {answered}/{DAYS}
        </Mono>
      </View>

      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="How was today"
          // A word, not a number out of a hundred — "sixty-three" is not an
          // answer to "how was today".
          accessibilityValue={{
            min: MOOD_MIN,
            max: MOOD_MAX,
            now: live ?? undefined,
            text: moodLabel(live),
          }}
          // A custom-drawn drag target is unreachable without these; the native
          // slider got them for free and this does not.
          accessibilityActions={[
            { name: "increment", label: "Better" },
            { name: "decrement", label: "Worse" },
          ]}
          onAccessibilityAction={(e) => {
            const step = 10;
            const from = live ?? MOOD_MIN + Math.round((MOOD_MAX - MOOD_MIN) / 2);
            const next =
              e.nativeEvent.actionName === "increment" ? from + step : from - step;
            const clamped = Math.min(Math.max(next, MOOD_MIN), MOOD_MAX);
            committed();
            onCommit(clamped);
          }}
          onLayout={(e) => {
            const next = e.nativeEvent.layout.width;
            // Only on a real change: onLayout fires on every re-render on
            // Android, and re-measuring mid-drag would move the bars.
            setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
          }}
          style={{
            height: TRACK,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: GAP,
            // Dimmed as a whole while the write is in flight — the app has no
            // spinners, and the bar has already moved to where it will land.
            opacity: saving ? 0.6 : 1,
          }}
        >
          {barW > 0 &&
            week.map((day, i) => {
              const isToday = i === week.length - 1;
              const value = isToday ? live : day.value;
              const h = moodBarHeight(value);

              return (
                <View
                  key={day.date}
                  style={{
                    width: barW,
                    // A day nobody answered is a STUB at the floor, not a bar
                    // at zero — it must never read as "that day was rough".
                    // `moodBarHeight` returns 0 for null and never less than
                    // its floor for a real reading, so the two cannot collide.
                    height: h > 0 ? Math.max(h * TRACK, 3) : 3,
                    borderRadius: radius.sm,
                    backgroundColor:
                      h === 0
                        ? color.line
                        : isToday
                          ? color.ink
                          : color.lineHi,
                  }}
                />
              );
            })}
        </View>
      </GestureDetector>
    </View>
  );

}

/**
 * A y within the track, as a stored value.
 *
 * A worklet — it runs on the UI thread inside the gesture callbacks. The
 * arithmetic is `moodValue`'s, written out rather than imported: a worklet can
 * only call functions that were themselves compiled as worklets, and importing
 * one from `@uptime/core` (a plain TypeScript module Metro does not transform)
 * fails at runtime with "tried to synchronously call a non-worklet function".
 *
 * Inverted because the track grows upward while y grows downward. Kept in step
 * with core by the round-trip test in `mood.test.ts`.
 */
function valueAt(y: number): number {
  "worklet";
  const f = 1 - Math.min(Math.max(y / TRACK, 0), 1);
  return Math.round(MOOD_MIN + f * (MOOD_MAX - MOOD_MIN));
}
