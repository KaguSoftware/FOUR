import { redirect } from "next/navigation";
import { getStatus, getSupabase } from "@/lib/system";
import { SignalCheck } from "./signal-check";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

/**
 * Proof — the file of what came back.
 *
 * This exists because the runs that lasted held while progress was
 * perceptible, and died when it stopped being. During a run this answers "is
 * this doing anything." During re-entry it is evidence it worked last time,
 * which is a better argument for restarting than any motivational copy.
 */
export default async function ProofPage() {
  const status = await getStatus();
  if (!status) redirect("/login");

  const supabase = await getSupabase();
  const { data: signals } = await supabase
    .from("signals")
    .select("observed_on, kind, value, detail")
    .eq("user_id", status.user.id)
    .order("observed_on", { ascending: false })
    .limit(120);

  const rows = signals ?? [];
  const notes = rows.filter((s) => s.detail);
  const scalars = rows.filter((s) => s.value !== null);

  const alreadyToday = rows.some((s) => s.observed_on === status.today);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page="proof" />
        <BackLink />
      </header>

      {!alreadyToday && (
        <section className="border-line mb-8 border-b pb-8">
          <SignalCheck />
        </section>
      )}

      {scalars.length > 0 && (
        <section className="mb-8">
          <p className="label mb-3">12-week trend</p>
          <Trend points={scalars} />
        </section>
      )}

      <section>
        <p className="label mb-3">What changed</p>
        {notes.length === 0 ? (
          <p className="text-ink-mute text-sm leading-relaxed">
            Nothing logged yet. When something moves — incline up, stairs
            easier, sleeping through — note it here. This list only grows, and
            it is what you read on the way back after a break.
          </p>
        ) : (
          <ul className="flex flex-col">
            {notes.map((n) => (
              <li
                key={`${n.observed_on}-${n.kind}`}
                className="border-line flex items-baseline gap-3 border-b py-3 last:border-0"
              >
                <span className="tabular text-ink-mute shrink-0 text-xs">
                  {n.observed_on}
                </span>
                <span className="text-ink-dim text-sm">{n.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * The only chart in the app, and it is here because this is the single place
 * where a trend IS the information. Muted line, no gradient fill, no axis
 * furniture. Declining renders in the same neutral ink as rising — the
 * plateau report carries that meaning in words, not colour.
 */
function Trend({
  points,
}: {
  points: { observed_on: string; kind: string; value: number | null }[];
}) {
  const byDate = new Map<string, number[]>();
  for (const p of points) {
    if (p.value === null) continue;
    const list = byDate.get(p.observed_on) ?? [];
    list.push(p.value);
    byDate.set(p.observed_on, list);
  }

  const series = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([date, vals]) => ({
      date,
      avg: vals.reduce((x, y) => x + y, 0) / vals.length,
    }));

  if (series.length < 2) {
    return (
      <p className="text-ink-mute text-xs">
        {series.length === 1
          ? "One sample. The trend needs a few weeks."
          : "No samples yet."}
      </p>
    );
  }

  const w = 320;
  const h = 64;
  const step = w / (series.length - 1);
  const y = (v: number) => h - ((v - 1) / 4) * h;
  const d = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(s.avg)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 -4 ${w} ${h + 8}`}
        className="h-20 w-full"
        role="img"
        aria-label={`Felt-state trend across ${series.length} weeks, most recent ${series[series.length - 1].avg.toFixed(1)} out of 5`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--color-ink-dim)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {series.map((s, i) => (
          <circle
            key={s.date}
            cx={i * step}
            cy={y(s.avg)}
            r="2"
            fill="var(--color-ink-dim)"
          />
        ))}
      </svg>
      <p className="text-ink-mute mt-1 text-xs">
        energy + sleep, weekly average · {series.length} weeks
      </p>
    </div>
  );
}
