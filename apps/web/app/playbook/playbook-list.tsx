"use client";

import { useState, useTransition } from "react";
import { updatePlaybook } from "@/app/actions";
import type { PlaybookItem } from "@/lib/system";
import { ACTIVE_LEVERS } from "@uptime/core";

export function PlaybookList({ items }: { items: PlaybookItem[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-ink-mute text-sm leading-relaxed">
        Empty. Log a session with a note and it lands here — then it&apos;s one
        tap forever after.
      </p>
    );
  }

  const grouped = { gym: [] as PlaybookItem[], food: [] as PlaybookItem[] };
  for (const i of items) grouped[i.lever].push(i);

  return (
    <div className="flex flex-col gap-8">
      {ACTIVE_LEVERS.map((lever) =>
        grouped[lever].length ? (
          <section key={lever}>
            <p className="label mb-3">{lever}</p>
            <ul className="flex flex-col">
              {grouped[lever].map((item) => (
                <li
                  key={item.id}
                  className="border-line flex items-center justify-between gap-2 border-b py-2 last:border-0"
                >
                  <span className="text-ink-dim min-w-0 flex-1 truncate text-sm">
                    {item.label}
                  </span>
                  <span className="tabular text-ink-mute shrink-0 text-xs">
                    {item.use_count}×
                  </span>
                  {/* 44px targets: these are tapped on a phone, not clicked. */}
                  <button
                    aria-label={`${item.is_pinned ? "Unpin" : "Pin"} ${item.label}`}
                    aria-pressed={item.is_pinned}
                    disabled={pending || busy === item.id}
                    onClick={() => {
                      setBusy(item.id);
                      start(async () => {
                        await updatePlaybook(item.id, {
                          is_pinned: !item.is_pinned,
                        });
                        setBusy(null);
                      });
                    }}
                    className={[
                      "min-h-11 shrink-0 rounded border px-3 text-xs transition-colors disabled:opacity-50",
                      item.is_pinned
                        ? "border-line-hi bg-line text-ink"
                        : "border-line text-ink-mute hover:text-ink-dim active:bg-line",
                    ].join(" ")}
                  >
                    pin
                  </button>
                  <button
                    aria-label={`Archive ${item.label}`}
                    disabled={pending || busy === item.id}
                    onClick={() => {
                      setBusy(item.id);
                      start(async () => {
                        await updatePlaybook(item.id, { archived: true });
                        setBusy(null);
                      });
                    }}
                    className="text-ink-mute hover:text-ink-dim active:text-ink min-h-11 shrink-0 rounded px-2 text-xs transition-colors disabled:opacity-50"
                  >
                    {busy === item.id ? "…" : "archive"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
