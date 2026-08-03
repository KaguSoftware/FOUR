"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  facePath,
  MOOD_MAX,
  MOOD_MIN,
  MOOD_NEUTRAL,
  moodLabel,
} from "@uptime/core";
import { saveMood } from "@/app/actions";

/**
 * How was today — one slider, frowny to smiley.
 *
 * Replaces the two 1–5 scales that lived on `/proof`. Those were on a screen
 * you had to navigate to, which meant they were answered by whoever was
 * already curious enough to go there. This sits under the levers on the
 * dashboard, the screen that gets opened anyway.
 *
 * **It cannot affect uptime, and the copy says so.** A day is up because a
 * lever fired. This is a note about that day, never a judgement of it, and
 * skipping it costs nothing — which is only true if the control never behaves
 * as though it is owed an answer.
 *
 * The face is `facePath` from core, so this and the phone draw the identical
 * one. Same doctrine as the day-grid ramp: the shape is computed once.
 */
export function MoodSlider({ initial }: { initial: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();

  /**
   * Adopt a new server value only when it actually CHANGES, so a re-render
   * cannot discard a position the user set and has not released yet.
   */
  const lastSeen = useRef(initial);
  useEffect(() => {
    if (lastSeen.current !== initial) setValue(initial);
    lastSeen.current = initial;
  }, [initial]);

  const set = value !== null;
  // An unset slider still has to sit somewhere. It rests at the middle and
  // draws itself quiet, so its position reads as "nothing said yet" rather
  // than as a flat 50 someone chose.
  const position = value ?? MOOD_NEUTRAL;

  function commit(next: number) {
    setFailed(false);
    lastSeen.current = next;
    start(async () => {
      const res = await saveMood(next);
      // Reported, not swallowed. Six paths in this app used to claim success
      // unconditionally and this is not becoming the seventh.
      if (!res.ok) setFailed(true);
    });
  }

  return (
    <div>
      <p className="label mb-1">how was today</p>
      <p className="text-ink-dim mb-4 text-xs">
        Skipping costs nothing. This never affects uptime.
      </p>

      <div className="flex flex-col items-center">
        <Face value={position} muted={!set} />

        <input
          type="range"
          min={MOOD_MIN}
          max={MOOD_MAX}
          // Whole numbers, because that is what the column stores.
          step={1}
          value={position}
          // `input` tracks the drag so the face moves with it; `change` is the
          // release, and the only thing that writes. One upsert per answer, not
          // one per frame.
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={() => commit(position)}
          onKeyUp={() => commit(position)}
          className="mood-range mt-2 w-full"
          aria-label="How was today"
          aria-valuetext={moodLabel(set ? position : null)}
        />
      </div>

      {failed && (
        <p className="text-degraded mt-2 text-xs">
          Didn&apos;t save. Move it again when you have a connection.
        </p>
      )}
    </div>
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
  const stroke = muted ? "var(--color-ink-mute)" : "var(--color-ink)";

  return (
    <svg width={56} height={56} viewBox="0 0 1 1" aria-hidden="true">
      {face.eyes.map((eye, i) => (
        <circle key={i} cx={eye.cx} cy={eye.cy} r={eye.r} fill={stroke} />
      ))}
      <path
        d={face.mouth}
        stroke={stroke}
        strokeWidth={0.055}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
