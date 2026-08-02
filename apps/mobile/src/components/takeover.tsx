import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Interval } from "@uptime/core";
import { androidMetrics, Body, Label, Mono } from "./ui";
import { committed } from "@/lib/haptics";
import { pressFill, pressFillFlat, ripple } from "@/lib/press";
import { color, radius, size, space, TAB_BAR, TAP } from "@/theme";
import type { LeverRow, PlaybookItem } from "@/lib/status";

/**
 * Re-entry. Replaces the whole screen at three or more days down.
 *
 * Every rule here is deliberate and each one survives the port:
 *   - **No uptime figure.** It is at its worst exactly now; showing it is
 *     counterproductive.
 *   - **No zero anywhere.** The last completed run is reported with its final
 *     length, because a break is an outage, not a wipe.
 *   - **No navigation.** There is exactly one thing to do here.
 *   - **There is always a reachable action.** The playbook is empty for every
 *     new account, so "just mark it up" is the floor of this screen, not a
 *     nicety. A takeover with nothing tappable is the worst dead end this
 *     product could ship.
 */
export function Takeover({
  down,
  levers,
  playbook,
  todayLevers,
  lastRun,
  lastDetail,
  busy,
  onLog,
}: {
  down: number;
  levers: LeverRow[];
  playbook: PlaybookItem[];
  todayLevers: string[];
  lastRun: Interval | null;
  lastDetail: string | null;
  busy: boolean;
  onLog: (lever: string, detail: string | null) => void;
}) {
  const insets = useSafeAreaInsets();

  // Ranked by what has actually worked for this person — pinned, then use
  // count, which is the order the query already returns. This used to put the
  // food lever first, on the principle that coming back must be lighter than
  // starting; that cannot survive user-defined levers, since we have no way to
  // know which of someone's levers is the light one.
  const options = [...playbook]
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
    .slice(0, 3);

  const byKey = new Map(levers.map((l) => [l.key, l.label]));

  function log(lever: string, detail: string | null) {
    committed();
    onLog(lever, detail);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: color.bg }}
        // JS owns the insets here, same as `Screen` — see its docblock. Left
        // automatic, UIKit adds its own on top a frame late and the screen jumps.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + space[10],
          // The tab bar is still over this screen even though the takeover
          // offers no navigation of its own, so "last run" needs the same
          // allowance every other tab screen gets.
          paddingBottom: insets.bottom + TAB_BAR + space[8],
          paddingHorizontal: space[5],
        }}
      >
        {/* Top of the screen, not centred: the first thing your eye lands on. */}
        <Text
          style={{
            ...androidMetrics,
            fontFamily: "Inter_500Medium",
            fontSize: size["2xl"],
            color: color.down,
            letterSpacing: -0.3,
          }}
        >
          DOWN {down} DAYS
        </Text>

        <Label style={{ marginTop: space[8], marginBottom: space[2] }}>
          Minimum to get back up
        </Label>

        <View style={{ gap: space[2] }}>
          {options.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              disabled={busy || todayLevers.includes(item.lever)}
              onPress={() => log(item.lever, item.label)}
              android_ripple={ripple()}
              style={({ pressed }) => ({
                minHeight: 64,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.lineHi,
                backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
                justifyContent: "center",
                paddingHorizontal: space[4],
                opacity: todayLevers.includes(item.lever) ? 0.4 : 1,
              })}
            >
              <Text
                style={{
                  ...androidMetrics,
                  fontFamily: "Inter_400Regular",
                  fontSize: size.sm,
                  color: color.ink,
                }}
              >
                {item.label}
                {"  "}
                <Text style={{ color: color.inkMute, fontSize: size.xs }}>
                  {/* The label, never the stored key — a key is a slug like
                    `morning-pages` and nobody chose to read that. */}
                  {byKey.get(item.lever) ?? item.lever}
                </Text>
              </Text>
            </Pressable>
          ))}
        </View>

        {/* The floor. Logging with no detail attached still puts the day up —
          the detail was always the optional half. */}
        <Label style={{ marginTop: space[6], marginBottom: space[2] }}>
          {options.length > 0 ? "or just mark it up" : "your levers"}
        </Label>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {levers.map((lever, i) => {
            const full =
              levers.length === 1 || (levers.length === 3 && i === 2);
            const done = todayLevers.includes(lever.key);
            return (
              <Pressable
                key={lever.key}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${lever.label} up`}
                disabled={busy || done}
                onPress={() => log(lever.key, null)}
                android_ripple={ripple()}
                style={({ pressed }) => ({
                  flexBasis: full ? "100%" : "47%",
                  flexGrow: 1,
                  minHeight: TAP,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  // Secondary to the options above, and the hierarchy is carried
                  // by fill and text weight — never by a fainter border. These
                  // have no fill, so the stroke is the entire button and owes
                  // WCAG 1.4.11's 3:1. `line` measures 1.45:1; `lineHi` 3.33:1.
                  borderColor: color.lineHi,
                  backgroundColor: pressFillFlat(color.surfaceHi, pressed),
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: done ? 0.4 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    ...androidMetrics,
                    fontFamily: "Inter_400Regular",
                    fontSize: size.sm,
                    color: color.inkDim,
                  }}
                >
                  {lever.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Reported as a completed thing with a final length. There is no counter
          here that got reset — that is the entire point. */}
        {lastRun && (
          <Body tone="mute" style={{ marginTop: space[8] }}>
            last run:{" "}
            <Mono style={{ color: color.inkDim }}>{lastRun.days}</Mono> days
            {lastDetail ? ` · ${lastDetail}` : ""}
          </Body>
        )}
      </ScrollView>

      {/* DOWN N DAYS scrolling under the system clock is the last thing this
        screen should do. Same solid scrim as every other screen. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: color.bg,
        }}
      />
    </View>
  );
}
