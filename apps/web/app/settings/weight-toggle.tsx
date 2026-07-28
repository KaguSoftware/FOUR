"use client";

import { useTransition } from "react";
import { setWeightEnabled } from "@/app/actions";

/**
 * The weight opt-in.
 *
 * Off by default, and narrow on purpose. When on, a weight is recorded and
 * plotted and that is the entire feature: no goal, no target, no "X above",
 * no BMI, no reading of the trend. A number the user chose to keep, never a
 * score the product keeps on them.
 *
 * It is stored in `signals`, not `entries`, so it is structurally incapable of
 * moving uptime — the separation is the guarantee, not a convention.
 */
export function WeightToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-ink text-sm">Track weight</p>
          <p className="text-ink-mute mt-1 text-xs leading-relaxed">
            Adds a weight field to the daily check and a line on proof. No goal,
            no target — recorded and plotted, nothing else. Never affects
            uptime.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Track weight"
          disabled={pending}
          onClick={() => start(async () => void (await setWeightEnabled(!on)))}
          className="group flex min-h-11 shrink-0 items-center px-1 disabled:opacity-50"
        >
          <span
            className={[
              "relative block h-7 w-12 rounded-full border transition-colors duration-150",
              on ? "border-line-hi bg-line-hi" : "border-line bg-surface",
              pending ? "animate-pulse" : "",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-5 w-5 rounded-full transition-all duration-150",
                on ? "left-6 bg-ink" : "left-0.5 bg-ink-mute",
              ].join(" ")}
            />
          </span>
        </button>
      </div>

      {!on && (
        <p className="text-ink-mute mt-3 text-xs">
          Turning this off later hides it without deleting anything.
        </p>
      )}
    </div>
  );
}
