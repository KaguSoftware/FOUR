import { useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import {
  moodBarHeight,
  moodLabel,
  MOOD_MAX,
  MOOD_MIN,
  type MoodDay,
} from "@uptime/core";

import { field, fieldTint } from "./fields";
import { Body, Label, Mono } from "./ui";
import { committed, nudged } from "@/lib/haptics";
import { ripple } from "@/lib/press";
import { useReduceMotion } from "@/lib/reduce-motion";
import { color, radius, size, space, TAP } from "@/theme";

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
/** A day nobody answered. Visible, but obviously not a reading. */
const STUB = 3;

/**
 * How far today's bar grows while held, per side and at the top.
 *
 * `GROW_X` is a little under half the gap, so a widened bar closes on its
 * neighbours without touching them — the row still reads as seven separate
 * days at the moment it matters most.
 */
const GROW_X = 4;
const GROW_Y = 8;

/** The lever grid's spring. One feel for anything the finger moves. */
const SPRING = { damping: 20, stiffness: 220 } as const;

/** The usable range, for band maths inside worklets. */
const SPAN = MOOD_MAX - MOOD_MIN;

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

  /**
   * The Android typing path: a string while the field is open, null otherwise.
   *
   * iOS uses `Alert.prompt` and never sets this. An inline field rather than a
   * dialog because Android has no `Alert.prompt`, and building a custom modal
   * for one number would be more surface than the feature is worth.
   */
  const [typing, setTyping] = useState<string | null>(null);

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

  /**
   * 0 at rest, 1 while the finger is down. Drives the grow.
   *
   * A shared value rather than state so the size change runs on the UI thread
   * and cannot be interrupted by the parent re-rendering on every step.
   */
  const held = useSharedValue(0);
  /** Which of `moodLabel`'s five bands the finger is in. Gates the haptic. */
  const lastBand = useSharedValue(-1);
  const reduceMotion = useReduceMotion();

  /**
   * Ask for a number, and write it if it is one.
   *
   * `Alert.prompt` is **iOS-only** — the same constraint the activity rename
   * hit — so Android opens the inline field below instead. Both land in the
   * same `commitTyped`.
   */
  function askForNumber() {
    if (Platform.OS !== "ios") {
      setTyping(String(live ?? ""));
      return;
    }
    Alert.prompt(
      "How was today",
      `${MOOD_MIN}–${MOOD_MAX}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Set", onPress: (text?: string) => commitTyped(text ?? "") },
      ],
      "plain-text",
      live === null ? "" : String(live),
      "number-pad",
    );
  }

  /** Shared by both entry paths. A number outside the range is clamped. */
  function commitTyped(text: string) {
    const n = Number(text.trim());
    // Not a number, or empty: a cancel, not a write. Silently, because the
    // user has already told us they changed their mind by typing nothing.
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(Math.round(n), MOOD_MIN), MOOD_MAX);
    committed();
    onCommit(clamped);
  }

  // Read through a ref so the gesture below is never rebuilt mid-drag: the
  // parent re-renders on every value change and these change identity with it.
  const handlers = useRef({ onCommit, onType: askForNumber });
  handlers.current = { onCommit, onType: askForNumber };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // No `activateAfterLongPress`. The levers need one because a tap there
        // logs a day and must never be ambiguous; nothing competes for a tap
        // here, so the drag starts under the finger immediately.
        .minDistance(0)
        .onBegin((e) => {
          held.value = withSpring(1, SPRING);
          lastSent.value = -1;
          lastBand.value = -1;
          const v = valueAt(e.y);
          lastSent.value = v;
          runOnJS(setDragging)(v);
        })
        .onUpdate((e) => {
          const v = valueAt(e.y);
          if (v === lastSent.value) return;
          lastSent.value = v;
          runOnJS(setDragging)(v);

          // The haptic fires per BAND, not per point. A full-height drag
          // crosses ~99 values, and a tick on each is a continuous buzz that
          // says nothing — `nudged` is documented as the constant for
          // "switching between a series of potential choices", and the choices
          // here are the five words `moodLabel` bands the range into. Never
          // `impactAsync` on Android; see lib/haptics.
          const band = Math.min(Math.floor(((v - MOOD_MIN) / SPAN) * 5), 4);
          if (band !== lastBand.value) {
            lastBand.value = band;
            runOnJS(nudged)();
          }
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
          held.value = withSpring(0, SPRING);
          runOnJS(setDragging)(null);
        }),
    [lastSent, lastBand, held],
  );

  /**
   * Double tap to type an exact number.
   *
   * A drag is quick but imprecise, and "I want to put 70 on this specifically"
   * is a real thing to want — particularly for someone comparing today against
   * a day they remember. The two coexist rather than one replacing the other:
   * the drag stays the primary gesture and this is the way to be exact.
   *
   * `Gesture.Exclusive` gives the double tap first refusal, so a genuine
   * double tap is never also read as two drags. A single tap still falls
   * through to `pan`, which sets the value where you touched.
   */
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .onEnd(() => {
          runOnJS(handlers.current.onType)();
        }),
    [],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(doubleTap, pan),
    [doubleTap, pan],
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
          // The strip below reserves `GROW_Y` of headroom for the held bar, so
          // this gives back the same amount and the section's total height is
          // unchanged — Home has been rebuilt twice over exactly this, and the
          // grow must not cost it a third time. Nets to `space[2]`, which is
          // the gap a label wants over the thing it names.
          marginBottom: space[4] - GROW_Y,
        }}
      >
        <Label>how was today</Label>
        <Mono style={{ fontSize: size.xs, color: color.inkMute }}>
          {answered}/{DAYS}
        </Mono>
      </View>

      {/* Android's typing path. It REPLACES the strip rather than sitting
          under it, so the section's height does not change while the keyboard
          is up — and the strip is not something you can usefully drag with a
          field focused anyway. iOS never renders this; it gets Alert.prompt. */}
      {typing !== null ? (
        <View style={{ flexDirection: "row", gap: space[2], height: TRACK }}>
          <TextInput
            {...fieldTint}
            autoFocus
            value={typing}
            onChangeText={setTyping}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={`${MOOD_MIN}–${MOOD_MAX}`}
            placeholderTextColor={color.inkMute}
            onSubmitEditing={() => {
              commitTyped(typing);
              setTyping(null);
            }}
            returnKeyType="done"
            style={[field, { flex: 1, backgroundColor: color.surface }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => setTyping(null)}
            android_ripple={ripple()}
            style={{
              minHeight: TAP,
              justifyContent: "center",
              paddingHorizontal: space[3],
              borderRadius: radius.md,
            }}
          >
            <Body tone="mute" style={{ fontSize: size.xs }}>
              cancel
            </Body>
          </Pressable>
        </View>
      ) : (
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="How was today"
          accessibilityHint="Double tap to type a number"
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
            // Headroom for the grow, taken from the margin above rather than
            // from the track — the bars keep their full TRACK of travel, and
            // a bar at 100% can still expand without being clipped by the row.
            // `overflow: visible` is the RN default but stated here because
            // the whole effect depends on it.
            overflow: "visible",
            marginTop: GROW_Y,
            // Dimmed as a whole while the write is in flight — the app has no
            // spinners, and the bar has already moved to where it will land.
            opacity: saving ? 0.6 : 1,
          }}
        >
          {barW > 0 &&
            week.map((day, i) => {
              const isToday = i === week.length - 1;
              if (isToday) {
                return (
                  <TodayBar
                    key={day.date}
                    value={live}
                    width={barW}
                    held={held}
                    reduceMotion={reduceMotion}
                  />
                );
              }

              const h = moodBarHeight(day.value);
              return (
                <View
                  key={day.date}
                  style={{
                    width: barW,
                    // A day nobody answered is a STUB at the floor, not a bar
                    // at zero — it must never read as "that day was rough".
                    // `moodBarHeight` returns 0 for null and never less than
                    // its floor for a real reading, so the two cannot collide.
                    height: h > 0 ? Math.max(h * TRACK, STUB) : STUB,
                    borderRadius: radius.sm,
                    backgroundColor: h === 0 ? color.line : color.lineHi,
                  }}
                />
              );
            })}

          {/* The live reading, over the strip rather than in the header.

              Absolute, so it costs no layout and nothing reflows as the digits
              change width. It sits at the RIGHT, above today's bar, and is
              `pointerEvents="none"` so it can never intercept the drag it is
              reporting on.

              Only while dragging: a number parked permanently over the week
              would turn a glanceable strip into a dashboard, and the value is
              already the height of the bar. */}
          {dragging !== null && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 0,
                bottom: TRACK + space[1],
                paddingHorizontal: space[2],
                paddingVertical: 2,
                borderRadius: radius.sm,
                backgroundColor: color.surfaceHi,
                // `line-hi`, not `line`. This border is the readout's whole
                // edge against the bars behind it — DESIGN.md forbids shadows,
                // so there is nothing else separating them — and `line` on
                // `surface-hi` measures 1.22:1, which is invisible.
                // `check:contrast` caught it; the same trap the snackbar and
                // the sheet handle both hit.
                borderWidth: 1,
                borderColor: color.lineHi,
              }}
            >
              <Mono style={{ fontSize: size.xs, color: color.ink }}>
                {dragging}
              </Mono>
            </View>
          )}
        </View>
      </GestureDetector>
      )}
    </View>
  );
}

/**
 * Today's bar — the one under the finger.
 *
 * **It grows in every direction while held**, which is not decoration: the bar
 * is ~40pt wide on a phone and the finger covers all of it, so the thing being
 * adjusted is entirely hidden at the moment of adjusting it. Widening past the
 * fingertip puts a visible edge on both sides, and the extra height gives the
 * drag more travel per pixel — it is easier to land a value, not just prettier.
 *
 * Overflow is deliberate: it grows OUTSIDE its slot rather than reflowing the
 * row. Nothing else on the strip moves, which is the same rule the lever grid
 * follows — a control must never resize its neighbours while a finger is down.
 *
 * Height is animated on the UI thread, so the settle after release is smooth
 * even while the parent is re-rendering around the write.
 */
function TodayBar({
  value,
  width,
  held,
  reduceMotion,
}: {
  value: number | null;
  width: number;
  held: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const target = moodBarHeight(value);
  const h = target > 0 ? Math.max(target * TRACK, STUB) : STUB;

  const animated = useAnimatedStyle(() => {
    // The cue survives, only the movement goes: under Reduce Motion the bar
    // still grows — that is the feedback that the drag registered — it simply
    // arrives without the spring.
    const grow = reduceMotion ? (held.value > 0 ? 1 : 0) : held.value;
    return {
      width: width + grow * GROW_X * 2,
      height: h + grow * GROW_Y,
      // Half the added width, so it expands from its own centre rather than
      // drifting right as it widens.
      marginHorizontal: -grow * GROW_X,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height: h,
          borderRadius: radius.sm,
          backgroundColor: value === null ? color.line : color.ink,
        },
        animated,
      ]}
    />
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
