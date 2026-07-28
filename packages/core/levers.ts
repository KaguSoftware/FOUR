/**
 * The lever set, and the rules for creating one.
 *
 * Lives in core rather than in the web app because every client needs the same
 * rules, and because a client component cannot import it from `lib/system.ts`
 * without dragging `next/headers` into the browser bundle.
 *
 * The central idea: a lever has a **stable key** and a **freely renameable
 * label**. Entries store the key. That split is what makes "rename freely,
 * archive never deletes" work — renaming `gym` to `training` keeps six months
 * of history because `entries.lever` still holds `gym`.
 */

import type { Lever } from "./uptime";
import { MAX_LEVERS } from "./grid";

/**
 * SCOPE(v1): still the hardcoded pair, matching the CHECK constraint on
 * `entries.lever` and `playbook.lever`.
 * GROWS LATER → read per user from a `levers` table.
 */
export const ACTIVE_LEVERS: readonly Lever[] = ["gym", "food"];

/** How many ramp steps the day grid has. Never exceeds MAX_LEVERS. */
export const leverCount = (): number =>
  Math.min(ACTIVE_LEVERS.length, MAX_LEVERS);

export const LEVER_KEY_MAX = 32;
export const LEVER_LABEL_MAX = 24;

/** A key is lowercase, alphanumeric plus single hyphens, never edge-hyphenated. */
const KEY_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidLeverKey(key: string): boolean {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= LEVER_KEY_MAX &&
    KEY_SHAPE.test(key)
  );
}

/**
 * Derive a key from a label.
 *
 * Falls back to `lever` when a label slugs to nothing, which is not an edge
 * case — it is every label written in a non-Latin script. "спорт" and "運動"
 * are perfectly good lever names and must not produce an empty key. The caller
 * disambiguates via `uniqueLeverKey`, so the fallback colliding is expected and
 * handled rather than a failure.
 */
export function slugifyLever(label: string): string {
  const slug = label
    .normalize("NFKD")
    // Strip combining marks so "café" slugs to "cafe" rather than losing the e.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LEVER_KEY_MAX)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : "lever";
}

/** A key that does not collide with `taken`, suffixing `-2`, `-3`, … */
export function uniqueLeverKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyLever(label);
  if (!used.has(base)) return base;

  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, LEVER_KEY_MAX - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("could not derive a unique lever key");
}

export type LeverLabelCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validate a label the user typed.
 *
 * Errors say what is wrong and how to fix it, because this is the first screen
 * a new user sees and a vague rejection there is a lost user.
 */
export function validateLeverLabel(label: string): LeverLabelCheck {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Give the lever a name." };
  if (trimmed.length > LEVER_LABEL_MAX) {
    return {
      ok: false,
      reason: `Keep it under ${LEVER_LABEL_MAX} characters so it fits the button.`,
    };
  }
  return { ok: true };
}

/** Whether another lever can be added. Four is the ceiling. */
export function canAddLever(currentActive: number): boolean {
  return currentActive < MAX_LEVERS;
}
