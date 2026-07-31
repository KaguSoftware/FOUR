import { NavLink } from "./components/nav-link";
import { requireStatus } from "@/lib/system";
import { MILESTONE_COPY } from "@uptime/core";
import { DayGrid } from "./components/day-grid";
import { Levers } from "./components/levers";
import { Takeover } from "./components/takeover";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const status = await requireStatus();

  const {
    today,
    slammed,
    entries,
    playbook,
    todayLevers,
    uptime,
    run,
    down,
    lastRun,
    liveMilestone,
  } = status;

  // Down 3+ days: the dashboard is replaced, not annotated. Nothing else on
  // screen, because the restart is the only thing that matters right now.
  //
  // A system with no history has never been down, so a first run gets the
  // normal dashboard and its empty state — never the outage takeover.
  if (down >= 3 && entries.length > 0) {
    return (
      <Takeover
        down={down}
        levers={status.levers}
        playbook={playbook}
        todayLevers={[...todayLevers]}
        lastRun={lastRun}
        lastDetail={lastDetail(entries)}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-9 flex items-baseline justify-between">
        <Wordmark />
        <span
          className={[
            "text-xs font-medium tracking-wider uppercase",
            down === 0 ? "text-ink-dim" : "text-degraded",
          ].join(" ")}
        >
          {down === 0 ? "UP" : "DEGRADED"}
        </span>
      </header>

      {/* The hero. A 30-day window degrades gracefully — three missed days
          move 24/30 to 21/30. It cannot crash to zero, which is exactly why
          it, and not run length, is the number at the top of the screen. */}
      <section className="mb-8">
        <div className="tabular text-ink flex items-baseline gap-1.5 text-[4rem] leading-none font-medium">
          {uptime.up}
          <span className="text-ink-mute text-2xl">/{uptime.total}</span>
        </div>
        <p className="text-ink-mute mt-2.5 text-xs">
          days up · last 30d
          {run > 0 && (
            <>
              {" · "}
              <span className="text-ink-dim">current run {run}d</span>
            </>
          )}
        </p>

        {/* First run. Not an outage, not a failure — nothing has happened yet. */}
        {entries.length === 0 && (
          <p className="text-ink-dim mt-3 text-xs leading-relaxed">
            Nothing logged yet. One small real thing puts the system up today —
            any one of your levers. One is enough on its own.
          </p>
        )}

        {/* Good news, delivered in the identical flat line an alert would use —
            that symmetry is what stops it reading as praise. No colour, no
            motion, no badge, nothing awarded. */}
        {liveMilestone && MILESTONE_COPY[liveMilestone] && (
          <p className="text-ink-dim mt-3 text-xs leading-relaxed">
            {MILESTONE_COPY[liveMilestone]}
          </p>
        )}

        {down > 0 && (
          <p className="text-degraded mt-3 text-xs">
            down {down} {down === 1 ? "day" : "days"} — do the minimum, get it
            back up.
          </p>
        )}
      </section>

      <section className="mb-10">
        <DayGrid
          entries={entries}
          signals={status.signals}
          today={today}
          spans={status.leverSpans}
          labels={status.leverLabels}
        />
      </section>

      {/* The levers sit in the optical centre of the remaining space: this is
          the thing you open the app to press. */}
      <section className="mb-4 flex flex-col justify-center">
        <Levers
          levers={status.levers}
          playbook={playbook}
          todayLevers={[...todayLevers]}
        />
        {slammed && (
          <p className="text-ink-mute mt-3 text-xs">
            slammed mode — still one lever, still ten minutes of anything. the
            pager waits an extra day.
          </p>
        )}
      </section>

      <LastActivity entries={entries} today={today} />

      {/* Trails the content. The dashboard is deliberately five elements;
          stretching it to fill a tall screen reads as emptiness, not calm.
          Spread across the full width so each target is a comfortable thumb
          tap rather than a row of small words. */}
      <nav className="border-line mt-10 flex justify-between border-t pt-2">
        {[
          // No playbook tab. It still exists and still fills itself from what
          // you log — it just isn't a place you visit. Its whole job is to be
          // there in the lever sheet and on the takeover, which is where you
          // actually need it; browsing it was a screen that asked for upkeep
          // and gave nothing back.
          ["/history", "history"],
          ["/proof", "proof"],
          ["/settings", "settings"],
        ].map(([href, label]) => (
          <NavLink key={href} href={href} className="flex-1 justify-center">
            {label}
          </NavLink>
        ))}
      </nav>
    </main>
  );
}

function LastActivity({
  entries,
  today,
}: {
  entries: { logged_for: string; detail: string | null }[];
  today: string;
}) {
  const last = [...entries].reverse().find((e) => e.detail);
  if (!last) return null;

  return (
    <p className="text-ink-mute text-xs">
      last: <span className="text-ink-dim">{last.detail}</span> ·{" "}
      {last.logged_for === today ? "today" : last.logged_for}
    </p>
  );
}

function lastDetail(
  entries: { detail: string | null }[],
): string | null {
  return [...entries].reverse().find((e) => e.detail)?.detail ?? null;
}
