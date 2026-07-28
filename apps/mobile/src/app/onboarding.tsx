import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import {
  DEFAULT_POSTURE,
  MAX_LEVERS,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  uniqueLeverKey,
  validateLeverLabel,
  type Posture,
} from "@uptime/core";

import { Body, Label, Wordmark } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * First run, in two screens.
 *
 * The first states the rule before it asks for anything, because "one of these,
 * not all" is the single idea someone has to accept for the rest of the product
 * to make sense. It also explains, without a tour, why there is no streak
 * counter anywhere in the app.
 *
 * The second picks posture — framed as how the system talks, never as
 * difficulty. The line about the bar being identical is what stops SOFT reading
 * as the easier option.
 *
 * Nothing is written until the last tap. A half-finished account cannot open
 * the app at all, so there is no intermediate state worth saving.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, markOnboarded } = useSession();
  const [step, setStep] = useState<0 | 1>(0);
  const [labels, setLabels] = useState<string[]>([""]);
  const [posture, setPosture] = useState<Posture>(DEFAULT_POSTURE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const named = labels.map((l) => l.trim()).filter(Boolean);

  async function finish() {
    const userId = session?.user.id;
    if (!userId || busy) return;

    for (const label of named) {
      const check = validateLeverLabel(label);
      if (!check.ok) return setError(check.reason);
    }

    setBusy(true);
    setError(null);

    const keys: string[] = [];
    const rows = named.map((label, i) => {
      const key = uniqueLeverKey(label, keys);
      keys.push(key);
      return { user_id: userId, key, label, position: i + 1 };
    });

    // The row may not exist yet if the signup trigger has not fired, so upsert
    // rather than update — and capture the device's timezone here, which is the
    // only moment we are guaranteed to have it before the monitor needs it.
    const { error: stateError } = await supabase.from("system_state").upsert(
      {
        user_id: userId,
        posture,
        timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
      },
      { onConflict: "user_id" },
    );

    // Levers first, `onboarded_at` last. If the insert fails we have written
    // nothing that claims setup is done, so a retry is clean; the reverse order
    // could strand an account with no levers behind a passed gate.
    const { error: leverError } = await supabase.from("levers").insert(rows);

    if (stateError || leverError) {
      setBusy(false);
      return setError("Could not save that. Try again.");
    }

    const { error: doneError } = await supabase
      .from("system_state")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("user_id", userId);

    setBusy(false);
    if (doneError) return setError("Could not finish setup. Try again.");

    markOnboarded();
  }

  const field = {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    paddingHorizontal: space[4],
    color: color.ink,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space[5],
          paddingTop: insets.top + space[6],
          paddingBottom: insets.bottom + space[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: space[10],
          }}
        >
          <Wordmark />
          <Label>{step + 1} / 2</Label>
        </View>

        {step === 0 ? (
          <>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: size.lg,
                lineHeight: size.lg * 1.4,
                color: color.ink,
              }}
            >
              A day is{" "}
              <Text style={{ fontFamily: "Inter_500Medium" }}>up</Text> if you
              do one of these. Not all of them.
            </Text>
            <Body tone="mute" style={{ marginTop: space[3] }}>
              No streaks. No scores. Nothing here resets to zero.
            </Body>

            <Label style={{ marginTop: space[10], marginBottom: space[1] }}>
              your levers — up to {MAX_LEVERS}
            </Label>
            <Body tone="mute" style={{ marginBottom: space[4], fontSize: size.xs }}>
              One small real thing you can still do on a bad day. Gym, food,
              pages, practice, meds — whatever yours is. You can rename or
              change these later without losing a single day.
            </Body>

            <View style={{ gap: space[2] }}>
              {labels.map((label, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
                >
                  <TextInput
                    autoFocus={i === 0}
                    value={label}
                    maxLength={24}
                    onChangeText={(v) =>
                      setLabels(labels.map((l, n) => (n === i ? v : l)))
                    }
                    placeholder={`Lever ${i + 1}`}
                    placeholderTextColor={color.inkMute}
                    style={[field, { flex: 1 }]}
                  />
                  {labels.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove lever ${i + 1}`}
                      onPress={() =>
                        setLabels(labels.filter((_, n) => n !== i))
                      }
                      style={{
                        minHeight: TAP,
                        paddingHorizontal: space[3],
                        justifyContent: "center",
                      }}
                    >
                      <Body tone="mute" style={{ fontSize: size.xs }}>
                        remove
                      </Body>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {/* Deliberately shorter and quieter than a field. At the same size
                it reads as a second empty input rather than as an action. */}
            {labels.length < MAX_LEVERS && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setLabels([...labels, ""])}
                style={{
                  alignSelf: "flex-start",
                  minHeight: TAP,
                  marginTop: space[2],
                  paddingHorizontal: space[3],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: color.line,
                  justifyContent: "center",
                }}
              >
                <Body tone="mute" style={{ fontSize: size.xs }}>
                  + add a lever
                </Body>
              </Pressable>
            )}

            <Cta
              label="continue"
              onPress={() => {
                if (named.length === 0) {
                  return setError("Name at least one lever — one is enough.");
                }
                setError(null);
                setStep(1);
              }}
            />
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: size.lg,
                lineHeight: size.lg * 1.4,
                color: color.ink,
                marginBottom: space[8],
              }}
            >
              How should this system talk to you?
            </Text>

            <View style={{ gap: space[2] }}>
              {POSTURE_CHOICES.map((choice) => {
                const on = choice.value === posture;
                return (
                  <Pressable
                    key={choice.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPosture(choice.value)}
                    style={{
                      padding: space[4],
                      borderRadius: radius.md,
                      borderWidth: 1,
                      // Selection is carried by the mark AND the border
                      // stepping to lineHi — never by the fill alone, which
                      // separates by only 1.10:1.
                      borderColor: on ? color.lineHi : color.line,
                      backgroundColor: on ? color.surfaceHi : color.surface,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Body tone={on ? "ink" : "dim"}>{choice.title}</Body>
                      {on && <Body tone="ink">✓</Body>}
                    </View>
                    <Body
                      tone="mute"
                      style={{ marginTop: space[1], fontSize: size.xs }}
                    >
                      {choice.detail}
                    </Body>
                  </Pressable>
                );
              })}
            </View>

            {/* Load-bearing. Without it SOFT reads as the easier setting, and
                the whole point is that there is no easier setting. */}
            <Body tone="mute" style={{ marginTop: space[4], fontSize: size.xs }}>
              {POSTURE_FOOTNOTE}
            </Body>

            <Cta label={busy ? "setting up…" : "start"} onPress={finish} disabled={busy} />

            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(0)}
              disabled={busy}
              style={{
                minHeight: TAP,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Body tone="mute" style={{ fontSize: size.xs }}>
                ← back to levers
              </Body>
            </Pressable>
          </>
        )}

        {error && (
          <Body tone="degraded" style={{ marginTop: space[4] }}>
            {error}
          </Body>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Bottom-anchored: the fields are the work, the button is the exit. */
function Cta({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        marginTop: "auto",
        paddingTop: space[10],
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: 56,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: pressed ? color.line : color.surfaceHi,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Label style={{ color: color.ink }}>{label}</Label>
        </View>
      )}
    </Pressable>
  );
}
