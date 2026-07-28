import { requireStatus } from "@/lib/system";
import { DayGrid } from "../components/day-grid";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

/**
 * The incident log.
 *
 * Runs and outages render as peers in one chronological list — a break is an
 * incident with a name and an end date, not a failure. History is never
 * truncated and never reset.
 */
export default async function HistoryPage() {
  const status = await requireStatus();

  const { entries, today, runs, outages, allTime } = status;

  type Row =
    | { type: "run"; started_on: string; ended_on: string | null; days: number }
    | { type: "outage"; started_on: string; ended_on: string | null; days: number };

  const rows: Row[] = [
    ...runs.map((r) => ({ ...r, type: "run" as const })),
    ...outages.map((o) => ({ ...o, type: "outage" as const })),
  ].sort((a, b) => b.started_on.localeCompare(a.started_on));

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page="history" />
        <BackLink />
      </header>

      {/* All-time figures. Every one is monotonic — they only ever go up,
          which is why they are the truest summary during a bad week. */}
      <section className="border-line mb-8 grid grid-cols-3 gap-4 border-b pb-6">
        <Figure label="days up" value={allTime.totalDaysUp} />
        <Figure label="longest run" value={`${allTime.longestRun}d`} />
        <Figure label="runs" value={allTime.completedRuns} />
      </section>

      <section className="mb-8">
        <DayGrid entries={entries} today={today} leverCount={status.leverCount} days={90} />
        <p className="text-ink-mute mt-2 text-xs">last 90 days</p>
      </section>

      {rows.length === 0 ? (
        <p className="text-ink-mute text-sm">
          No history yet. Log one thing and it starts here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={`${row.type}-${row.started_on}`}
              className="border-line flex items-baseline justify-between border-b py-3 text-sm last:border-0"
            >
              <span className="tabular text-ink-mute text-xs">
                {fmt(row.started_on)}
                {row.ended_on && row.ended_on !== row.started_on
                  ? ` – ${fmt(row.ended_on)}`
                  : ""}
              </span>
              <span
                className={
                  row.type === "run" ? "text-ink-dim text-xs" : "text-degraded text-xs"
                }
              >
                {row.type === "run"
                  ? `${row.days} ${row.days === 1 ? "day" : "days"} up`
                  : `outage ${row.days} ${row.days === 1 ? "day" : "days"}`}
                {row.ended_on === null && " · ongoing"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="tabular text-ink text-xl font-medium">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function fmt(iso: string) {
  const [, m, d] = iso.split("-");
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
