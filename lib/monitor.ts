/**
 * The monitor: fade detection, milestones, and the plateau check.
 *
 * Two distinct failure modes are watched here, and conflating them would be a
 * mistake:
 *
 *   1. The FADE — you stopped logging. Caught by `evaluateFade`.
 *   2. The PLATEAU — you're logging every day while return-on-effort goes
 *      flat. Invisible to uptime, and it is where a long run actually dies.
 *
 * Both report on the system. Neither passes judgement on the operator.
 */

import type { Entry } from "./uptime";
import { currentRun, uptimeWindow } from "./uptime";

export type FadeAction =
  | { kind: "none"; reason: string }
  | { kind: "page"; level: number; text: string };

/**
 * Fade thresholds. Slammed mode moves these out rather than silencing them —
 * crunch is exactly when a pause turns permanent, so the monitor must survive
 * it. Past a week it drops to weekly: daily nagging becomes noise you mute,
 * and a muted monitor is a dead monitor.
 */
export function evaluateFade(opts: {
  down: number;
  slammed: boolean;
  today: string;
  lastPagedOn: string | null;
  lastPagedLevel: number | null;
  topPlaybook: string[];
}): FadeAction {
  const { down, slammed, today, lastPagedOn, lastPagedLevel, topPlaybook } = opts;
  const firstAt = slammed ? 3 : 2;

  if (down < firstAt) {
    return { kind: "none", reason: `down ${down}, below threshold ${firstAt}` };
  }

  // At most one page per day, even if cron double-fires.
  if (lastPagedOn === today) {
    return { kind: "none", reason: "already paged today" };
  }

  const weeklyAt = slammed ? 8 : 7;
  if (down >= weeklyAt) {
    // Past a week: weekly cadence only.
    if (lastPagedOn) {
      const daysSince = daysBetweenISO(lastPagedOn, today);
      if (daysSince < 7) {
        return { kind: "none", reason: `weekly cadence, ${daysSince}d since last` };
      }
    }
    return {
      kind: "page",
      level: 3,
      text: [
        `DOWN ${down} DAYS`,
        "",
        "Still down. One small thing puts it back up.",
        ...topPlaybook.slice(0, 2).map((p) => `→ ${p}`),
      ].join("\n"),
    };
  }

  const level = down >= 3 ? 2 : 1;
  // Don't re-send the same tier repeatedly.
  if (lastPagedLevel === level && lastPagedOn) {
    const daysSince = daysBetweenISO(lastPagedOn, today);
    if (daysSince < 2) {
      return { kind: "none", reason: `level ${level} already sent ${daysSince}d ago` };
    }
  }

  const text =
    level === 1
      ? [
          `DOWN ${down} DAYS`,
          "",
          "Do the minimum, get it back up.",
        ].join("\n")
      : [
          `DOWN ${down} DAYS`,
          "",
          "Minimum to get back up:",
          ...topPlaybook.slice(0, 2).map((p) => `→ ${p}`),
        ].join("\n");

  return { kind: "page", level, text };
}

// --- milestones -------------------------------------------------------------

export const RUN_MILESTONES = [7, 14, 30, 60, 90, 180, 365] as const;
export const UPTIME_MILESTONES = [80, 90] as const;

export const MILESTONE_COPY: Record<string, string> = Object.fromEntries([
  ...RUN_MILESTONES.map((d) => [`run_${d}`, `system stable — ${d} days up`]),
  ...UPTIME_MILESTONES.map((p) => [`uptime_${p}`, `uptime holding — ${p}%+ this month`]),
]);

/**
 * Which milestones have been reached but never acknowledged.
 *
 * Each fires once ever — the `milestones` primary key enforces it at the
 * database level rather than trusting application logic. Re-crossing 14 days
 * on a later run is silent, so there is nothing to farm.
 */
export function pendingMilestones(opts: {
  entries: Entry[];
  today: string;
  alreadyFired: Set<string>;
}): string[] {
  const { entries, today, alreadyFired } = opts;
  const run = currentRun(entries, today);
  const { up, total } = uptimeWindow(entries, today);
  const pct = (up / total) * 100;

  const hit: string[] = [];
  for (const d of RUN_MILESTONES) {
    if (run >= d && !alreadyFired.has(`run_${d}`)) hit.push(`run_${d}`);
  }
  for (const p of UPTIME_MILESTONES) {
    if (pct >= p && !alreadyFired.has(`uptime_${p}`)) hit.push(`uptime_${p}`);
  }
  return hit;
}

/**
 * At most one milestone message in a 7-day span; the highest wins and the
 * others are marked seen silently. Rare is what keeps it from being noise.
 */
export function pickMilestone(pending: string[]): string | null {
  if (!pending.length) return null;
  // Run milestones outrank uptime ones at equal magnitude: "30 days up" is a
  // more meaningful thing to report than the percentage that implies it.
  const weight = (k: string) => {
    const n = Number(k.split("_")[1]);
    return k.startsWith("run_") ? n * 10 + 1 : n;
  };
  return [...pending].sort((a, b) => weight(b) - weight(a))[0];
}

// --- plateau ----------------------------------------------------------------

export type SignalPoint = { observed_on: string; kind: string; value: number | null };

/**
 * The plateau check.
 *
 * Detects "UP, but flat": high uptime while felt-state signals stop moving.
 * Absence of data is NOT a flat line — a skipped weekly check means we know
 * nothing, and inventing a downward trend from silence would be both wrong
 * and demoralising.
 */
export function evaluatePlateau(opts: {
  signals: SignalPoint[];
  uptimePct: number;
  today: string;
  lastPlateauOn: string | null;
  weeks?: number;
}): { flat: boolean; reason: string } {
  const { signals, uptimePct, today, lastPlateauOn, weeks = 4 } = opts;

  if (uptimePct < 70) return { flat: false, reason: "uptime too low; fade owns this" };

  if (lastPlateauOn && daysBetweenISO(lastPlateauOn, today) < 42) {
    return { flat: false, reason: "within 6-week cooldown" };
  }

  const scalar = signals
    .filter((s) => s.value !== null && (s.kind === "energy" || s.kind === "sleep"))
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on));

  // Group by week of observation.
  const byWeek = new Map<string, number[]>();
  for (const s of scalar) {
    const list = byWeek.get(s.observed_on) ?? [];
    list.push(s.value!);
    byWeek.set(s.observed_on, list);
  }

  const weekAvgs = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, vals]) => vals.reduce((x, y) => x + y, 0) / vals.length);

  if (weekAvgs.length < weeks) {
    return { flat: false, reason: `only ${weekAvgs.length} weeks sampled` };
  }

  const recent = weekAvgs.slice(-weeks);
  const first = recent[0];
  const last = recent[recent.length - 1];

  // Flat or declining across the window.
  const flat = last - first <= 0.25;
  return {
    flat,
    reason: flat
      ? `signals flat ${weeks} weeks (${first.toFixed(1)} → ${last.toFixed(1)})`
      : `signals rising (${first.toFixed(1)} → ${last.toFixed(1)})`,
  };
}

export function plateauText(weekNo: number, suggestions: string[]): string {
  return [
    `WEEK ${weekNo} — UP, BUT FLAT`,
    "",
    "uptime fine. signals flat 4 weeks.",
    "this is where it usually stops.",
    "",
    "change one variable:",
    ...suggestions.slice(0, 2).map((s) => `→ ${s}`),
  ].join("\n");
}

// --- util -------------------------------------------------------------------

function daysBetweenISO(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86_400_000);
}
