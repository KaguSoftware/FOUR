"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The month pager's scroller and its two arrows.
 *
 * A client component only because the arrows have to scroll something. The
 * months themselves stay server-rendered and are passed in as children — the
 * grids hold the whole history and hand down only the days on screen, and that
 * should not move into the browser bundle for the sake of two buttons.
 *
 * Snap points do the actual paging, so a touchpad or a phone swipe works with
 * no JavaScript at all; the arrows exist because a mouse has no swipe and
 * because scroll snapping is not reachable by keyboard.
 */
export function MonthPager({
  months,
  labels,
}: {
  months: ReactNode[];
  /** One per page, for the announcement — server-rendered text, not markup. */
  labels: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Track which page is showing, so the arrows can disable at the ends and the
  // caption can say where you are.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const width = el.clientWidth || 1;
      setIndex(Math.round(el.scrollLeft / width));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function go(delta: number) {
    const el = ref.current;
    if (!el) return;
    const next = Math.min(Math.max(index + delta, 0), months.length - 1);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="label">
          {labels[index] ?? ""}
          {months.length > 1 && (
            <span className="text-ink-mute">
              {" · "}
              {index + 1}/{months.length}
            </span>
          )}
        </p>
        {months.length > 1 && (
          <span className="flex gap-1">
            <Arrow
              label="Later month"
              disabled={index === 0}
              onClick={() => go(-1)}
            >
              ←
            </Arrow>
            <Arrow
              label="Earlier month"
              disabled={index === months.length - 1}
              onClick={() => go(1)}
            >
              →
            </Arrow>
          </span>
        )}
      </div>

      {/*
        `snap-mandatory` with a full-width page each: the same paging a phone
        gets from a swipe. `scrollbar-width: none` because a horizontal bar
        under a calendar reads as a broken layout rather than an affordance —
        the arrows and the counter are the affordance.
      */}
      <div
        ref={ref}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {months.map((month, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {month}
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // 44px, like every other target in this app. The glyph is small; the
      // thing you press is not.
      className="border-line text-ink-dim hover:bg-surface disabled:text-ink-mute flex h-11 w-11 items-center justify-center rounded-md border text-sm disabled:opacity-40"
    >
      {children}
    </button>
  );
}
