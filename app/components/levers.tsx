"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { logEntry, undoEntry } from "@/app/actions";
import type { PlaybookItem } from "@/lib/system";
import type { Lever } from "@/lib/uptime";

/**
 * The whole logging path: tap a lever, tap a chip. Two taps, no typing.
 *
 * Optimistic state means the grid fills the instant you tap, even on bad
 * signal in a gym basement — every second of friction is a reason to drop it.
 */
export function Levers({
  playbook,
  todayLevers,
  compact = false,
}: {
  playbook: PlaybookItem[];
  todayLevers: string[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState<Lever | null>(null);
  const [, startTransition] = useTransition();
  const [logged, setLogged] = useOptimistic(
    new Set(todayLevers),
    (state: Set<string>, action: { lever: Lever; on: boolean }) => {
      const next = new Set(state);
      if (action.on) next.add(action.lever);
      else next.delete(action.lever);
      return next;
    },
  );

  function commit(lever: Lever, detail?: string | null) {
    setOpen(null);
    startTransition(async () => {
      setLogged({ lever, on: true });
      await logEntry(lever, detail ?? null);
    });
  }

  function remove(lever: Lever) {
    startTransition(async () => {
      setLogged({ lever, on: false });
      await undoEntry(lever);
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(["gym", "food"] as const).map((lever) => (
          <LeverButton
            key={lever}
            lever={lever}
            done={logged.has(lever)}
            compact={compact}
            onOpen={() => setOpen(lever)}
            onUndo={() => remove(lever)}
          />
        ))}
      </div>

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
  done,
  compact,
  onOpen,
  onUndo,
}: {
  lever: Lever;
  done: boolean;
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
          compact ? "py-3 text-xs" : "py-4 text-sm",
          done
            ? "border-line bg-surface text-ink-mute"
            : "border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi",
        ].join(" ")}
      >
        {done ? `${lever} ✓` : lever}
      </button>
      {/* Undo sits below rather than overlapping the button it undoes. */}
      {done && (
        <button
          onClick={onUndo}
          aria-label={`Undo ${lever}`}
          className="text-ink-mute hover:text-ink-dim self-center text-[0.625rem] transition-colors"
        >
          undo
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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Log ${lever}`}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="bg-surface border-line relative w-full max-w-sm rounded-t-lg border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-lg">
        <p className="label mb-3">{lever}</p>

        <div className="flex flex-col gap-1.5">
          {items.slice(0, 3).map((item) => (
            <button
              key={item.id}
              onClick={() => onPick(item.label)}
              className="border-line bg-surface-hi text-ink hover:bg-line active:bg-line-hi rounded border px-3 py-3 text-left text-sm transition-colors"
            >
              {item.label}
            </button>
          ))}

          {typing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onPick(custom.trim() || "");
              }}
              className="flex gap-1.5"
            >
              <input
                ref={inputRef}
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="what did you do?"
                className="bg-surface-hi border-line text-ink placeholder:text-ink-mute min-w-0 flex-1 rounded border px-3 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                className="border-line-hi bg-line text-ink rounded border px-3 text-sm"
              >
                log
              </button>
            </form>
          ) : (
            <button
              onClick={() => setTyping(true)}
              className="border-line text-ink-mute hover:text-ink-dim rounded border border-dashed px-3 py-3 text-left text-sm transition-colors"
            >
              something else
            </button>
          )}
        </div>

        <button
          onClick={onSkip}
          className="text-ink-mute hover:text-ink-dim mt-3 w-full py-1 text-center text-xs transition-colors"
        >
          just mark it up
        </button>
      </div>
    </div>
  );
}
