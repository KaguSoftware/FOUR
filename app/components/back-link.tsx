import Link from "next/link";

/**
 * Back to status. Padded to a ≥24px hit area — this is a phone app opened
 * one-handed, and a 16px tap target is a miss.
 */
export function BackLink() {
  return (
    <Link
      href="/"
      className="text-ink-mute hover:text-ink-dim -mr-2 rounded px-2 py-1.5 text-xs transition-colors"
    >
      ← status
    </Link>
  );
}
