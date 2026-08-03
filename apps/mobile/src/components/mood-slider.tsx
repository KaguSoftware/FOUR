import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Slider from "@react-native-community/slider";
import Svg, { Circle, Path } from "react-native-svg";
import {
  facePath,
  MOOD_MAX,
  MOOD_MIN,
  MOOD_NEUTRAL,
  moodLabel,
} from "@uptime/core";

import { Body, Label } from "./ui";
import { color, space } from "@/theme";

/**
 * How was today — one slider, frowny to smiley.
 *
 * Replaces the two 1–5 scales that lived on `/proof`. Those were on a screen
 * you had to navigate to, which meant they were answered by whoever was
 * already curious enough to go there. This sits under the levers on Home, on
 * the screen that gets opened anyway.
 *
 * **It cannot affect uptime, and the copy says so.** A day is up because a
 * lever fired. This is a note about that day, never a judgement of it, and
 * skipping it costs nothing — which is only true if the control never behaves
 * as though it is owed an answer.
 *
 * The face comes from `facePath` in core, so the web draws the identical one.
 */
const FACE = 56;

export function MoodSlider({
  value,
  onCommit,
}: {
  /** Today's stored reading, or null if it has not been set. */
  value: number | null;
  /** Fired on release, never mid-drag. */
  onCommit: (value: number) => void;
}) {
  /**
   * The position under the finger. Separate from `value` because the face has
   * to track the drag, while the WRITE happens once on release — a write per
   * frame would be a hundred upserts for one answer.
   */
  const [dragging, setDragging] = useState<number | null>(null);

  /**
   * Adopt a new stored value only when it actually CHANGES.
   *
   * Home refetches on focus, so syncing on every render would throw away a
   * position the user had set and not yet released. This is the same guard the
   * old `Scale` needed, and for the same reason — the failure mode there was
   * tabbing away and back and finding your answer gone.
   */
  const [shown, setShown] = useState<number | null>(value);
  const lastSeen = useRef(value);
  useEffect(() => {
    if (lastSeen.current !== value) setShown(value);
    lastSeen.current = value;
  }, [value]);

  const live = dragging ?? shown;
  const set = live !== null;
  // An unset slider still has to sit somewhere. It rests at the middle and
  // draws itself quiet, so its position reads as "nothing said yet" rather
  // than as a flat 50 someone chose.
  const position = live ?? MOOD_NEUTRAL;

  return (
    <View>
      <Label style={{ marginBottom: space[1] }}>how was today</Label>
      <Body tone="dim" style={{ marginBottom: space[4] }}>
        Skipping costs nothing. This never affects uptime.
      </Body>

      <View style={{ alignItems: "center" }}>
        <Face value={position} muted={!set} />

        <Slider
          style={{ width: "100%", marginTop: space[2] }}
          minimumValue={MOOD_MIN}
          maximumValue={MOOD_MAX}
          // Whole numbers, because that is what the column stores. Left
          // continuous, the platform hands back 63.42711 and the write is
          // rejected by the int column with no visible cause.
          step={1}
          value={position}
          onValueChange={setDragging}
          onSlidingComplete={(next) => {
            const rounded = Math.round(next);
            setDragging(null);
            setShown(rounded);
            lastSeen.current = rounded;
            onCommit(rounded);
          }}
          minimumTrackTintColor={set ? color.inkDim : color.line}
          maximumTrackTintColor={color.line}
          thumbTintColor={set ? color.ink : color.lineHi}
          accessibilityLabel="How was today"
          // The announcement is a word, not a number out of a hundred —
          // "sixty-three" is not an answer to "how was today".
          accessibilityValue={{
            min: MOOD_MIN,
            max: MOOD_MAX,
            now: position,
            text: moodLabel(set ? position : null),
          }}
        />
      </View>
    </View>
  );
}

/**
 * The face.
 *
 * Deliberately not a caricature — no tears at the bottom, no grin at the top,
 * no colour. `DESIGN.md` forbids the triumphant register, and a face that
 * celebrates a good day is implicitly scolding you on a bad one, on the one
 * control in the app whose whole point is that answering it honestly is free.
 * Only the mouth moves.
 */
function Face({ value, muted }: { value: number; muted: boolean }) {
  const face = facePath(value);
  const stroke = muted ? color.inkMute : color.ink;

  return (
    <Svg width={FACE} height={FACE} viewBox="0 0 1 1" accessible={false}>
      {face.eyes.map((eye, i) => (
        <Circle key={i} cx={eye.cx} cy={eye.cy} r={eye.r} fill={stroke} />
      ))}
      <Path
        d={face.mouth}
        stroke={stroke}
        strokeWidth={0.055}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
