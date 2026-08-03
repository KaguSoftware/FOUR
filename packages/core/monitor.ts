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
import { MOOD_KIND, MOOD_MAX, MOOD_MIN } from "./mood";

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
 * A week is only a data point if it was actually sampled. Below this, the week
 * is treated as unknown and dropped — one stray Tuesday is not a week's mood.
 */
const MIN_DAYS_PER_WEEK = 3;

/**
 * How many consecutive sampled weeks must go nowhere before this pages.
 *
 * SCOPE(v1): an educated guess, not a measured one. GROWS LATER → retune once
 * ~6 weeks of real signal data exists.
 */
const PLATEAU_WEEKS = 4;

/**
 * How much of the scale's own range counts as "went nowhere", 0..1.
 *
 * **Normalised, and that is the point.** This was `0.25` compared against raw
 * values, which was 6.25% of the old 1–5 energy scale. When the reading moved
 * to a 1–100 mood slider the same literal became 0.25% of the range — a
 * threshold nothing could ever clear, so every month would have read as a
 * plateau and the pager would have fired constantly. Comparing fractions of
 * the range keeps the meaning fixed no matter what the control is.
 */
const PLATEAU_FLAT_FRACTION = 0.0625;

/**
 * The plateau check.
 *
 * Detects "UP, but flat": high uptime while felt-state signals stop moving.
 * Absence of data is NOT a flat line — a skipped check means we know nothing,
 * and inventing a downward trend from silence would be both wrong and
 * demoralising.
 *
 * The check reads daily samples but still reasons in weeks. Comparing raw days
 * would make a plateau fire after four quiet days, which is a mood, not a
 * trend; the thing worth paging about is a month that went nowhere. So days are
 * folded into real ISO weeks, and a week needs MIN_DAYS_PER_WEEK samples before
 * it counts at all.
 */
export function evaluatePlateau(opts: {
  signals: SignalPoint[];
  uptimePct: number;
  today: string;
  lastPlateauOn: string | null;
  weeks?: number;
}): { flat: boolean; reason: string } {
  const { signals, uptimePct, today, lastPlateauOn, weeks = PLATEAU_WEEKS } = opts;

  if (uptimePct < 70) return { flat: false, reason: "uptime too low; fade owns this" };

  if (lastPlateauOn && daysBetweenISO(lastPlateauOn, today) < 42) {
    return { flat: false, reason: "within 6-week cooldown" };
  }

  // `mood` only. The old `energy` and `sleep` kinds are still in the table and
  // still readable in the day sheet, but nothing writes them any more — mixing
  // a historical 1–5 rating into a 1–100 average would produce a number that
  // is not on either scale.
  const scalar = signals
    .filter((s) => s.value !== null && s.kind === MOOD_KIND)
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on));

  // Group by the ISO week the day falls in, not by the day itself.
  const byWeek = new Map<string, number[]>();
  for (const s of scalar) {
    const key = isoWeekKey(s.observed_on);
    const list = byWeek.get(key) ?? [];
    list.push(s.value!);
    byWeek.set(key, list);
  }

  const weekAvgs = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    // One row per sampled day, so this is a day count.
    .filter(([, vals]) => vals.length >= MIN_DAYS_PER_WEEK)
    .map(([, vals]) => vals.reduce((x, y) => x + y, 0) / vals.length);

  if (weekAvgs.length < weeks) {
    return { flat: false, reason: `only ${weekAvgs.length} weeks sampled` };
  }

  const recent = weekAvgs.slice(-weeks);
  const first = recent[0];
  const last = recent[recent.length - 1];

  // Flat or declining across the window, measured as a fraction of the scale
  // rather than in raw points — see PLATEAU_FLAT_FRACTION.
  const range = MOOD_MAX - MOOD_MIN;
  const moved = (last - first) / range;
  const flat = moved <= PLATEAU_FLAT_FRACTION;
  return {
    flat,
    reason: flat
      ? `signals flat ${weeks} weeks (${first.toFixed(0)} → ${last.toFixed(0)})`
      : `signals rising (${first.toFixed(0)} → ${last.toFixed(0)})`,
  };
}

export function plateauText(weekNo: number, suggestions: string[]): string {
  return [
    `WEEK ${weekNo} — UP, BUT FLAT`,
    "",
    `uptime fine. signals flat ${PLATEAU_WEEKS} weeks.`,
    "this is where it usually stops.",
    "",
    "change one variable:",
    ...suggestions.slice(0, 2).map((s) => `→ ${s}`),
  ].join("\n");
}

// --- util -------------------------------------------------------------------

/**
 * The ISO week a `YYYY-MM-DD` date belongs to, as a sortable `YYYY-Www` key.
 *
 * Weeks start Monday. The date is already a logical date (04:00 boundary
 * applied upstream by `logicalDate`), so this is pure calendar arithmetic —
 * never build a `Date` from a bare date string anywhere else.
 */
export function isoWeekKey(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // Shift to the Thursday of this week; the ISO year is whatever year that
  // Thursday lands in, which is what makes year boundaries come out right.
  const dow = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - dow + 3);
  const isoYear = t.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week =
    1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function daysBetweenISO(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86_400_000);
}
