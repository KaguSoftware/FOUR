import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Slider from "@react-native-community/slider";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import {
  facePath,
  MOOD_MAX,
  MOOD_MIN,
  MOOD_NEUTRAL,
  moodLabel,
} from "@uptime/core";

import { Button } from "./button";
import { Label } from "./ui";
import { committed } from "@/lib/haptics";
import { color, space, TAP } from "@/theme";

/**
 * How was today — one slider, frowny to smiley.
 *
 * Replaces the two 1–5 scales that lived on `/proof`. Those were on a screen
 * you had to navigate to, which meant they were answered by whoever was
 * already curious enough to go there. This sits under the levers on Home, on
 * the screen that gets opened anyway.
 *
 * **It cannot affect uptime.** A day is up because a lever fired. This is a
 * note about that day, never a judgement of it, and skipping it costs nothing.
 *
 * The face comes from `facePath` in core, so the web draws the identical one.
 *
 * **The write is behind an explicit Save (2026-08-04).** Releasing the thumb
 * used to write immediately, which meant a drag taken to look at the faces was
 * indistinguishable from an answer, and there was no way to change your mind
 * without setting some other value.
 *
 * **The layout is fixed, and that is the point.** Two earlier cuts of this got
 * it wrong on device: one put Save inside the slider's row, so the track
 * changed width the instant the button appeared and the thing being dragged
 * resized under the finger; another stacked a label, a two-line note, a 56pt
 * face, two axis faces and a button, which pushed Home past a screen height.
 *
 * So: **nothing is ever added to or removed from the slider's row**, and Save
 * is always rendered, merely `disabled` until there is something to save. That
 * is also the convention every other commit in this app already follows —
 * `change-password.tsx`, `change-email.tsx`, `add-lever.tsx` — and the same
 * reasoning that makes `lever-buttons.tsx` a fixed grid rather than a flexed
 * one: a control must never resize while a finger is on it.
 *
 * An earlier version of this docblock argued the button had to be HIDDEN until
 * dirty, on the grounds that a permanent one "turns a question you may ignore
 * into one you have visibly declined to answer". Overruled by the owner on
 * 2026-08-04, and rightly: a disabled control reads as inert, not as an
 * accusation, and being the app's only commit control that behaved differently
 * was the larger cost.
 */

/** The face at the head of the row. `TAP`, so it is a row and not a picture. */
const FACE = TAP;
/** Both the head's outline and the mouth, in the 0..1 box. */
const STROKE = 0.055;

export function MoodSlider({
  value,
  onCommit,
  busy = false,
}: {
  /** Today's stored reading, or null if it has not been set. */
  value: number | null;
  /** Fired by the Save button, never by the drag itself. */
  onCommit: (value: number) => void;
  /** While the write is in flight, so the button can say so and not re-fire. */
  busy?: boolean;
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
  /**
   * Whether there is anything to save — the button's `disabled` state, not its
   * existence. It is always on screen; see the docblock.
   *
   * `value` is the last thing the SERVER confirmed, so this stays true when a
   * save fails and the button stays live to be pressed again.
   */
  const unsaved = live !== null && live !== value;
  // An unset slider still has to sit somewhere. It rests at the middle and
  // draws itself quiet, so its position reads as "nothing said yet" rather
  // than as a flat 50 someone chose.
  const position = live ?? MOOD_NEUTRAL;

  return (
    <View>
      {/* The label stays; the two-line reassurance that used to sit under it
          does not. "Skipping costs nothing. This never affects uptime." was
          ~40pt of the height that pushed Home off the screen, and the control
          demonstrates the claim better than the sentence asserted it — nothing
          here is required, and nothing happens if it is left alone. */}
      <Label style={{ marginBottom: space[3] }}>how was today</Label>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}
      >
        <Face value={position} muted={!set} />

        <View style={{ flex: 1 }}>
          <Slider
            // Negative margins on purpose: the native control reserves padding
            // around its own thumb, which reads as the track being inset from a
            // row it is supposed to fill.
            style={{ marginHorizontal: -space[2] }}
            minimumValue={MOOD_MIN}
            maximumValue={MOOD_MAX}
            // Whole numbers, because that is what the column stores. Left
            // continuous, the platform hands back 63.42711 and the write is
            // rejected by the int column with no visible cause.
            step={1}
            value={position}
            onValueChange={setDragging}
            // Releasing the thumb does not write. It parks the value and arms
            // Save — the drag says where the face goes, the button says to keep
            // it. `lastSeen` is deliberately NOT advanced here: it tracks what
            // the server last handed us, and moving it on a local drag would
            // make the next refresh look like no change and silently discard a
            // fetched value.
            onSlidingComplete={(next) => {
              const rounded = Math.round(next);
              setDragging(null);
              setShown(rounded);
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

      {/* Save: full width, below, and ALWAYS rendered.

          Not conditional and not in the row above — both were tried and both
          were wrong on device. See the docblock. `disabled` is the only thing
          that changes, so the slider's track can never resize under a finger
          and the page height is the same whether or not there is an answer
          waiting.

          No entering/exiting animation, deliberately: with nothing appearing
          there is nothing to animate, and `Button` already steps its own
          opacity when disabled. */}
      <View style={{ marginTop: space[4] }}>
        <Button
          title="save"
          disabled={!unsaved}
          busy={busy}
          onPress={() => {
            if (live === null) return;
            // One crisp confirmation that the tap registered — the same haptic
            // a logged lever gets, because this is the same kind of event.
            // Never `impactAsync` on Android; see lib/haptics.
            committed();
            onCommit(live);
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
function Face({
  value,
  muted,
  size = FACE,
}: {
  value: number;
  muted: boolean;
  size?: number;
}) {
  const face = facePath(value);
  const stroke = muted ? color.inkMute : color.ink;

  return (
    <Svg width={size} height={size} viewBox="0 0 1 1" accessible={false}>
      {/* The head. A rounded square, because every other cell this app draws —
          the day grid, the pixel wall — is one, and a circle here would be the
          only round thing in the interface. Stroked, not filled: a filled head
          would be a solid block competing with the levers above it. */}
      <Rect
        x={face.head.x}
        y={face.head.y}
        width={face.head.size}
        height={face.head.size}
        rx={face.head.radius}
        ry={face.head.radius}
        stroke={stroke}
        strokeWidth={STROKE}
        fill="none"
      />
      {face.eyes.map((eye, i) => (
        <Circle key={i} cx={eye.cx} cy={eye.cy} r={eye.r} fill={stroke} />
      ))}
      <Path
        d={face.mouth}
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
