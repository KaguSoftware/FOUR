/**
 * The lever set.
 *
 * Lives in core rather than in the web app because every client needs the same
 * list, and because a client component cannot import it from `lib/system.ts`
 * without dragging `next/headers` into the browser bundle.
 *
 * SCOPE(v1): still the hardcoded pair, matching the CHECK constraint on
 * `entries.lever` and `playbook.lever`.
 * GROWS LATER → up to four user-defined levers read per user from a `levers`
 * table, with a stable `key` and a freely renameable `label`. This module is
 * the single seam that replacement goes through: consumers read the list from
 * here rather than writing their own literal, so the migration is one swap
 * instead of a grep.
 */

import type { Lever } from "./uptime";
import { MAX_LEVERS } from "./grid";

export const ACTIVE_LEVERS: readonly Lever[] = ["gym", "food"];

/** How many ramp steps the day grid has. Never exceeds MAX_LEVERS. */
export const leverCount = (): number =>
  Math.min(ACTIVE_LEVERS.length, MAX_LEVERS);
