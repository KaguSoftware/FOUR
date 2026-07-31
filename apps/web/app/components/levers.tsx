"use client";

import { useOptimistic, useState, useTransition } from "react";
import { logEntry, undoEntry } from "@/app/actions";
import { Sheet } from "./sheet";
import type { LeverRow, PlaybookItem } from "@/lib/system";
import type { Lever } from "@uptime/core";

/**
 * The whole logging path: tap a lever, tap a chip. Two taps, no typing.
 *
 * Optimistic state means the grid fills the instant you tap, even on bad
 * signal in a gym basement — every second of friction is a reason to drop it.
 * Where an action can't be optimistic, it says it is working rather than
 * looking dead.
 */
export function Levers({
  levers,
  playbook,
  todayLevers,
  compact = false,
}: {
  /** Active levers in display order — one to four, user-defined. */
  levers: LeverRow[];
  playbook: PlaybookItem[];
  todayLevers: string[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState<Lever | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [logged, setLogged] = useOptimistic(
    new Set(todayLevers),
    (state: Set<string>, action: { lever: Lever; on: boolean }) => {
      const next = new Set(state);
      if (action.on) next.add(action.lever);
      else next.delete(action.lever);
      return next;
    },
  );

  // The optimistic state rolls itself back when the revalidated page disagrees,
  // so a failed write already un-fills the button. What was missing is the
  // reason: the lever just quietly popped back out, which reads as the app
  // ignoring the tap.
  function commit(lever: Lever, detail?: string | null) {
    setOpen(null);
    setFailed(null);
    startTransition(async () => {
      setLogged({ lever, on: true });
      const result = await logEntry(lever, detail ?? null);
      if (!result.ok) setFailed(result.error);
    });
  }

  function remove(lever: Lever) {
    setFailed(null);
    startTransition(async () => {
      setLogged({ lever, on: false });
      const result = await undoEntry(lever);
      if (!result.ok) setFailed(result.error);
    });
  }

  return (
    <>
      {/* One lever spans the row; three puts the odd one full-width rather than
          leaving a hole, because an empty cell reads as a missing lever. */}
      <div className="grid grid-cols-2 gap-2">
        {levers.map((l, i) => (
          <div
            key={l.key}
            className={
              levers.length === 1 || (levers.length === 3 && i === 2)
                ? "col-span-2"
                : ""
            }
          >
            <LeverButton
              lever={l.key}
              label={l.label}
              done={logged.has(l.key)}
              busy={pending}
              compact={compact}
              onOpen={() => setOpen(l.key)}
              onUndo={() => remove(l.key)}
            />
          </div>
        ))}
      </div>

      {/* Stated at full ink inside a bordered well rather than in red: `down`
          and `degraded` mean the user's system is down, and a write that did
          not land is the app's failure, not theirs. See DESIGN.md. */}
      {failed && (
        <p
          role="alert"
          className="border-line-hi bg-surface text-ink mt-2 rounded border px-3 py-2 text-xs"
        >
          Not saved — {failed}
        </p>
      )}

      {open && (
        <PlaybookSheet
          lever={open}
          items={playbook.filter((p) => p.lever === open)}
          onPick={(label) => commit(open, label)}
          onSkip={() => commit(open, null)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function LeverButton({
  lever,
  label,
  done,
  busy,
  compact,
  onOpen,
  onUndo,
}: {
  lever: Lever;
  label: string;
  done: boolean;
  busy: boolean;
  compact: boolean;
  onOpen: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={done ? undefined : onOpen}
        aria-pressed={done}
        disabled={done}
        className={[
          "w-full rounded border font-medium tracking-wide uppercase transition-colors duration-150",
          compact ? "min-h-11 py-3 text-xs" : "min-h-16 py-5 text-sm",
          done
            ? "border-line bg-surface text-ink-mute"
            : "border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi",
        ].join(" ")}
      >
        {done ? `${label} ✓` : label}
      </button>
      {/* Undo sits below rather than overlapping the button it undoes, and is
          a full-width tap target — it is used with one thumb, mid-mistake. */}
      {done && (
        <button
          onClick={onUndo}
          disabled={busy}
          aria-label={`Undo ${lever}`}
          className="text-ink-mute hover:text-ink-dim active:text-ink min-h-11 w-full rounded text-xs transition-colors disabled:opacity-50"
        >
          {busy ? "…" : "undo"}
        </button>
      )}
    </div>
  );
}

/**
 * The playbook, not a blank page. Ranked by what has actually worked, so
 * restarting is reopening a file rather than reinventing anything.
 */
function PlaybookSheet({
  lever,
  items,
  onPick,
  onSkip,
  onClose,
}: {
  lever: Lever;
  items: PlaybookItem[];
  onPick: (label: string) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [typing, setTyping] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  // One pick per sheet: the second tap is always an accident.
  function pick(label: string) {
    if (chosen !== null) return;
    setChosen(label);
    onPick(label);
  }

  return (
    <Sheet label={`Log ${lever}`} onClose={onClose}>
      <p className="label mb-3">{lever}</p>

      <div className="flex flex-col gap-2">
        {items.slice(0, 3).map((item) => (
          <button
            key={item.id}
            onClick={() => pick(item.label)}
            disabled={chosen !== null}
            className={[
              "min-h-14 rounded border px-4 text-left text-sm transition-colors",
              chosen === item.label
                ? "border-line-hi bg-line text-ink"
                : "border-line bg-surface-hi text-ink hover:bg-line active:bg-line-hi disabled:opacity-40",
            ].join(" ")}
          >
            {item.label}
            {chosen === item.label && (
              <span className="text-ink-mute ml-2 text-xs">logging…</span>
            )}
          </button>
        ))}

        {typing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pick(custom.trim());
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="what did you do?"
              aria-label="What did you do?"
              className="bg-surface-hi border-line text-ink placeholder:text-ink-mute min-h-14 min-w-0 flex-1 rounded border px-4 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={chosen !== null}
              className="border-line-hi bg-line text-ink min-h-14 rounded border px-4 text-sm disabled:opacity-40"
            >
              log
            </button>
          </form>
        ) : (
          <button
            onClick={() => setTyping(true)}
            disabled={chosen !== null}
            className="border-line text-ink-mute hover:text-ink-dim min-h-14 rounded border border-dashed px-4 text-left text-sm transition-colors disabled:opacity-40"
          >
            something else
          </button>
        )}
      </div>

      <button
        onClick={() => {
          if (chosen !== null) return;
          setChosen("");
          onSkip();
        }}
        disabled={chosen !== null}
        className="text-ink-mute hover:text-ink-dim active:text-ink min-h-11 w-full text-center text-xs transition-colors disabled:opacity-40"
      >
        just mark it up
      </button>
    </Sheet>
  );
}
