import { requireStatus } from "@/lib/system";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";
import { monthMotto, monthUptime } from "@uptime/core";
import { Wall } from "./wall";

export const dynamic = "force-dynamic";

/**
 * Proof — the wall.
 *
 * This page was a chart. It answered "is this doing anything" with a polyline
 * of self-reported energy ratings — a question you had to already care about
 * to come and look at — and asked for two ratings and a journal entry in
 * exchange. Nobody read it.
 *
 * It is now a screen full of cells, of which as many are lit as the fraction
 * of this month you have been up. **The message is made of the cells that
 * never light**, a stencil with the earned ground filling in around it. At
 * nothing it is uniformly dark and says nothing; half a month in, half of it
 * is readable.
 *
 * That inversion is what stops this being a poster. The app never tells you to
 * keep going; it gradually stops hiding the fact that it would.
 *
 * The figure is `monthUptime` and every coordinate is `pixelPaths`, both from
 * core, so the phone draws the identical wall from the identical month.
 */
export default async function ProofPage() {
  const status = await requireStatus();
  const month = monthUptime(status.entries, status.today);

  return (
    <main className="mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-baseline justify-between">
        <Wordmark page="proof" />
        <p className="tabular text-ink-mute text-xs">
          {month.up}/{month.total}
        </p>
      </header>

      {/* `min-h-0` is load-bearing: a flex child defaults to `min-height:auto`,
          which refuses to shrink below its content and would push the wall off
          the bottom of a short viewport instead of sizing it to fit. */}
      <section className="min-h-0 flex-1">
        {/* Drawn from the pool, keyed on the calendar month — stable while it
            is being earned, different the next time one starts. */}
        <Wall
          up={month.up}
          total={month.total}
          pct={month.pct}
          message={monthMotto(status.today)}
        />
      </section>

      <nav className="mt-6 shrink-0">
        <BackLink />
      </nav>
    </main>
  );
}
