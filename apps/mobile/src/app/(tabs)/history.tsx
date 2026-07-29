import { View } from "react-native";
import { uptimeWindow } from "@uptime/core";
import { Body, Label, Mono, Rule } from "@/components/ui";
import { DayGrid } from "@/components/day-grid";
import { Screen } from "@/components/screen";
import { useStatus } from "@/lib/use-status";
import { color, size, space } from "@/theme";

/**
 * The incident log.
 *
 * Runs and outages render as PEERS in one chronological list — a break is an
 * incident with a name and an end date, not a failure. History is never
 * truncated and never reset.
 */
export default function HistoryScreen() {
  const { status } = useStatus();
  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  const { entries, today, runs, outages, allTime, leverSpans } = status;

  // Interleaved by start date, newest first. Deliberately one list: two lists
  // would rank runs above outages and imply outages are the exceptional case.
  const events = [
    ...runs.map((r) => ({ kind: "run" as const, ...r })),
    ...outages.map((o) => ({ kind: "outage" as const, ...o })),
  ].sort((a, b) => (a.started_on < b.started_on ? 1 : -1));

  // Named `span`, not `window` — that shadows the global and reads as a typo.
  const span = uptimeWindow(entries, today, 90);

  return (
    <Screen>
      {/* The grid used to be 90 unlabelled squares. Status says what its own
          grid covers; this one said nothing at all, so the span was a guess. */}
      <Label style={{ marginBottom: space[3] }}>
        last 90 days · {span.up} up
      </Label>

      <DayGrid entries={entries} today={today} spans={leverSpans} days={90} />

      {/* All-time figures are monotonic by construction — they only ever go up,
          so there is nothing here that a bad month can take away. */}
      <View style={{ flexDirection: "row", gap: space[8], marginTop: space[8] }}>
        <Figure label="days up, all time" value={allTime.totalDaysUp} />
        <Figure label="longest run" value={allTime.longestRun} unit="d" />
      </View>

      <Label style={{ marginTop: space[10], marginBottom: space[3] }}>
        incidents
      </Label>

      {events.length === 0 ? (
        <Body tone="mute">Nothing yet. The log starts on your first day up.</Body>
      ) : (
        events.map((e) => (
          <View key={`${e.kind}-${e.started_on}`}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: space[3],
                paddingVertical: space[3],
              }}
            >
              <View style={{ flex: 1 }}>
                <Body tone={e.kind === "run" ? "dim" : "degraded"}>
                  {e.kind === "run" ? "run" : "outage"}
                </Body>
                {/* Both ends, not just the start. An interval that showed only
                    where it began read as ongoing whether it was or not — and
                    "→ now" is the whole difference between a finished outage
                    and the one you are currently in. */}
                <Mono
                  style={{
                    fontSize: size.xs,
                    color: color.inkMute,
                    marginTop: space[1],
                  }}
                >
                  {e.started_on} → {e.ended_on ?? "now"}
                </Mono>
              </View>
              <Body tone="mute">
                <Mono style={{ color: color.inkDim, fontSize: size.xs }}>
                  {e.days}
                </Mono>
                {" d"}
              </Body>
            </View>
            <Rule />
          </View>
        ))
      )}
    </Screen>
  );
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <View>
      <Mono style={{ fontSize: size.xl, fontFamily: "JetBrainsMono_500Medium" }}>
        {value}
        {unit ?? ""}
      </Mono>
      <Label style={{ marginTop: space[1] }}>{label}</Label>
    </View>
  );
}
