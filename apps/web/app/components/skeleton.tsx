import { Wordmark } from "./wordmark";
/**
 * Loading shells.
 *
 * Skeletons rather than spinners: the page shape appears instantly and fills
 * in, so a tap always produces a visible result even on gym wifi.
 */
export function Bar({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return (
    <div
      className={`bg-surface-hi animate-pulse rounded ${w} ${h}`}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page={title} />
        <span className="text-ink-mute text-xs">loading…</span>
      </header>
      {children}
      <span className="sr-only">Loading {title}</span>
    </main>
  );
}
