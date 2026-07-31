import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { dayDetail } from "@uptime/core";
import { Body, Label, Mono } from "@/components/ui";
import { cachedStatus } from "@/lib/use-status";
import { color, radius, size, space } from "@/theme";
import { SheetHandle } from "@/components/sheet";

/**
 * What a day held.
 *
 * The grid says how much of a day fired; this says what it was. It is
 * deliberately READ-ONLY. Logging stays a thing you do on the day itself —
 * uptime, runs and outages are derived from the entries, so a screen that
 * could edit a past day would make every figure in the product retroactively
 * negotiable, and a record you can quietly fix is not a record.
 *
 * **The register matters more here than anywhere else.** A blank cell in the
 * grid can be read past; a sheet that opens and announces you did nothing
 * cannot. So an empty day states the fact and stops — no second person, no
 * encouragement, no "yet". The grid already makes the only judgement this
 * product makes about a day and does not repeat it in words.
 */
export default function DaySheet() {
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  /**
   * Read once from the cache, deliberately NOT `useStatus()` — same reason as
   * the log sheet: iOS measures this sheet to size it, so fetching here would
   * mount it nearly empty, measure that, then resize as the data lands.
   */
  const [status] = useState(cachedStatus);

  if (!status || !date) return null;

  const detail = dayDetail(
    date,
    status.entries,
    status.signals,
    status.leverLabels,
    status.today,
  );
  const notes = detail.signals.filter((s) => s.detail);
  const scalars = detail.signals.filter((s) => s.value !== null);
  const nothing = detail.empty && detail.signals.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space[5],
        paddingBottom: space[5] + insets.bottom,
        gap: space[4],
      }}
    >
      <SheetHandle />
      <Label>{longDate(date)}</Label>

      {detail.future ? (
        <Body tone="mute">Hasn&rsquo;t happened yet.</Body>
      ) : nothing ? (
        <Body tone="mute">No entry for this day.</Body>
      ) : (
        <>
          {detail.levers.map((l) => (
            <View
              key={l.key}
              style={{
                backgroundColor: color.surfaceHi,
                borderColor: color.line,
                borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: space[3],
                paddingVertical: space[3],
                gap: space[1],
              }}
            >
              <Body tone="ink">{l.label}</Body>
              {l.detail && <Body tone="dim">{l.detail}</Body>}
            </View>
          ))}

          {/* A day with signals but no lever is a real state: you wrote
              something down without firing anything. Saying so is more use
              than a sheet that just looks half-empty. */}
          {detail.levers.length === 0 && <Body tone="mute">No lever logged.</Body>}

          {scalars.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[5] }}>
              {scalars.map((s) => (
                <View
                  key={s.kind}
                  style={{ flexDirection: "row", alignItems: "baseline", gap: space[1] }}
                >
                  <Mono style={{ color: color.ink, fontSize: size.sm }}>
                    {s.value}
                  </Mono>
                  <Mono style={{ color: color.inkMute, fontSize: size.xs }}>
                    {s.kind}
                  </Mono>
                </View>
              ))}
            </View>
          )}

          {notes.map((s) => (
            <Body key={`${s.kind}-note`} tone="dim">
              {s.detail}
            </Body>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/** "jul 29, 2026" — split as text, never parsed through `Date`, which shifts it. */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}
