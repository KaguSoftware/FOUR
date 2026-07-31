"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The overlay shell — scrim, panel, and the four things every dialog owes the
 * keyboard.
 *
 * This started as markup inlined in `levers.tsx`, which looked complete and was
 * not: no portal, so a positioned ancestor could clip it; no focus trap, so Tab
 * walked out of the dialog and into the page behind it; no Escape; and no
 * scroll lock, so the page scrolled under an open sheet on touch. Each of those
 * is invisible with a mouse and immediate with a keyboard, which is exactly the
 * kind of bug that survives review — so the shell exists once and every dialog
 * uses it.
 *
 * A bottom sheet on phones, a centred card from `sm` up. The thumb is at the
 * bottom of a phone; the eye is in the middle of a laptop.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  /** Names the dialog for a screen reader. Required — an unnamed dialog is a box. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Escape, and the focus trap. Together in one effect because they share the
  // keydown listener and the same lifetime.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        return onClose();
      }
      if (e.key !== "Tab" || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Wrap at both ends. Without the shift branch, Tab is trapped and
      // Shift+Tab still escapes — which is the half-fix that reads as done.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Scroll lock. The previous value is restored rather than cleared, so two
  // stacked sheets cannot leave the page permanently unscrollable.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Move focus in on open and hand it back on close, so a keyboard user is not
  // returned to the top of the document.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Rendered at the end of <body>: a dialog inside a transformed or
  // overflow-hidden ancestor is a dialog with a corner cut off.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        // Not focusable: it is the scrim, and Tab landing on "Close" before any
        // content is a worse first stop than the panel itself.
        tabIndex={-1}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={panel}
        tabIndex={-1}
        className="bg-surface border-line relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-lg border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:rounded-lg"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
