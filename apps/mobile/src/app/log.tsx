import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Body, Label } from "@/components/ui";
import { cachedStatus } from "@/lib/use-status";
import { queueWrite } from "@/lib/outbox";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * The optional half of one tap.
 *
 * Tapping a lever logs the day. Full stop. This sheet exists only to attach
 * *what* you did, and every route out of it is a valid log — including
 * dismissing it by swiping down, which still leaves the day up, because the
 * entry is written the moment you choose anything here and "just mark it up"
 * is always offered.
 *
 * Ranked by what has actually worked, so restarting is reopening a file rather
 * than reinventing anything. An empty playbook is a working screen: the button
 * at the bottom needs no history at all.
 */
export default function LogSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lever } = useLocalSearchParams<{ lever: string }>();
  /**
   * Read once from the cache, deliberately NOT `useStatus()`.
   *
   * iOS measures this sheet's content to size it (`fitToContents`). Fetching
   * here meant mounting nearly empty, being measured at that height, then
   * filling and resizing — a jolt on every open. The dashboard that launched
   * this sheet already loaded everything it needs, so re-fetching bought
   * nothing but the jump.
   */
  const [status] = useState(cachedStatus);
  const [custom, setCustom] = useState("");
  const [typing, setTyping] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const leverRow = status?.levers.find((l) => l.key === lever);
  const items = (status?.playbook ?? [])
    .filter((p) => p.lever === lever)
    .slice(0, 3);

  /**
   * Log it, and get out of the way.
   *
   * This used to `await logEntry()` — up to three sequential Supabase round
   * trips — before dismissing, so the sheet sat there while the network
   * decided, and the dashboard behind it did not show the lever as logged
   * until it happened to refetch. Undo felt instant next to it for one reason:
   * undo went through the outbox and this did not.
   *
   * Now it queues, exactly like undo. The queue is shared and synchronous, so
   * the dashboard has the tap before the sheet has finished closing, and the
   * whole thing works with no signal at all — which is what the outbox was
   * built for and what this path was quietly bypassing.
   */
  function commit(detail: string | null) {
    // One pick per sheet: the second tap is always an accident.
    if (chosen !== null || !status) return;
    setChosen(detail ?? "");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
    queueWrite(status.state.user_id, lever, "log", detail);
  }

  return (
    <View
      style={{
        backgroundColor: color.surface,
        paddingHorizontal: space[5],
        paddingTop: space[5],
        // The strip behind the home indicator belongs to the sheet. Padding it
        // here keeps the last button clear of the indicator; the screen's own
        // contentStyle is what actually paints it.
        paddingBottom: Math.max(insets.bottom, space[4]) + space[3],
        gap: space[2],
      }}
    >
      <Label style={{ marginBottom: space[1] }}>
        {leverRow?.label ?? lever}
      </Label>

      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          disabled={chosen !== null}
          onPress={() => commit(item.label)}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: chosen === item.label ? color.lineHi : color.line,
            backgroundColor: pressed ? color.line : color.surfaceHi,
            justifyContent: "center",
            paddingHorizontal: space[4],
          })}
        >
          <Body tone="ink">{item.label}</Body>
        </Pressable>
      ))}

      {typing ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <TextInput
            autoFocus
            value={custom}
            onChangeText={setCustom}
            placeholder="what did you do?"
            placeholderTextColor={color.inkMute}
            onSubmitEditing={() => commit(custom.trim() || null)}
            returnKeyType="done"
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.line,
              backgroundColor: color.surfaceHi,
              paddingHorizontal: space[4],
              color: color.ink,
              fontFamily: "Inter_400Regular",
              // 16 minimum on a touch device. Below that iOS zooms the whole
              // view on focus and the sheet jumps.
              fontSize: 16,
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => commit(custom.trim() || null)}
            style={{
              minHeight: 56,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.lineHi,
              backgroundColor: color.surfaceHi,
              justifyContent: "center",
            }}
          >
            <Body tone="ink">log</Body>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setTyping(true)}
          style={{
            minHeight: 56,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: color.line,
            justifyContent: "center",
            paddingHorizontal: space[4],
          }}
        >
          <Body tone="mute">something else</Body>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={chosen !== null}
        onPress={() => commit(null)}
        style={{
          minHeight: TAP,
          alignItems: "center",
          justifyContent: "center",
          marginTop: space[1],
        }}
      >
        <Body tone="mute" style={{ fontSize: size.xs }}>
          just mark it up
        </Body>
      </Pressable>
    </View>
  );
}
