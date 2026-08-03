"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { pixelPaths, pixelWall, wallCaption, wallGrid } from "@uptime/core";

/**
 * The pixel wall, measured to whatever box it is given.
 *
 * A client component only because it has to MEASURE. The cell count is an
 * integer the message layout depends on — the largest glyph scale that fits,
 * where the lines wrap, whether the whole motto fits at all — so the wall
 * cannot be laid out until the real box is known. There is no CSS arrangement
 * that produces those integers for `pixelWall` to work from.
 *
 * It renders nothing until measured. Guessing a grid server-side and
 * correcting on hydration re-tiles the whole screen in front of the user,
 * which is worse than one empty frame.
 *
 * `wallGrid` is in core so this and the phone cannot round the division
 * differently and end up with different messages from the same month.
 */
export function Wall({
  up,
  total,
  pct,
  message,
}: {
  up: number;
  total: number;
  pct: number;
  message: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox((prev) =>
        prev &&
        Math.abs(prev.width - rect.width) < 1 &&
        Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const grid = box ? wallGrid(box) : null;
  const wall = grid
    ? pixelWall({ cols: grid.cols, rows: grid.rows, pct, message })
    : null;
  const paths = wall && grid ? pixelPaths(wall, grid) : null;
  const span = (n: number, g: { cell: number; gap: number }) =>
    n * (g.cell + g.gap) - g.gap;

  return (
    <div ref={ref} className="h-full w-full">
      {grid && wall && paths && (
        <svg
          width={span(grid.cols, grid)}
          height={span(grid.rows, grid)}
          role="img"
          // The wall is unreadable to anything not looking at it, so this
          // sentence is not a supplement to the visual — it IS the page. It
          // reads the wall's own `shown`, so it can never announce a word that
          // was truncated off a narrow grid.
          aria-label={wallCaption(wall, up, total)}
        >
          {/*
            A handful of paths for ~1,300 cells rather than 1,300 elements.
            `ground` covers the masked cells AND the unearned ones together,
            and they MUST stay the same colour: draw them even one step apart
            and the message is legible at zero, which is the whole idea
            undone. The lit layer is a few opacity bands — the tide fading in
            behind the reveal front — with both the split and the opacities
            computed in core so the phone draws the identical fade.
          */}
          <path d={paths.ground} fill="var(--color-line)" />
          {paths.lit.map((band) => (
            <path
              key={band.opacity}
              d={band.d}
              fill="var(--color-ink)"
              fillOpacity={band.opacity}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
