"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logEntry } from "@/app/actions";
import type { PlaybookItem } from "@/lib/system";
import type { Interval } from "@/lib/uptime";

/**
 * Re-entry. This replaces the dashboard entirely when down 3+ days.
 *
 * Design rules, all deliberate:
 *   - No uptime figure. It is at its worst exactly now; showing it is
 *     counterproductive.
 *   - No zero anywhere. The last completed run is reported with its final
 *     length, because a break is an outage, not a wipe.
 *   - One tap logs. The restart is the only thing that has ever actually
 *     failed, so it gets the least friction in the entire app.
 */
export function Takeover({
  down,
  playbook,
  todayLevers,
  lastRun,
  lastDetail,
}: {
  down: number;
  playbook: PlaybookItem[];
  todayLevers: string[];
  lastRun: Interval | null;
  lastDetail: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function restart(item: PlaybookItem) {
    startTransition(async () => {
      await logEntry(item.lever, item.label);
    });
  }

  // Food first: it is the lighter lever, and coming back must be lighter
  // than starting.
  const options = [...playbook].sort((a, b) => {
    if (a.lever !== b.lever) return a.lever === "food" ? -1 : 1;
    return Number(b.is_pinned) - Number(a.is_pinned);
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Top of the screen, not centred: this is the first thing your eye
          should land on when the app opens. */}
      <h1 className="text-down mb-1.5 text-2xl font-medium tracking-tight">
        DOWN {down} DAYS
      </h1>
      <p className="text-ink-mute mb-8 text-sm">Get it back up.</p>

      <div className="flex flex-col gap-2">
        {options.slice(0, 3).map((item) => (
          <button
            key={item.id}
            onClick={() => restart(item)}
            disabled={pending || todayLevers.includes(item.lever)}
            className="border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi rounded border px-4 py-4 text-left text-sm transition-colors disabled:opacity-40"
          >
            {item.label}
            <span className="text-ink-mute ml-2 text-xs">{item.lever}</span>
          </button>
        ))}
      </div>

      {/* The run is reported as a completed thing with a final length. There
          is no counter here that got reset — that is the entire point. */}
      {lastRun && (
        <p className="text-ink-mute mt-8 text-xs">
          last run: <span className="text-ink-dim">{lastRun.days} days</span>
          {lastDetail && (
            <>
              {" · "}
              <span className="text-ink-dim">{lastDetail}</span>
            </>
          )}
        </p>
      )}

      <Link
        href="/history"
        className="text-ink-mute hover:text-ink-dim mt-3 text-xs transition-colors"
      >
        view history ↓
      </Link>
    </main>
  );
}
