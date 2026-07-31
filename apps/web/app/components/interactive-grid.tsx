"use client";

import { useState } from "react";
import type { DayDetail } from "@uptime/core";
import { Sheet } from "./sheet";

/**
 * The cells of a grid, ready to draw. Assembled on the server so the client
 * receives only the days it is showing rather than the whole history.
 */
export type GridCell =
  /** A day from a neighbouring month. Drawn as nothing at all. */
  | { kind: "pad" }
  /** A day that has not happened. Not a missed day — see `day-grid.tsx`. */
  | { kind: "future"; date: string }
  | {
      kind: "day";
      date: string;
      /** `null` means no lever fired: a bordered surface, not a darker fill. */
      fill: string | null;
      isToday: boolean;
      detail: DayDetail;
    };

/**
 * A grid of days you can open.
 *
 * One component for both shapes the product uses — the ten-wide trailing block
 * on the dashboard and the seven-wide calendar months in history — because the
 * only real difference is the column count and which cells are padding. Two
 * components would be two places for the tap behaviour to drift.
 *
 * Every cell is a real `<button>`. That is what makes the grid reachable by
 * keyboard and readable by a screen reader, and it is why the `aria-label`
 * still carries the day's state rather than leaving it to colour.
 */
export function InteractiveGrid({
  cells,
  cols,
  label,
}: {
  cells: GridCell[];
  cols: 7 | 10;
  label: string;
}) {
  const [open, setOpen] = useState<DayDetail | null>(null);

  return (
    <>
      <ul
        className={`grid gap-[3px] ${cols === 7 ? "grid-cols-7" : "grid-cols-10"}`}
        aria-label={label}
      >
        {cells.map((cell, i) => {
          if (cell.kind === "pad") {
            return <li key={`pad-${i}`} className="aspect-square" />;
          }

          if (cell.kind === "future") {
            return (
              <li
                key={cell.date}
                // Transparent, not a hollow cell. An empty bordered square here
                // would read as a day already missed.
                className="border-surface aspect-square rounded-[1px] border"
              />
            );
          }

          const { date, fill, isToday, detail } = cell;
          return (
            <li key={date}>
              <button
                type="button"
                onClick={() => setOpen(detail)}
                aria-label={`${date}: ${fill ? "up" : "down"}`}
                style={fill ? { backgroundColor: fill } : undefined}
                className={[
                  "block aspect-square w-full rounded-[1px] transition-colors duration-200",
                  // A down cell is a surface plus a border, never just a darker
                  // fill — the border is what keeps state off colour alone.
                  fill ? "" : "bg-surface border-line border",
                  isToday
                    ? "ring-line-hi ring-1 ring-offset-1 ring-offset-[var(--color-bg)]"
                    : "",
                ].join(" ")}
              />
            </li>
          );
        })}
      </ul>

      {open && <DayPanel detail={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * What a day held.
 *
 * The register matters more here than anywhere else in the product. A grid cell
 * that says nothing can be read past; a panel that opens and announces you did
 * nothing cannot. So an empty day states the fact and stops — no second person,
 * no encouragement, no "yet". The grid already makes the only judgement this
 * product makes about a day, and it does not repeat it in words.
 */
function DayPanel({
  detail,
  onClose,
}: {
  detail: DayDetail;
  onClose: () => void;
}) {
  const { date, levers, signals, empty, future } = detail;
  const notes = signals.filter((s) => s.detail);
  const scalars = signals.filter((s) => s.value !== null);

  return (
    <Sheet label={longDate(date)} onClose={onClose}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="label">{longDate(date)}</p>
        <button
          onClick={onClose}
          className="text-ink-mute hover:text-ink-dim -mr-1 min-h-11 px-1 text-xs transition-colors"
        >
          close
        </button>
      </div>

      {future ? (
        <p className="text-ink-mute text-sm">Hasn&rsquo;t happened yet.</p>
      ) : empty && signals.length === 0 ? (
        <p className="text-ink-mute text-sm">No entry for this day.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {levers.length > 0 && (
            <ul className="flex flex-col gap-2">
              {levers.map((l) => (
                <li
                  key={l.key}
                  className="border-line bg-surface-hi rounded border px-3 py-2"
                >
                  <span className="text-ink text-sm">{l.label}</span>
                  {l.detail && (
                    <span className="text-ink-dim mt-1 block text-sm whitespace-pre-line">
                      {l.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {scalars.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {scalars.map((s) => (
                <li key={s.kind}>
                  <span className="tabular text-ink text-sm">{s.value}</span>
                  <span className="text-ink-mute ml-1 text-xs">{s.kind}</span>
                </li>
              ))}
            </ul>
          )}

          {notes.map((s) => (
            <p
              key={`${s.kind}-note`}
              className="text-ink-dim text-sm whitespace-pre-line"
            >
              {s.detail}
            </p>
          ))}

          {/* A day with signals but no lever is a real state: you wrote
              something down without firing anything. Saying so is more use
              than an empty panel. */}
          {levers.length === 0 && (
            <p className="text-ink-mute text-xs">No lever logged.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/** "jul 29, 2026" — parsed as text, never through `Date`, which would shift it. */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}
