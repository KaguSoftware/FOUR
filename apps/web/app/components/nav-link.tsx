"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

/**
 * A link that says so when it's working.
 *
 * Every page here is dynamic, so a tap costs a server round-trip — ~800ms on
 * a throttled connection. `useLinkStatus` alone is not enough: it reports only
 * the prefetch, which resolves in ~140ms and leaves the rest of the wait with
 * no feedback at all. That silent gap is what makes the app feel dead and gets
 * it tapped twice.
 *
 * Navigation therefore runs inside a transition, which stays pending until the
 * destination has actually rendered. The 120ms reveal delay is a CSS
 * animation-delay rather than a timer, so there is no state to synchronise —
 * a fast navigation finishes before the indicator ever becomes visible.
 */
export function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      onClick={(e) => {
        // Let modified clicks (new tab, etc.) behave normally.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        startTransition(() => router.push(href));
      }}
      aria-busy={pending}
      // 44px min height: this is tapped one-handed, often in a gym.
      className={[
        "flex min-h-11 items-center rounded text-xs transition-colors",
        pending
          ? "text-ink"
          : "text-ink-mute hover:text-ink-dim active:text-ink",
        className,
      ].join(" ")}
    >
      {children}
      <span
        aria-hidden="true"
        className={[
          "bg-ink-mute ml-1.5 inline-block h-1 w-1 shrink-0 rounded-full",
          pending ? "nav-pending" : "opacity-0",
        ].join(" ")}
      />
    </Link>
  );
}

/** Back home. Same feedback, same hit area. */
export function BackLink() {
  return (
    <NavLink href="/" className="-mr-2 px-2">
      ← home
    </NavLink>
  );
}
