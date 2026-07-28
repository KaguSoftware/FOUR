import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { MILESTONE_COPY, milestonePanel } from "@uptime/core";

import { Body, Label, Mono, Wordmark } from "@/components/ui";
import { DayGrid } from "@/components/day-grid";
import { LeverButtons } from "@/components/lever-buttons";
import { Takeover } from "@/components/takeover";
import { useStatus } from "@/lib/use-status";
import { logEntry, syncTimeZone, undoEntry } from "@/lib/status";
import { color, radius, size, space } from "@/theme";

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, loading, error, refresh } = useStatus();
  const [busy, setBusy] = useState(false);

  // The phone derives its own logical day and never reads `timezone`, but the
  // server-side monitor does. If it drifts, the pager fires on a different day
  // than the one on screen. In an effect, not in render — a write during render
  // fires on every re-render and is not something React guarantees to run once.
  const userId = status?.state.user_id;
  const storedZone = status?.state.timezone;
  useEffect(() => {
    const deviceZone = Localization.getCalendars()[0]?.timeZone;
    if (userId && deviceZone && deviceZone !== storedZone) {
      syncTimeZone(userId, deviceZone);
    }
  }, [userId, storedZone]);

  if (!status) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, padding: space[5] }}>
        {!loading && <Body tone="mute">{error ?? "Signed out."}</Body>}
      </View>
    );
  }

  const {
    today,
    entries,
    levers,
    playbook,
    todayLevers,
    uptime,
    run,
    down,
    lastRun,
    liveMilestone,
    slammed,
    state,
  } = status;

  async function log(lever: string, detail: string | null) {
    setBusy(true);
    await logEntry(state.user_id, lever, detail);
    await refresh();
    setBusy(false);
  }

  // Down 3+ days: the dashboard is REPLACED, not annotated. A system with no
  // history has never been down, so a first run gets the normal empty state
  // rather than the outage screen.
  if (down >= 3 && entries.length > 0) {
    return (
      <Takeover
        down={down}
        levers={levers}
        playbook={playbook}
        todayLevers={todayLevers}
        lastRun={lastRun}
        lastDetail={lastDetail(entries)}
        posture={state.posture}
        busy={busy}
        onLog={log}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[5],
        paddingBottom: space[12],
      }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={color.inkMute}
        />
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[8],
        }}
      >
        <Wordmark />
        <Label style={{ color: down === 0 ? color.inkDim : color.degraded }}>
          {down === 0 ? "up" : "degraded"}
        </Label>
      </View>

      {/* The hero. A 30-day window degrades gracefully — three missed days move
          24/30 to 21/30. It cannot crash to zero, which is exactly why it, and
          not run length, is the number at the top of the screen.

          It keeps its scale. Native type systems pull toward conventional
          heading sizes; if this shrinks into the platform's ramp the dashboard
          becomes a list with a number on it. */}
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Mono
          style={{
            fontFamily: "JetBrainsMono_500Medium",
            fontSize: size.hero,
            lineHeight: size.hero * 1.05,
          }}
        >
          {uptime.up}
        </Mono>
        <Mono style={{ fontSize: size.xl, color: color.inkMute }}>
          /{uptime.total}
        </Mono>
      </View>

      <Body tone="mute" style={{ marginTop: space[2] }}>
        days up · last 30d
        {run > 0 ? (
          <Text style={{ color: color.inkDim }}> · current run {run}d</Text>
        ) : null}
      </Body>

      {/* First run. Not an outage, not a failure — nothing has happened yet. */}
      {entries.length === 0 && (
        <Body tone="dim" style={{ marginTop: space[3] }}>
          Nothing logged yet. One small real thing puts the system up today —
          any one of your levers. One is enough on its own.
        </Body>
      )}

      {liveMilestone && MILESTONE_COPY[liveMilestone] && (
        <Milestone kind={liveMilestone} posture={state.posture} />
      )}

      {down > 0 && (
        <Body tone="degraded" style={{ marginTop: space[3] }}>
          down {down} {down === 1 ? "day" : "days"} — do the minimum, get it
          back up.
        </Body>
      )}

      <View style={{ marginTop: space[8], marginBottom: space[10] }}>
        <DayGrid
          entries={entries}
          today={today}
          leverCount={status.leverCount}
        />
      </View>

      <LeverButtons
        levers={levers}
        todayLevers={todayLevers}
        busy={busy}
        // Opens the native sheet to attach WHAT you did. Optional, always —
        // the sheet's own "just mark it up" logs with no detail.
        onPress={(lever) =>
          router.push({ pathname: "/log", params: { lever: lever.key } })
        }
        onUndo={async (lever) => {
          setBusy(true);
          await undoEntry(state.user_id, lever.key);
          await refresh();
          setBusy(false);
        }}
      />

      {slammed && (
        <Body tone="mute" style={{ marginTop: space[3] }}>
          slammed mode — still one lever, still ten minutes of anything. the
          pager waits an extra day.
        </Body>
      )}
    </ScrollView>
  );
}

/**
 * Good news, and the only other place posture is visible. STRICT delivers it in
 * the identical flat line an alert would use — that symmetry is what stops it
 * reading as praise. SOFT may acknowledge it in a panel. No colour, no motion,
 * no badge, nothing awarded in either.
 */
function Milestone({
  kind,
  posture,
}: {
  kind: string;
  posture: Parameters<typeof milestonePanel>[0];
}) {
  const panel = milestonePanel(posture, kind);

  if (!panel) {
    return (
      <Body tone="dim" style={{ marginTop: space[3] }}>
        {MILESTONE_COPY[kind]}
      </Body>
    );
  }

  return (
    <View
      style={{
        marginTop: space[4],
        padding: space[3],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.line,
        backgroundColor: color.surface,
      }}
    >
      <Body tone="ink">{panel.title}</Body>
      <Body tone="mute" style={{ marginTop: space[1] }}>
        {panel.note}
      </Body>
    </View>
  );
}

function lastDetail(entries: { detail: string | null }[]): string | null {
  return [...entries].reverse().find((e) => e.detail)?.detail ?? null;
}
