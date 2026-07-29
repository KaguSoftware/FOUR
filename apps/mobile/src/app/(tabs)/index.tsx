import { useEffect } from "react";
import { Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import {
  applyToDay,
  MILESTONE_COPY,
  milestonePanel,
  type OutboxItem,
} from "@uptime/core";

import { Body, Label, Mono } from "@/components/ui";
import { DayGrid } from "@/components/day-grid";
import { LeverButtons } from "@/components/lever-buttons";
import { Screen } from "@/components/screen";
import { Takeover } from "@/components/takeover";
import { useStatus } from "@/lib/use-status";
import { useOutbox } from "@/lib/use-outbox";
import { archiveLever, reorderLevers } from "@/lib/levers";
import { syncTimeZone, type LeverRow, type LoggedEntry } from "@/lib/status";
import { color, radius, size, space, TAP } from "@/theme";

export default function StatusScreen() {
  const router = useRouter();
  const { status, loading, error, refresh } = useStatus();

  /**
   * Every lever tap goes through the outbox, online or not.
   *
   * There is no separate "offline path" to get wrong: the tap is written
   * locally, the screen updates from the queue, and sending is something that
   * happens afterwards whenever it can. That is what makes a tap in a gym
   * basement indistinguishable from one on wifi — and it is only safe because
   * every write is idempotent, so a retry is an update, never a duplicate.
   */
  const { queue, write } = useOutbox(status?.state.user_id, refresh);

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

  // The server's view with the queue laid on top. `applyToDay` is in core and
  // tested: the server list is the base and the queue only overrides the levers
  // it mentions, so one logged on another device still shows.
  const shownAsLogged = applyToDay(todayLevers, queue, today);

  // The grid reads entries, not the lever list, so it needs the same treatment
  // or the cell stays dark while the button says done — which reads as the tap
  // half-working.
  const shownEntries = [
    ...entries.filter(
      (e) => !(e.logged_for === today && !shownAsLogged.includes(e.lever)),
    ),
    ...shownAsLogged
      .filter((lever) => !todayLevers.includes(lever))
      .map((lever) => ({ logged_for: today, lever, detail: null })),
  ];

  // What one undo would take back: today's most recent tap, from whichever
  // source knows about it. A tap still sitting in the outbox has no server row
  // and no `created_at`, so its `queued_at` stands in — both are "when the
  // person pressed it", which is the only ordering that matters here.
  const undoable = levers.find(
    (l) => l.key === mostRecentToday(entries, queue, today, shownAsLogged),
  );

  // Down 3+ days: the dashboard is REPLACED, not annotated. A system with no
  // history has never been down, so a first run gets the normal empty state
  // rather than the outage screen.
  if (down >= 3 && entries.length > 0) {
    return (
      <Takeover
        down={down}
        levers={levers}
        playbook={playbook}
        todayLevers={shownAsLogged}
        lastRun={lastRun}
        lastDetail={lastDetail(entries)}
        posture={state.posture}
        busy={false}
        onLog={(lever, detail) => write(lever, "log", detail)}
      />
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={color.inkMute}
        />
      }
      headerRight={
        <Label style={{ color: down === 0 ? color.inkDim : color.degraded }}>
          {down === 0 ? "up" : "degraded"}
        </Label>
      }
    >
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
          entries={shownEntries}
          today={today}
          spans={status.leverSpans}
          mode="month"
        />
      </View>

      <LeverButtons
        levers={levers}
        todayLevers={shownAsLogged}
        // Opens the native sheet to attach WHAT you did. Optional, always —
        // the sheet's own "just mark it up" logs with no detail.
        onPress={(lever) =>
          router.push({ pathname: "/log", params: { lever: lever.key } })
        }
        // Adding is offered here because this is the screen where you notice a
        // lever is missing. Settings keeps the full manager.
        onAdd={() => router.push("/add-lever")}
        // Both of these already moved on screen — the grid reorders under your
        // finger, and the archived button leaves the moment you drop it. These
        // only make it stick, and say so if it didn't.
        onReorder={async (ids) => {
          const res = await reorderLevers(ids);
          if (!res.ok) Alert.alert("Didn't save", res.error);
          await refresh();
        }}
        onArchive={(lever) => confirmArchive(lever, state.user_id, refresh)}
      />

      {/* ONE undo, below everything, for whatever was tapped last.

          There used to be one per lever, rendered inside that lever's column.
          Logging one of two side-by-side levers made its column 48pt taller
          than its neighbour, so the whole grid reflowed on every tap — and
          four levers could put four undo buttons on screen at once. Down here
          it pushes nothing but the slammed note, and tapping it repeatedly
          walks back through today most-recent-first. */}
      {undoable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Undo ${undoable.label}`}
          onPress={() => write(undoable.key, "undo", null)}
          style={({ pressed }) => ({
            minHeight: TAP,
            marginTop: space[3],
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            backgroundColor: pressed ? color.surface : "transparent",
          })}
        >
          <Body tone="mute" style={{ fontSize: size.xs }}>
            undo — {undoable.label}
          </Body>
        </Pressable>
      )}

      {slammed && (
        <Body tone="mute" style={{ marginTop: space[3] }}>
          slammed mode — still one lever, still ten minutes of anything. the
          pager waits an extra day.
        </Body>
      )}
    </Screen>
  );
}

/**
 * Confirm before archiving a dragged lever.
 *
 * A drag is a much easier gesture to perform by accident than opening Settings
 * and tapping "archive", so the confirmation matters more here, not less. The
 * copy is the manager's, verbatim: what someone needs to know is that nothing
 * they already logged is going anywhere.
 */
function confirmArchive(
  lever: LeverRow,
  userId: string,
  refresh: () => Promise<void> | void,
) {
  Alert.alert(
    `Archive ${lever.label}?`,
    "Every day you already logged with it stays exactly as it is. The button just stops being offered.",
    [
      { text: "Cancel", style: "cancel", onPress: () => refresh() },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          const res = await archiveLever(userId, lever.id);
          if (!res.ok) Alert.alert("Didn't archive", res.error);
          await refresh();
        },
      },
    ],
  );
}

/**
 * The lever key of today's most recent tap, or null if nothing is logged.
 *
 * Two sources, because a tap can exist in either or both. The server knows
 * `created_at` for anything that landed; the outbox knows `queued_at` for
 * anything that has not. `shownAsLogged` is the arbiter of what currently
 * counts as logged — an entry the queue has already undone must not be
 * offered for undo a second time.
 */
function mostRecentToday(
  entries: readonly LoggedEntry[],
  queue: readonly OutboxItem[],
  today: string,
  shownAsLogged: string[],
): string | null {
  const stamps = new Map<string, number>();

  for (const e of entries) {
    if (e.logged_for !== today) continue;
    stamps.set(e.lever, Date.parse(e.created_at));
  }
  for (const q of queue) {
    if (q.logged_for !== today || q.op !== "log") continue;
    // A queued tap is newer than whatever the server had for that lever —
    // it is literally the thing that has not been sent yet.
    stamps.set(q.lever, q.queued_at);
  }

  let best: string | null = null;
  let bestAt = -Infinity;
  for (const [lever, at] of stamps) {
    if (!shownAsLogged.includes(lever)) continue;
    if (Number.isFinite(at) && at > bestAt) {
      best = lever;
      bestAt = at;
    }
  }
  return best;
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
