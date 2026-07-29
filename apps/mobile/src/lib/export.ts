import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { supabase } from "./supabase";
import { today } from "./status";

/**
 * Export the account as one JSON file, through the iOS share sheet.
 *
 * The honest answer to "where is my data". Everything the account has ever
 * written, queried straight from the tables under RLS — the same boundary
 * every other read uses — and handed to the platform's own share sheet, so
 * where it goes next (Files, AirDrop, mail) is the user's business.
 *
 * Raw rows, not derived figures: uptime, runs and outages are derived at read
 * time and would be stale the moment the file was written. Anyone holding the
 * entries can re-derive every number the app shows.
 */

export type ExportResult = { ok: true } | { ok: false; reason: string };

export async function exportData(userId: string): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, reason: "Sharing is not available on this device." };
  }

  const [state, levers, entries, playbook, signals] = await Promise.all([
    supabase.from("system_state").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("levers").select("*").eq("user_id", userId).order("position"),
    supabase
      .from("entries")
      .select("logged_for, lever, detail, created_at")
      .eq("user_id", userId)
      .order("logged_for"),
    supabase.from("playbook").select("*").eq("user_id", userId),
    supabase
      .from("signals")
      .select("observed_on, kind, value, amount, note")
      .eq("user_id", userId)
      .order("observed_on"),
  ]);

  const failed = [state, levers, entries, playbook, signals].find(
    (r) => r.error,
  );
  if (failed?.error) {
    return { ok: false, reason: "Couldn't read everything. Try again." };
  }

  // The push token is a device credential, not the user's data.
  const cleanState = { ...(state.data ?? {}) } as Record<string, unknown>;
  delete cleanState.push_token;
  delete cleanState.push_platform;

  const payload = {
    exported_at: new Date().toISOString(),
    system_state: cleanState,
    levers: levers.data ?? [],
    entries: entries.data ?? [],
    playbook: playbook.data ?? [],
    signals: signals.data ?? [],
  };

  try {
    const file = new File(Paths.cache, `four-export-${today()}.json`);
    file.write(JSON.stringify(payload, null, 2));
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Export data",
    });
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
  return { ok: true };
}
