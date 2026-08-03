"use client";

import { useState, useTransition } from "react";
import {
  ACTIVITY_FULL_COPY,
  ACTIVITY_LABEL_MAX,
  canAddActivity,
  rankActivities,
  type ActivityRow,
} from "@uptime/core";
import {
  createActivity,
  deleteActivity,
  renameActivity,
  restoreActivity,
} from "@/app/actions";
import type { LeverRow } from "@/lib/system";

/**
 * Activities, per lever — the things that have already worked.
 *
 * Until now these could only be CREATED, as a side effect of logging a lever
 * with a detail. A typo lived forever, the list grew without bound behind a
 * picker that showed three, and there was no way to see the rest of it.
 *
 * The cap has two halves and they are not symmetric, which is the thing to
 * understand before changing anything here:
 *
 * - **Adding here refuses at ten.** You are looking at the list; being told it
 *   is full is an answer you can act on.
 * - **Logging never refuses.** A new detail at the cap quietly retires
 *   something unpinned and used at most once, and if nothing qualifies it
 *   creates nothing — the day still logs either way. Blocking a log would be
 *   the one failure this product exists to prevent.
 *
 * Deleting is a HARD delete, unlike archiving a lever. See `deleteActivity`.
 */
export function ActivityManager({
  levers,
  activities,
}: {
  levers: LeverRow[];
  /** Every row, archived included — the retired list needs them. */
  activities: ActivityRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lever, setLever] = useState(levers[0]?.key ?? "");
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showRetired, setShowRetired] = useState(false);

  if (levers.length === 0) {
    return (
      <div>
        <p className="text-ink text-sm">Activities</p>
        <p className="text-ink-mute mt-1 text-xs leading-relaxed">
          Activities belong to a lever, and there are none yet.
        </p>
      </div>
    );
  }

  const selected = levers.find((l) => l.key === lever) ?? levers[0];
  const mine = activities.filter((a) => a.lever === selected.key);
  const active = rankActivities(mine);
  const retired = mine.filter((a) => a.archived);
  const full = !canAddActivity(active.length);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That didn't work.");
    });
  }

  return (
    <div>
      <p className="text-ink text-sm">Activities</p>
      <p className="text-ink-mute mt-1 mb-4 text-xs leading-relaxed">
        What has already worked, offered next time you log. These fill
        themselves in as you use them — you never have to write one.
      </p>

      {levers.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {levers.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => {
                setLever(l.key);
                setEditing(null);
              }}
              aria-pressed={l.key === selected.key}
              // Selection rests on fill AND border AND text weight, not fill
              // alone: a fill-only selected state on this palette measured
              // 1.10:1 once and was effectively invisible.
              className={[
                "min-h-11 rounded-md border px-3 text-xs",
                l.key === selected.key
                  ? "border-line-hi bg-line text-ink font-medium"
                  : "border-line text-ink-mute hover:bg-surface",
              ].join(" ")}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {active.length === 0 && (
        // An empty playbook is a WORKING screen, and the copy has to read that
        // way — the lever sheet always offers "just mark it up".
        <p className="text-ink-mute mb-3 text-xs leading-relaxed">
          Nothing yet. Log {selected.label} with a note of what you did and it
          will be here next time.
        </p>
      )}

      <ul className="mb-3 flex flex-col">
        {active.map((item) => (
          <li
            key={item.id}
            className="border-line flex items-center gap-2 border-b py-2 last:border-0"
          >
            {editing === item.id ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  maxLength={ACTIVITY_LABEL_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null);
                    if (e.key === "Enter") {
                      setEditing(null);
                      run(() => renameActivity(item.id, draft));
                    }
                  }}
                  className="border-line-hi bg-surface text-ink min-h-11 flex-1 rounded-md border px-3 text-sm"
                  aria-label={`Rename ${item.label}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    run(() => renameActivity(item.id, draft));
                  }}
                  className="text-ink-mute hover:text-ink min-h-11 px-2 text-xs"
                >
                  save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-ink-mute hover:text-ink min-h-11 px-2 text-xs"
                >
                  cancel
                </button>
              </>
            ) : (
              <>
                <span className="text-ink-dim flex-1 truncate text-sm">
                  {item.label}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDraft(item.label);
                    setEditing(item.id);
                  }}
                  className="text-ink-mute hover:text-ink min-h-11 px-2 text-xs disabled:opacity-40"
                >
                  rename
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    // The reassurance that matters: this is a shortcut, not a
                    // record. What it says is already written into every day
                    // it was used on.
                    if (
                      !confirm(
                        `Delete "${item.label}"? Every day you logged it stays exactly as it is, with what you did still written on it. This only removes the shortcut.`,
                      )
                    )
                      return;
                    run(() => deleteActivity(item.id));
                  }}
                  className="text-ink-mute hover:text-ink min-h-11 px-2 text-xs disabled:opacity-40"
                >
                  delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {full ? (
        <p className="text-ink-mute text-xs leading-relaxed">
          {ACTIVITY_FULL_COPY}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const label = adding;
            setAdding("");
            run(() => createActivity(selected.key, label));
          }}
          className="flex items-center gap-2"
        >
          <input
            value={adding}
            maxLength={ACTIVITY_LABEL_MAX}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add an activity"
            aria-label={`Add an activity to ${selected.label}`}
            className="border-line bg-surface text-ink placeholder:text-ink-mute min-h-11 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!adding.trim() || pending}
            className="border-line-hi bg-surface-hi text-ink min-h-11 rounded-md border px-4 text-xs font-medium disabled:opacity-40"
          >
            add
          </button>
        </form>
      )}

      {/* What the cap moved aside to make room. Collapsed, because the whole
          point is that they are out of the way — but reachable, so the
          eviction is recoverable rather than a silent loss. */}
      {retired.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowRetired((s) => !s)}
            className="text-ink-mute hover:text-ink min-h-11 text-xs"
          >
            {showRetired ? "hide" : "show"} {retired.length} retired
          </button>
          {showRetired && (
            <ul className="flex flex-col">
              {retired.map((item) => (
                <li
                  key={item.id}
                  className="border-line flex items-center gap-2 border-b py-2 last:border-0"
                >
                  <span className="text-ink-mute flex-1 truncate text-sm">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => restoreActivity(item.id))}
                    className="text-ink-mute hover:text-ink min-h-11 px-2 text-xs disabled:opacity-40"
                  >
                    restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-degraded mt-3 text-xs">{error}</p>}
    </div>
  );
}
