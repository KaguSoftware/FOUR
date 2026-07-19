"use client";

import { useTransition } from "react";
import { setSlammed } from "@/app/actions";

/**
 * Busy-season mode.
 *
 * Lowers the bar and moves the alert threshold out — it does not silence the
 * monitor. Crunch is exactly when a pause becomes permanent, so the system
 * idles rather than dying. Auto-expires after 14 days so it can never quietly
 * become the permanent state.
 */
export function SlammedToggle({
  on,
  until,
}: {
  on: boolean;
  until: string | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink text-sm">I&apos;m slammed</p>
          <p className="text-ink-mute mt-1 text-xs leading-relaxed">
            Food lever alone counts. Ten minutes of anything counts. Still
            paged, one day later.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Slammed mode"
          disabled={pending}
          onClick={() => start(async () => void (await setSlammed(!on)))}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 disabled:opacity-50",
            on ? "border-line-hi bg-line-hi" : "border-line bg-surface",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-150",
              on ? "left-6 bg-ink" : "left-0.5 bg-ink-mute",
            ].join(" ")}
          />
        </button>
      </div>

      {on && until && (
        <p className="text-ink-mute mt-3 text-xs">
          expires {until} — re-arm if you still need it then.
        </p>
      )}
    </div>
  );
}
