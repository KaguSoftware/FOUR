"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { logSignals } from "@/app/actions";
import { NOTE_MAX } from "@uptime/core";

/**
 * The daily check. Three taps, ~10 seconds, fully skippable.
 *
 * Daily rather than weekly because a week is too coarse to see a fade in: by
 * the time a weekly sample moves, the run is already going. Denser samples make
 * the plateau check read a real trend instead of four scattered points.
 *
 * The obligation risk is real, and the answer is that skipping stays free and
 * says so. Nothing here may ever affect uptime — a skipped check costs nothing,
 * and the copy states that rather than implying it.
 */
export function SignalCheck({
  weight: weightOpt,
  initialDetail = "",
  loggedToday = false,
}: {
  /** Omitted when the opt-in is off, which is the default. */
  weight?: { unit: "kg" | "lb" };
  /** Today's note, loaded back so writing again edits rather than replaces. */
  initialDetail?: string;
  loggedToday?: boolean;
} = {}) {
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [detail, setDetail] = useState(initialDetail);
  const [weight, setWeight] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Grow the note box to fit what is in it.
   *
   * Setting height to `auto` first is what lets it SHRINK again after a
   * deletion; without that it only ever ratchets upward. Modern browsers do
   * this with `field-sizing: content` and this becomes a no-op for them.
   */
  function grow() {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Also on mount, or today's loaded entry opens collapsed to three rows and
  // looks truncated — the box has to fit what is already in it before anyone
  // types a character.
  useEffect(grow, []);

  if (done) {
    return (
      <p className="text-ink-mute text-xs">
        Saved. <span className="text-ink-dim">Reload to keep writing.</span>
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const w = weightOpt && weight.trim() ? Number(weight) : null;
          await logSignals({
            energy,
            sleep,
            detail,
            weight: Number.isFinite(w) ? w : null,
          });
          setDone(true);
        });
      }}
    >
      <p className="label mb-1">{loggedToday ? "Today" : "Daily check"}</p>
      <p className="text-ink-dim mb-4 text-xs">
        Skipping costs nothing. This never affects uptime.
      </p>

      <Scale label="energy" value={energy} onChange={setEnergy} />
      <Scale label="sleep" value={sleep} onChange={setSleep} />

      {weightOpt && (
        <div className="mt-4">
          <label className="label mb-2 block" htmlFor="weight">
            weight ({weightOpt.unit})
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            max="999"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="—"
            // No goal, no target, no comparison to a previous value. The field
            // takes a number and says nothing about it.
            className="tabular bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-12 w-full rounded border px-3 text-sm outline-none transition-colors"
          />
        </div>
      )}

      {/* Was a one-line "anything moving?" input capped at 160 characters. It
          turned out people use it as a journal, so it is one — the field grows
          with what you write and there is room to say something. The prompt is
          open rather than asking for progress, because a day worth writing
          about is not always a day something improved. */}
      <label className="label mt-4 mb-2 block" htmlFor="note">
        what&apos;s up?
      </label>
      <textarea
        id="note"
        ref={noteRef}
        aria-label="What's up?"
        value={detail}
        rows={3}
        maxLength={NOTE_MAX}
        onChange={(e) => {
          setDetail(e.target.value);
          grow();
        }}
        placeholder="Whatever you want to remember about today."
        // Grows to fit, then scrolls rather than pushing the button off screen.
        // `field-sizing: content` does this natively in browsers that have it;
        // the ref below covers the rest.
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute field-sizing-content max-h-[50vh] min-h-24 w-full resize-y rounded border px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors"
      />
      {/* Only appears near the ceiling — a counter on an empty box reads as a
          limit on what you are allowed to say. */}
      {detail.length > NOTE_MAX - 400 && (
        <p className="text-ink-mute mt-1 text-right text-xs">
          {NOTE_MAX - detail.length} left
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending || (!energy && !sleep && !detail.trim() && !weight.trim())}
          className="border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi min-h-11 rounded border px-5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "…" : loggedToday ? "save" : "log"}
        </button>
        <button
          type="button"
          onClick={() => setDone(true)}
          className="text-ink-mute hover:text-ink-dim active:text-ink min-h-11 rounded px-3 text-xs transition-colors"
        >
          {loggedToday ? "leave it" : "skip today"}
        </button>
      </div>
    </form>
  );
}

function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <fieldset className="mb-3">
      <legend className="label mb-1.5">{label}</legend>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(n)}
            className={[
              "tabular min-h-12 flex-1 rounded border text-sm transition-colors",
              value === n
                ? "border-line-hi bg-line text-ink"
                : "border-line bg-surface text-ink-mute hover:bg-surface-hi",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
