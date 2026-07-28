import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import {
  canAddLever,
  uniqueLeverKey,
  validateLeverLabel,
  LEVER_LABEL_MAX,
  MAX_LEVERS,
} from "@uptime/core";
import { Body, Label, Rule } from "./ui";
import { supabase } from "@/lib/supabase";
import type { LeverRow } from "@/lib/status";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * Lever management.
 *
 * Two rules carry the whole design, and both exist so nothing done here can
 * make a past day worse:
 *
 * - **Renaming is free.** The label changes; the stable key underneath does
 *   not, so six months of history follows the rename.
 * - **Archiving never deletes.** Entries keep pointing at the key, so the day
 *   grid and the 30-day number are identical afterwards. The button just stops
 *   being offered.
 *
 * Four is the ceiling and one is the floor, both also enforced by the database
 * — this UI only makes the limits legible.
 */
export function LeverManager({
  userId,
  levers,
  onChanged,
}: {
  userId: string;
  levers: LeverRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const full = !canAddLever(levers.length);
  const last = levers.length <= 1;

  /**
   * `PromiseLike`, not `Promise` — a Supabase query builder is thenable but is
   * not a real Promise, so typing this as `Promise` rejects every call site.
   */
  async function run(fn: () => PromiseLike<{ error: unknown } | void>) {
    if (busy) return;
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (result && "error" in result && result.error) {
      Alert.alert("Didn't save", "That change didn't reach the server.");
      return;
    }
    await onChanged();
  }

  async function create() {
    const check = validateLeverLabel(adding);
    if (!check.ok) return Alert.alert("Can't add that", check.reason);

    // Unique against EVERY key, archived included — an archived lever still
    // owns its key because its entries still point at it.
    const { data: all } = await supabase
      .from("levers")
      .select("key, position, archived")
      .eq("user_id", userId);

    const rows = all ?? [];
    const active = rows.filter((l) => !l.archived);
    if (!canAddLever(active.length)) {
      return Alert.alert("Four is the maximum", "Archive one first.");
    }

    // Lowest free slot, so archiving then adding reuses the gap rather than
    // pushing past the position <= 4 constraint.
    const taken = new Set(active.map((l) => l.position));
    let position = 1;
    while (taken.has(position)) position++;

    const label = adding.trim();
    await run(async () => {
      const res = await supabase.from("levers").insert({
        user_id: userId,
        key: uniqueLeverKey(label, rows.map((l) => l.key)),
        label,
        position,
      });
      setAdding("");
      return res;
    });
  }

  function archive(lever: LeverRow) {
    if (last) {
      return Alert.alert(
        "Keep at least one lever",
        "A dashboard with no buttons is not a state this app has. Add another first.",
      );
    }
    Alert.alert(
      `Archive ${lever.label}?`,
      "Every day you already logged with it stays exactly as it is. The button just stops being offered.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () =>
            run(() =>
              supabase
                .from("levers")
                .update({ archived: true })
                .eq("id", lever.id)
                .eq("user_id", userId),
            ),
        },
      ],
    );
  }

  return (
    <View>
      <Label style={{ marginBottom: space[2] }}>levers</Label>
      <Body tone="mute" style={{ marginBottom: space[3], fontSize: size.xs }}>
        One tap on any of these keeps the day up — not all of them, one. Rename
        freely; archiving keeps every day you already logged.
      </Body>

      {levers.map((lever) => (
        <View key={lever.id}>
          {editing === lever.id ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[2],
                paddingVertical: space[2],
              }}
            >
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                maxLength={LEVER_LABEL_MAX}
                onSubmitEditing={() => {
                  const check = validateLeverLabel(draft);
                  if (!check.ok) return Alert.alert("Can't rename", check.reason);
                  setEditing(null);
                  run(() =>
                    supabase
                      .from("levers")
                      .update({ label: draft.trim() })
                      .eq("id", lever.id)
                      .eq("user_id", userId),
                  );
                }}
                returnKeyType="done"
                style={{
                  flex: 1,
                  minHeight: TAP,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: color.lineHi,
                  backgroundColor: color.surface,
                  paddingHorizontal: space[3],
                  color: color.ink,
                  fontFamily: "Inter_400Regular",
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setEditing(null)}
                accessibilityRole="button"
                style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: space[2] }}
              >
                <Body tone="mute" style={{ fontSize: size.xs }}>
                  cancel
                </Body>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[2],
                paddingVertical: space[2],
              }}
            >
              <Body tone="dim" style={{ flex: 1 }} numberOfLines={1}>
                {lever.label}
              </Body>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rename ${lever.label}`}
                onPress={() => {
                  setDraft(lever.label);
                  setEditing(lever.id);
                }}
                style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: space[2] }}
              >
                <Body tone="mute" style={{ fontSize: size.xs }}>
                  rename
                </Body>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Archive ${lever.label}`}
                onPress={() => archive(lever)}
                style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: space[2] }}
              >
                <Body
                  tone="mute"
                  style={{ fontSize: size.xs, opacity: last ? 0.4 : 1 }}
                >
                  archive
                </Body>
              </Pressable>
            </View>
          )}
          <Rule />
        </View>
      ))}

      {full ? (
        <Body tone="mute" style={{ marginTop: space[3], fontSize: size.xs }}>
          {MAX_LEVERS} is the maximum. Archive one to add another.
        </Body>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            marginTop: space[3],
          }}
        >
          <TextInput
            value={adding}
            onChangeText={setAdding}
            placeholder="Add a lever"
            placeholderTextColor={color.inkMute}
            maxLength={LEVER_LABEL_MAX}
            onSubmitEditing={create}
            returnKeyType="done"
            style={{
              flex: 1,
              minHeight: TAP,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.line,
              backgroundColor: color.surface,
              paddingHorizontal: space[3],
              color: color.ink,
              fontFamily: "Inter_400Regular",
              fontSize: 16,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!adding.trim() || busy}
            onPress={create}
            style={({ pressed }) => ({
              minHeight: TAP,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.lineHi,
              backgroundColor: pressed ? color.line : color.surfaceHi,
              alignItems: "center",
              justifyContent: "center",
              opacity: !adding.trim() || busy ? 0.4 : 1,
            })}
          >
            <Label style={{ color: color.ink }}>add</Label>
          </Pressable>
        </View>
      )}
    </View>
  );
}
