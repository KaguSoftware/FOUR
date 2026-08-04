import { useRef } from "react";
import { View, type ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Body, Label, Mono, Rule } from "@/components/ui";
import { MonthStack } from "@/components/day-grid";
import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { TourOverlay, useTourOn } from "@/components/tour";
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
  const router = useRouter();
  const { status } = useStatus();
  // The first-run tour passes through here for one step — it spotlights the
  // month pager. See components/tour.tsx.
  const tourHere = useTourOn("history");
  const scrollRef = useRef<ScrollView>(null);
  const monthsRef = useRef<View>(null);
  if (!status) return <Loading />;

  const { entries, today, runs, outages, allTime, leverSpans } = status;

  // Interleaved by start date, newest first. Deliberately one list: two lists
  // would rank runs above outages and imply outages are the exceptional case.
  const events = [
    ...runs.map((r) => ({ kind: "run" as const, ...r })),
    ...outages.map((o) => ({ kind: "outage" as const, ...o })),
  ].sort((a, b) => (a.started_on < b.started_on ? 1 : -1));

  return (
    <View style={{ flex: 1 }}>
    <Screen scrollRef={scrollRef} scrollEnabled={!tourHere}>
      {/* All-time figures are monotonic by construction — they only ever go up,
          so there is nothing here that a bad month can take away. They lead the
          screen because the stack below is as long as the account is old, and
          the summary that matters most during a bad week cannot be the thing
          you have to scroll past a year of calendar to reach. */}
      <View style={{ flexDirection: "row", gap: space[8] }}>
        <Figure label="days up, all time" value={allTime.totalDaysUp} />
        <Figure label="longest run" value={allTime.longestRun} unit="d" />
      </View>

      {/* Calendar months rather than a dense block of ninety squares. Each
          month names itself and says how much of it was up, so the span is
          never a guess — and seven columns mean a column IS a weekday, which
          is the question this screen exists to answer.

          One per swipe, not a stack. A year-old account turned this screen
          into thirteen calendars you scrolled past to reach the incidents;
          months are peers you compare, not a single long document. */}
      <View ref={monthsRef} collapsable={false} style={{ marginTop: space[8] }}>
        <MonthStack
          entries={entries}
          today={today}
          spans={leverSpans}
          onPressDay={(date) =>
            router.push({ pathname: "/day", params: { date } })
          }
        />
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

    {tourHere && (
      <TourOverlay
        screen="history"
        targets={{ months: monthsRef }}
        scrollRef={scrollRef}
      />
    )}
    </View>
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
