import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import {
  moodBarHeight,
  moodLabel,
  MOOD_MAX,
  MOOD_MIN,
  MOOD_NEUTRAL,
  type MoodDay,
} from "@four/core";

import { field, fieldTint } from "./fields";
import { Body, Label, Mono } from "./ui";
import { committed, nudged } from "@/lib/haptics";
import { ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * How was today — a fortnight of readings, and the control that sets today.
 *
 * **The reading used to be write-only**, and that was the real defect behind
 * two failed rebuilds: nothing in the app ever showed mood back except the day
 * sheet, one day at a time behind a grid tap, as the literal string `63 mood`.
 * You fed it daily and never saw it again.
 *
 * So this is two halves with one job each, and keeping them separate is the
 * whole design:
 *
 * - **The chart reports.** Fourteen bars, read-only. It exists so an answer
 *   visibly joins a record, and so the flat stretch `evaluatePlateau` pages
 *   about four weeks late is something you can see coming.
 * - **The slider sets.** The platform's own control, below the chart, with the
 *   value beside it. Nothing to aim at, nothing that resizes under a finger.
 *
 * An earlier cut made the chart itself draggable — today's bar grew under the
 * finger and carried a floating readout. It worked, but it made one element
 * both the input and the output, which is why the bar had to grow at all: a
 * fingertip covers a ~40pt bar completely. Splitting them removes the problem
 * rather than animating around it.
 *
 * **Fourteen days, not seven.** `evaluatePlateau` needs four consecutive
 * sampled weeks to fire, so a week of context cannot show a trend forming — it
 * shows the current week and nothing to compare it against. A fortnight is two
 * weeks side by side, which is the shortest window where "this week is flatter
 * than last" is visible at all. The bars get narrower; they are no longer drag
 * targets, so that costs nothing.
 *
 * **No face and no Save button.** The face was a caricature of a rating the
 * slider already showed. Save existed because a drag taken to browse the faces
 * was indistinguishable from an answer — there are no faces now, and releasing
 * the slider writes, which is what web has always done.
 *
 * **It still cannot affect uptime.** A day is up because a lever fired. This is
 * a note about the day, never a judgement of it, and skipping it costs nothing.
 */

/** Matches the day grid's gap, so the chart reads as its sibling. */
const GAP = 3;

/**
 * How many days the chart draws — exported so the screen feeding it cannot ask
 * for a different number than this component renders bars for.
 *
 * Fourteen because `evaluatePlateau` needs four consecutive sampled weeks to
 * fire: one week of context shows the current week with nothing to compare it
 * against, and a fortnight is the shortest window in which "this week is
 * flatter than last" is visible at all.
 */
export const MOOD_DAYS = 14;
const DAYS = MOOD_DAYS;
/** The chart's height. Read-only, so it can be shorter than a drag target. */
const TRACK = 36;
/** A day nobody answered. Visible, but obviously not a reading. */
const STUB = 3;

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
   * NOT `flex: 1`. Fourteen bars and thirteen gaps divide a phone into a
   * fractional width, and letting each bar round its own is exactly what made
   * the day grid's rows drift apart — see `DayGrid`. One integer, all bars.
   */
  const [width, setWidth] = useState(0);
  const barW = width > 0 ? Math.floor((width - GAP * (DAYS - 1)) / DAYS) : 0;

  const today = week[week.length - 1] ?? { date: "", value: null };

  /**
   * The position under the finger. Separate from the stored value because the
   * chart has to track the drag, while the WRITE happens once on release — a
   * write per frame would be a hundred upserts for one answer.
   */
  const [dragging, setDragging] = useState<number | null>(null);

  /**
   * Adopt a new stored value only when it actually CHANGES.
   *
   * Home refetches on focus, so syncing every render would throw away a
   * position set and not yet released. Same guard the old slider needed, and
   * for the same reason.
   */
  const [shown, setShown] = useState<number | null>(today.value);
  const lastSeen = useRef(today.value);
  useEffect(() => {
    if (lastSeen.current !== today.value) setShown(today.value);
    lastSeen.current = today.value;
  }, [today.value]);

  /** The Android typing path: a string while open, null otherwise. */
  const [typing, setTyping] = useState<string | null>(null);

  const live = dragging ?? shown;
  const set = live !== null;
  const position = live ?? MOOD_NEUTRAL;
  const answered = week.filter((d) => d.value !== null).length;

  /** Which of `moodLabel`'s five bands the finger is in. Gates the haptic. */
  const lastBand = useRef(-1);

  /**
   * Ask for a number, and write it if it is one.
   *
   * `Alert.prompt` is **iOS-only** — the same constraint the activity rename
   * hit — so Android opens the inline field instead. Both land in `commitTyped`.
   */
  function askForNumber() {
    if (Platform.OS !== "ios") {
      setTyping(live === null ? "" : String(live));
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

  /** Shared by both entry paths. Out of range is clamped, not refused. */
  function commitTyped(text: string) {
    const n = Number(text.trim());
    // Not a number, or empty: a cancel, not a write. Silently — typing nothing
    // is how someone says they changed their mind.
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(Math.round(n), MOOD_MIN), MOOD_MAX);
    setShown(clamped);
    committed();
    onCommit(clamped);
  }

  return (
    <View>
      {/* The label and the fortnight's count share a row. */}
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

      {/* The chart. Read-only: it reports, the slider below sets. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Last ${DAYS} days. ${answered} answered.`}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.width;
          // Only on a real change: onLayout fires on every re-render on Android.
          setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
        }}
        style={{
          height: TRACK,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: GAP,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {barW > 0 &&
          week.map((day, i) => {
            const isToday = i === week.length - 1;
            // Today follows the finger; every other bar is what was stored.
            const value = isToday ? live : day.value;
            const h = moodBarHeight(value);

            return (
              <View
                key={day.date}
                style={{
                  width: barW,
                  // A day nobody answered is a STUB at the floor, not a bar at
                  // zero — it must never read as "that day was rough".
                  // `moodBarHeight` returns 0 for null and never less than its
                  // floor for a real reading, so the two cannot collide.
                  height: h > 0 ? Math.max(h * TRACK, STUB) : STUB,
                  borderRadius: radius.sm,
                  backgroundColor:
                    h === 0 ? color.line : isToday ? color.ink : color.lineHi,
                }}
              />
            );
          })}
      </View>

      {typing !== null ? (
        /* Android's typing path. It REPLACES the slider row rather than sitting
           under it, so the section's height does not change with the keyboard
           up. iOS never renders this; it gets `Alert.prompt`. */
        <View
          style={{
            flexDirection: "row",
            gap: space[2],
            marginTop: space[3],
            height: TAP,
          }}
        >
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            marginTop: space[2],
          }}
        >
          <Slider
            // Negative margins: the native control reserves padding around its
            // own thumb, which reads as the track being inset from the chart
            // above it. These line the two up.
            style={{ flex: 1, marginHorizontal: -space[2] }}
            minimumValue={MOOD_MIN}
            maximumValue={MOOD_MAX}
            // Whole numbers, because that is what the column stores. Left
            // continuous the platform hands back 63.42711 and the int column
            // rejects the write with no visible cause.
            step={1}
            value={position}
            onValueChange={(next) => {
              const v = Math.round(next);
              setDragging(v);
              // Per BAND, not per point: a full drag crosses ~99 values and a
              // tick on each is a buzz that says nothing. The bands are the
              // five words `moodLabel` already divides the range into. Never
              // `impactAsync` on Android — see lib/haptics.
              const band = Math.min(
                Math.floor(((v - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * 5),
                4,
              );
              if (band !== lastBand.current) {
                lastBand.current = band;
                nudged();
              }
            }}
            // Releasing writes. No Save button: the chart above already shows
            // where the value landed, so there is nothing left to confirm.
            onSlidingComplete={(next) => {
              const rounded = Math.round(next);
              setDragging(null);
              setShown(rounded);
              lastSeen.current = rounded;
              committed();
              onCommit(rounded);
            }}
            minimumTrackTintColor={set ? color.inkDim : color.line}
            maximumTrackTintColor={color.line}
            thumbTintColor={set ? color.ink : color.lineHi}
            accessibilityLabel="How was today"
            // A word, not a number out of a hundred — "sixty-three" is not an
            // answer to "how was today".
            accessibilityValue={{
              min: MOOD_MIN,
              max: MOOD_MAX,
              now: position,
              text: moodLabel(set ? position : null),
            }}
          />

          {/* The value, and the way to type one.
              A single tap, not a double: this is its own 44pt button sitting
              beside the slider rather than a hidden gesture on the chart, so
              there is nothing for a double tap to disambiguate it from. It is
              also the only remaining way to be exact, now that the chart is
              read-only.
              `minWidth` so the row does not shift as the digits change —
              `Mono` is tabular, but "7" and "100" are still different widths. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Value ${set ? position : "not set"}. Tap to type a number.`}
            onPress={askForNumber}
            android_ripple={ripple()}
            style={{
              minWidth: 44,
              minHeight: TAP,
              alignItems: "flex-end",
              justifyContent: "center",
              borderRadius: radius.md,
            }}
          >
            <Mono
              style={{
                fontSize: size.sm,
                color: set ? color.ink : color.inkMute,
              }}
            >
              {set ? position : "—"}
            </Mono>
          </Pressable>
        </View>
      )}
    </View>
  );
}
