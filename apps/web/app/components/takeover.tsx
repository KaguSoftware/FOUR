"use client";

import { NavLink } from "./nav-link";
import { useState, useTransition } from "react";
import { logEntry } from "@/app/actions";
import type { LeverRow, PlaybookItem } from "@/lib/system";
import { type Interval } from "@uptime/core";

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
 *   - **There is always a way out of this screen.** The playbook can be empty —
 *     it is empty for every new account now that signup seeds nothing — so
 *     "just mark it up" is not a nicety here, it is the floor. A takeover with
 *     no reachable action would be the worst dead end this product could have.
 */
export function Takeover({
  down,
  levers,
  playbook,
  todayLevers,
  lastRun,
  lastDetail,
}: {
  down: number;
  levers: LeverRow[];
  playbook: PlaybookItem[];
  todayLevers: string[];
  lastRun: Interval | null;
  lastDetail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  // This used to put the food lever first, on the principle that coming back
  // must be lighter than starting. That cannot survive user-defined levers — we
  // have no idea which of someone's levers is the light one, and guessing would
  // put the hardest thing at the top of the re-entry screen.
  //
  // The honest proxy is what has actually worked most often for this person,
  // which is use_count — already the order the query returns. So the lever tier
  // is simply gone rather than replaced with a guess, and only the pin remains.
  const options = [...playbook]
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
    .slice(0, 3);

  // With nothing in the playbook the levers ARE the screen, so they are not
  // hidden behind a disclosure. With one lever there is nothing to choose.
  const [expanded, setExpanded] = useState(false);
  const showLevers = options.length === 0 || levers.length === 1 || expanded;

  const byKey = new Map(levers.map((l) => [l.key, l.label]));

  function log(id: string, lever: string, detail: string | null) {
    if (chosen !== null) return; // one tap; the second is always an accident
    setChosen(id);
    startTransition(async () => {
      await logEntry(lever, detail);
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(4rem,calc(env(safe-area-inset-top)+3rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Top of the screen, not centred: this is the first thing your eye
          should land on when the app opens. */}
      <h1 className="text-down mb-1.5 text-2xl font-medium tracking-tight">
        DOWN {down} DAYS
      </h1>
      <p className="label mt-8 mb-2">Minimum to get back up</p>

      <div className="flex flex-col gap-2">
        {options.map((item) => (
          <button
            key={item.id}
            onClick={() => log(item.id, item.lever, item.label)}
            disabled={chosen !== null || todayLevers.includes(item.lever)}
            className={[
              "min-h-16 rounded border px-4 text-left text-sm transition-colors",
              chosen === item.id
                ? "border-line-hi bg-line text-ink"
                : "border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi disabled:opacity-40",
            ].join(" ")}
          >
            {item.label}
            <span className="text-ink-mute ml-2 text-xs">
              {chosen === item.id && pending
                ? "logging…"
                : /* The label, never the stored key — a key is a slug like
                     `morning-pages` and nobody chose to read that. */
                  (byKey.get(item.lever) ?? item.lever)}
            </span>
          </button>
        ))}
      </div>

      {/* The floor. Logging with no detail attached still puts the day up —
          the detail was always the optional half. */}
      {showLevers ? (
        <div className={options.length > 0 ? "mt-3" : "mt-2"}>
          {options.length > 0 && <p className="label mb-2">or just mark it up</p>}
          <div className="grid grid-cols-2 gap-2">
            {levers.map((lever, i) => (
              <button
                key={lever.key}
                onClick={() => log(`lever:${lever.key}`, lever.key, null)}
                disabled={chosen !== null || todayLevers.includes(lever.key)}
                className={[
                  "min-h-14 rounded border px-4 text-sm transition-colors",
                  levers.length === 1 || (levers.length === 3 && i === 2)
                    ? "col-span-2"
                    : "",
                  // Secondary to the playbook options above, and the hierarchy
                  // is carried by fill and text weight — NOT by a fainter
                  // border. These have no fill, so the stroke is the entire
                  // button and owes WCAG 1.4.11's 3:1. `line` measures 1.45:1
                  // against the page; `line-hi` measures 3.33:1.
                  chosen === `lever:${lever.key}`
                    ? "border-line-hi bg-line text-ink"
                    : "border-line-hi text-ink-dim hover:bg-surface-hi active:bg-line disabled:opacity-40",
                ].join(" ")}
              >
                {chosen === `lever:${lever.key}` && pending
                  ? "logging…"
                  : lever.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          disabled={chosen !== null}
          className="text-ink-mute hover:text-ink-dim active:text-ink mt-3 min-h-11 w-full text-xs transition-colors disabled:opacity-40"
        >
          just mark it up
        </button>
      )}

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

      <NavLink href="/history" className="mt-1">
        view history ↓
      </NavLink>
    </main>
  );
}
