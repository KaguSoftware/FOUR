"use client";

import { useState, useTransition } from "react";
import { archiveLever, createLever, renameLever } from "@/app/actions";
import type { LeverRow } from "@/lib/system";

/**
 * Lever management.
 *
 * Two rules carry the whole design, and both exist so nothing done here can
 * make a past day worse:
 *
 * - **Renaming is free.** The label changes; the stable key underneath does
 *   not, so six months of history follows the rename.
 * - **Archiving never deletes.** Entries keep pointing at the key, so the day
 *   grid and the 30-day number are identical afterwards. The button just stops
 *   being offered.
 *
 * Four is the ceiling and one is the floor, both enforced server-side as well —
 * this UI only makes the limits legible.
 */
export function LeverManager({ levers }: { levers: LeverRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const full = levers.length >= 4;
  const last = levers.length <= 1;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That didn't work.");
    });
  }

  return (
    <div>
      <p className="text-ink text-sm">Levers</p>
      <p className="text-ink-mute mt-1 mb-4 text-xs leading-relaxed">
        One tap on any of these keeps the day up. Not all of them — one. Rename
        freely; archiving keeps every day you already logged.
      </p>

      <ul className="mb-3 flex flex-col">
        {levers.map((lever) => (
          <li
            key={lever.id}
            className="border-line flex items-center gap-2 border-b py-2 last:border-0"
          >
            {editing === lever.id ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  maxLength={24}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      run(() => renameLever(lever.id, draft));
                      setEditing(null);
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  aria-label={`Rename ${lever.label}`}
                  className="bg-surface border-line focus:border-line-hi text-ink min-h-11 min-w-0 flex-1 rounded border px-3 text-sm outline-none"
                />
                <button
                  onClick={() => {
                    run(() => renameLever(lever.id, draft));
                    setEditing(null);
                  }}
                  className="text-ink-dim hover:text-ink min-h-11 px-3 text-xs"
                >
                  save
                </button>
              </>
            ) : (
              <>
                <span className="text-ink-dim min-w-0 flex-1 truncate text-sm">
                  {lever.label}
                </span>
                <button
                  onClick={() => {
                    setEditing(lever.id);
                    setDraft(lever.label);
                  }}
                  aria-label={`Rename ${lever.label}`}
                  className="text-ink-mute hover:text-ink-dim min-h-11 px-3 text-xs transition-colors"
                >
                  rename
                </button>
                <button
                  disabled={pending || last}
                  onClick={() => run(() => archiveLever(lever.id))}
                  aria-label={`Archive ${lever.label}`}
                  title={last ? "Keep at least one lever" : undefined}
                  className="text-ink-mute hover:text-ink-dim min-h-11 px-3 text-xs transition-colors disabled:opacity-40"
                >
                  archive
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {full ? (
        <p className="text-ink-mute text-xs">
          Four is the maximum. Archive one to add another.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            run(() => createLever(adding));
            setAdding("");
          }}
          className="flex gap-2"
        >
          <input
            value={adding}
            maxLength={24}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add a lever"
            aria-label="Add a lever"
            className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-11 min-w-0 flex-1 rounded border px-3 text-sm outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={pending || !adding.trim()}
            className="border-line-hi bg-surface-hi text-ink hover:bg-line min-h-11 shrink-0 rounded border px-4 text-sm transition-colors disabled:opacity-40"
          >
            add
          </button>
        </form>
      )}

      {/* Says what went wrong and what to do, never just that it failed. */}
      {error && <p className="text-degraded mt-3 text-xs">{error}</p>}
    </div>
  );
}
