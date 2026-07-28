"use client";

import { useState, useTransition } from "react";
import { logSignals } from "@/app/actions";

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
export function SignalCheck() {
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return <p className="text-ink-mute text-xs">Logged.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await logSignals({ energy, sleep, detail });
          setDone(true);
        });
      }}
    >
      <p className="label mb-1">Daily check — 3 taps</p>
      <p className="text-ink-dim mb-4 text-xs">
        Skipping costs nothing. This never affects uptime.
      </p>

      <Scale label="energy" value={energy} onChange={setEnergy} />
      <Scale label="sleep" value={sleep} onChange={setSleep} />

      <label className="label mt-4 mb-2 block" htmlFor="moving">
        anything moving?
      </label>
      <input
        id="moving"
        aria-label="Anything moving?"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="incline 8 → 10"
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-12 w-full rounded border px-3 text-sm outline-none transition-colors"
      />

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending || (!energy && !sleep && !detail.trim())}
          className="border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi min-h-11 rounded border px-5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "…" : "log"}
        </button>
        <button
          type="button"
          onClick={() => setDone(true)}
          className="text-ink-mute hover:text-ink-dim active:text-ink min-h-11 rounded px-3 text-xs transition-colors"
        >
          skip today
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
