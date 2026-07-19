"use client";

import { useTransition } from "react";
import { updatePlaybook } from "@/app/actions";
import type { PlaybookItem } from "@/lib/system";

export function PlaybookList({ items }: { items: PlaybookItem[] }) {
  const [pending, start] = useTransition();

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
      {(["gym", "food"] as const).map((lever) =>
        grouped[lever].length ? (
          <section key={lever}>
            <p className="label mb-3">{lever}</p>
            <ul className="flex flex-col">
              {grouped[lever].map((item) => (
                <li
                  key={item.id}
                  className="border-line flex items-center justify-between gap-3 border-b py-3 last:border-0"
                >
                  <span className="text-ink-dim min-w-0 flex-1 truncate text-sm">
                    {item.label}
                  </span>
                  <span className="tabular text-ink-mute text-xs">
                    {item.use_count}×
                  </span>
                  <button
                    aria-label={`${item.is_pinned ? "Unpin" : "Pin"} ${item.label}`}
                    aria-pressed={item.is_pinned}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await updatePlaybook(item.id, {
                          is_pinned: !item.is_pinned,
                        });
                      })
                    }
                    className={[
                      "min-h-7 rounded border px-2.5 text-[0.625rem] transition-colors",
                      item.is_pinned
                        ? "border-line-hi bg-line text-ink"
                        : "border-line text-ink-mute hover:text-ink-dim",
                    ].join(" ")}
                  >
                    pin
                  </button>
                  <button
                    aria-label={`Archive ${item.label}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await updatePlaybook(item.id, { archived: true });
                      })
                    }
                    className="text-ink-mute hover:text-ink-dim min-h-7 px-2 text-[0.625rem] transition-colors"
                  >
                    archive
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
