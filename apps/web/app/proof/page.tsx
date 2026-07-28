import { getSupabase, requireStatus } from "@/lib/system";
import { SignalCheck } from "./signal-check";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

/**
 * How many days the trend shows. 60 keeps the line legible at phone width:
 * every point still gets ~5px, and the shape of two months is readable.
 */
const DAILY_TREND_DAYS = 60;

/**
 * Proof — the file of what came back.
 *
 * This exists because the runs that lasted held while progress was
 * perceptible, and died when it stopped being. During a run this answers "is
 * this doing anything." During re-entry it is evidence it worked last time,
 * which is a better argument for restarting than any motivational copy.
 */
export default async function ProofPage() {
  const status = await requireStatus();

  const supabase = await getSupabase();
  const { data: signals } = await supabase
    .from("signals")
    .select("observed_on, kind, value, detail")
    .eq("user_id", status.user.id)
    .order("observed_on", { ascending: false })
    // This is a row limit, not a date range, so the visible window is however
    // many days these rows happen to cover. Daily sampling writes up to 3 rows
    // a day (energy, sleep, note) — 60 days needs ~180. The headroom to 280 is
    // what absorbs a fourth kind: when optional weight ships it becomes ~240,
    // still inside. A fifth kind would silently start truncating the trend.
    .limit(280);

  const rows = signals ?? [];
  const notes = rows.filter((s) => s.detail);
  const scalars = rows.filter((s) => s.value !== null);
  // Fetched separately, and only when the opt-in is on. That keeps `amount`
  // out of the main query entirely — an account with weight off never touches
  // the column, so this page still renders on a database that has not run the
  // optional-weight migration.
  const { data: weightRows } = status.state.weight_enabled
    ? await supabase
        .from("signals")
        .select("observed_on, amount")
        .eq("user_id", status.user.id)
        .eq("kind", "weight")
        .order("observed_on", { ascending: false })
        .limit(DAILY_TREND_DAYS)
    : { data: null };
  const weights = (weightRows ?? []).filter((w) => w.amount !== null);

  const alreadyToday = rows.some((s) => s.observed_on === status.today);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page="proof" />
        <BackLink />
      </header>

      {!alreadyToday && (
        <section className="border-line mb-8 border-b pb-8">
          <SignalCheck
            weight={
              status.state.weight_enabled
                ? { unit: status.state.weight_unit }
                : undefined
            }
          />
        </section>
      )}

      {scalars.length > 0 && (
        <section className="mb-8">
          <p className="label mb-3">Trend</p>
          <Trend points={scalars} />
        </section>
      )}

      {weights.length > 1 && (
        <section className="mb-8">
          <p className="label mb-3">Weight</p>
          <WeightTrend points={weights} unit={status.state.weight_unit} />
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
  // Sampling is daily, so the trend plots daily. It is noisier than the weekly
  // average it replaces, and that noise is real data rather than a rendering
  // fault — a day that felt like a 2 was a 2.
  //
  // This is NOT the reader that decides a plateau. `evaluatePlateau` folds into
  // ISO weeks and must keep doing so: judged on raw days it fires after four
  // quiet ones, which is a mood, not a trend. Two readers, same data,
  // deliberately different cadence. Do not "fix" one to match the other.
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    if (p.value === null) continue;
    const list = byDay.get(p.observed_on) ?? [];
    list.push(p.value);
    byDay.set(p.observed_on, list);
  }

  const series = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-DAILY_TREND_DAYS)
    .map(([date, vals]) => ({
      date,
      avg: vals.reduce((x, y) => x + y, 0) / vals.length,
    }));

  if (series.length < 2) {
    return (
      <p className="text-ink-mute text-xs">
        {series.length === 1
          ? "One sample. The trend needs a few days."
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
        aria-label={`Felt-state trend across ${series.length} days, most recent ${series[series.length - 1].avg.toFixed(1)} out of 5`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--color-ink-dim)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* One marker, on the most recent day. Sixty dots is a caterpillar,
            not a chart — the line carries the shape, the dot says "you are
            here". */}
        <circle
          cx={(series.length - 1) * step}
          cy={y(series[series.length - 1].avg)}
          r="2.5"
          fill="var(--color-ink)"
        />
      </svg>
      <p className="text-ink-mute mt-1 text-xs">
        energy + sleep, daily · {series.length} days
      </p>
    </div>
  );
}

/**
 * The weight line.
 *
 * Deliberately the plainest chart in the product: no goal line, no target
 * band, no colour for a direction, no delta callout. It plots what was
 * recorded. Reading anything into the shape is the user's business, not the
 * product's — the moment this draws a target it has become a scoreboard.
 */
function WeightTrend({
  points,
  unit,
}: {
  points: { observed_on: string; amount: number | null }[];
  unit: "kg" | "lb";
}) {
  const series = [...points]
    .filter((p) => p.amount !== null)
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on))
    .slice(-DAILY_TREND_DAYS)
    .map((p) => ({ date: p.observed_on, value: p.amount as number }));

  if (series.length < 2) return null;

  const values = series.map((s) => s.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A flat series would divide by zero; a 1-unit band keeps it centred.
  const span = hi - lo || 1;

  const w = 320;
  const h = 64;
  const step = w / (series.length - 1);
  const y = (v: number) => h - ((v - lo) / span) * h;
  const d = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(s.value)}`)
    .join(" ");
  const latest = series[series.length - 1];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 -4 ${w} ${h + 8}`}
        className="h-20 w-full"
        role="img"
        aria-label={`Weight across ${series.length} days, most recent ${latest.value} ${unit}`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--color-ink-dim)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={(series.length - 1) * step}
          cy={y(latest.value)}
          r="2.5"
          fill="var(--color-ink)"
        />
      </svg>
      <p className="text-ink-mute mt-1 text-xs">
        <span className="tabular">{latest.value}</span> {unit} · {series.length}{" "}
        days
      </p>
    </div>
  );
}
