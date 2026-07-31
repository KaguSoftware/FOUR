import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { NOTE_MAX } from "@uptime/core";

import { Body, Label, Mono } from "@/components/ui";
import { SheetHandle } from "@/components/sheet";
import { fieldTint, noteField } from "@/components/fields";
import { Fault } from "@/components/states";
import { pressFill, ripple } from "@/lib/press";
import { rewriteNote } from "@/lib/signals";
import { cachedStatus } from "@/lib/use-status";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * Edit one day's entry.
 *
 * The only place a note is shown prefilled. The daily field opens blank — being
 * handed back this morning's text every time is not how a journal is used — so
 * editing is an explicit act, reached by tapping the day in the log. Here the
 * text IS what you are changing, so replacing it is what save means.
 *
 * Clearing it deletes the entry rather than leaving a blank row in the log.
 */
export default function EditNoteSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date, text } = useLocalSearchParams<{ date: string; text: string }>();
  const [status] = useState(cachedStatus);
  const [draft, setDraft] = useState(text ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function save() {
    const userId = status?.state.user_id;
    if (!userId || busy) return;
    setBusy(true);
    setFailed(null);
    const { error } = await rewriteNote(userId, date, draft);
    setBusy(false);

    // The sheet used to dismiss whether or not the write landed, so a failed
    // edit — or a failed delete — looked exactly like a successful one, and
    // the log behind it still showed the old text with no explanation.
    if (error) {
      setFailed(error.message);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          backgroundColor: color.surface,
          paddingHorizontal: space[5],
          paddingTop: space[5],
          paddingBottom: Math.max(insets.bottom, space[4]) + space[3],
          gap: space[3],
        }}
      >
        <SheetHandle />
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <Label>edit entry</Label>
          <Mono style={{ fontSize: size.xs, color: color.inkMute }}>{date}</Mono>
        </View>

        <TextInput
          {...fieldTint}
          autoFocus
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={NOTE_MAX}
          textAlignVertical="top"
          placeholder="Empty this to delete the entry."
          placeholderTextColor={color.inkMute}
          style={[
            noteField,
            {
              // Taller than the daily check's: here the text is the whole
              // point of the screen rather than one field among several. The
              // sheet's own ground is `surface`, so the field sits above it.
              minHeight: 160,
              maxHeight: 320,
              backgroundColor: color.surfaceHi,
            },
          ]}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={save}
          android_ripple={busy ? undefined : ripple("line")}
          style={({ pressed }) => ({
            minHeight: TAP,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.5 : 1,
          })}
        >
          <Label style={{ color: color.ink }}>
            {busy ? "…" : draft.trim() ? "save" : "delete entry"}
          </Label>
        </Pressable>

        {failed && !busy && (
          <Fault label="not saved" message={failed} onRetry={save} retryLabel="try again" />
        )}

        <Body tone="mute" style={{ fontSize: size.xs, textAlign: "center" }}>
          Nothing here affects uptime.
        </Body>
      </View>
    </KeyboardAvoidingView>
  );
}
