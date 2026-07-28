import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Label, Mono, Rule, Wordmark } from "@/components/ui";
import { DayGrid } from "@/components/day-grid";
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
  const insets = useSafeAreaInsets();
  const { status } = useStatus();
  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  const { entries, today, runs, outages, allTime, leverCount } = status;

  // Interleaved by start date, newest first. Deliberately one list: two lists
  // would rank runs above outages and imply outages are the exceptional case.
  const events = [
    ...runs.map((r) => ({ kind: "run" as const, ...r })),
    ...outages.map((o) => ({ kind: "outage" as const, ...o })),
  ].sort((a, b) => (a.started_on < b.started_on ? 1 : -1));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[5],
        paddingBottom: space[12],
      }}
    >
      <View style={{ marginBottom: space[8] }}>
        <Wordmark />
      </View>

      <DayGrid
        entries={entries}
        today={today}
        leverCount={leverCount}
        days={90}
      />

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
                paddingVertical: space[3],
              }}
            >
              <Body tone={e.kind === "run" ? "dim" : "degraded"}>
                {e.kind === "run" ? "run" : "outage"}
                <Body tone="mute">{"  "}{e.started_on}</Body>
              </Body>
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
    </ScrollView>
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
