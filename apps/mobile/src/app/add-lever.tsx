import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LEVER_LABEL_MAX, MAX_LEVERS } from "@uptime/core";

import { Body, Label } from "@/components/ui";
import { createLever } from "@/lib/levers";
import { cachedStatus } from "@/lib/use-status";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * Add a lever without leaving the dashboard.
 *
 * Settings has the full manager — rename, archive, the lot — but adding is the
 * one thing people want at the moment they notice something missing, which is
 * while looking at the buttons. Sending them into Settings for it is a detour
 * away from the screen that made them think of it.
 *
 * Reads the cached status rather than fetching, for the same reason the log
 * sheet does: `fitToContents` measures the content, so anything that arrives
 * late makes the sheet resize after it has opened.
 */
export default function AddLeverSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status] = useState(cachedStatus);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = status?.state.user_id;
  const count = status?.levers.length ?? 0;

  async function add() {
    if (!userId || !label.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await createLever(userId, label);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    // The dashboard reloads on focus, so it already has the new lever by the
    // time the sheet finishes dismissing.
    router.back();
  }

  return (
    <View
      style={{
        backgroundColor: color.surface,
        paddingHorizontal: space[5],
        paddingTop: space[5],
        // The home-indicator strip belongs to the sheet, so it is padded here
        // AND painted by the screen's own background.
        paddingBottom: Math.max(insets.bottom, space[5]) + space[3],
        gap: space[3],
      }}
    >
      <Label>add a lever</Label>
      <Body tone="mute" style={{ fontSize: size.xs }}>
        One more small real thing that keeps a day up. {MAX_LEVERS} is the
        maximum — you have {count}.
      </Body>

      <TextInput
        autoFocus
        value={label}
        onChangeText={setLabel}
        onSubmitEditing={add}
        maxLength={LEVER_LABEL_MAX}
        returnKeyType="done"
        placeholder="Name it"
        placeholderTextColor={color.inkMute}
        style={{
          minHeight: 56,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.lineHi,
          backgroundColor: color.surfaceHi,
          paddingHorizontal: space[4],
          color: color.ink,
          fontFamily: "Inter_400Regular",
          fontSize: 16,
        }}
      />

      {error && <Body tone="degraded">{error}</Body>}

      <Pressable
        accessibilityRole="button"
        disabled={!label.trim() || busy}
        onPress={add}
        style={({ pressed }) => ({
          minHeight: TAP,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.lineHi,
          backgroundColor: pressed ? color.line : color.surfaceHi,
          alignItems: "center",
          justifyContent: "center",
          opacity: !label.trim() || busy ? 0.4 : 1,
        })}
      >
        <Label style={{ color: color.ink }}>{busy ? "…" : "add"}</Label>
      </Pressable>
    </View>
  );
}
