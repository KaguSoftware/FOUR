import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  LEVER_LABEL_MAX,
  MAX_LEVERS,
  uniqueLeverKey,
  validateLeverLabel,
} from "@uptime/core";

import { Button, TextButton } from "@/components/button";
import { field, fieldTint } from "@/components/fields";
import { androidMetrics, Body, Label, Wordmark } from "@/components/ui";
import { Segmented } from "@/components/segmented";
import { Group, Note, RowRule, SwitchRow, TimeRow } from "@/components/settings-ui";
import { useAndroidBack } from "@/lib/back";
import { registerForPush } from "@/lib/push";
import { syncReminder } from "@/lib/reminder";
import { ripple } from "@/lib/press";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { color, radius, size, space, TAP } from "@/theme";

const STEPS = 4;
const DEFAULT_REMINDER = "21:00:00";

const UNIT_CHOICES = [
  { value: "kg", title: "kg" },
  { value: "lb", title: "lb" },
] as const;

/**
 * First run, in four screens.
 *
 * The first states the rule before it asks for anything, because "one of these,
 * not all" is the single idea someone has to accept for the rest of the product
 * to make sense. It also explains, without a tour, why there is no streak
 * counter anywhere in the app.
 *
 * Then the two opt-ins (weight, the daily reminder), both defaulting off
 * because off IS the product's default, and finally the pager. That last screen
 * exists so the iOS notification prompt lands with its reason on screen: by
 * then the user has chosen levers and knows what a page would be about.
 *
 * Nothing is written until the last tap. A half-finished account cannot open
 * the app at all, so there is no intermediate state worth saving.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, markOnboarded } = useSession();
  const [step, setStep] = useState(0);
  const [labels, setLabels] = useState<string[]>([""]);
  const [weightOn, setWeightOn] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [reminderAt, setReminderAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  /**
   * Android's Back, walking the four steps.
   *
   * The root layout sets `gestureEnabled: false` on this route, which blocks
   * the iOS edge-swipe and does **nothing at all** to the Android Back button
   * — different mechanisms entirely. So Back on step 3 of 4 popped the only
   * screen in the stack and dropped the user out of a setup they had not
   * finished, having written nothing (nothing is saved until the last tap).
   *
   * Step 0 swallows the press rather than passing it on. There is genuinely
   * nothing behind this screen: the session exists, the account has no levers,
   * and `Stack.Protected` has removed every other branch from the navigation
   * state. Letting Back through would close the app on someone mid-signup —
   * and the deliberate way out, "sign out", is already on the screen.
   */
  useAndroidBack(
    useCallback(() => {
      if (step > 0) setStep((s) => s - 1);
      return true;
    }, [step]),
  );

  // A step change is a page change: reset the scroll — a long step scrolled
  // to reach its CTA must not hand its offset to the next one — and tell a
  // screen reader, since swapping a subtree under local state is silent.
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(
      `Step ${step + 1} of ${STEPS}`,
    );
  }, [step]);

  const named = labels.map((l) => l.trim()).filter(Boolean);

  /**
   * Write everything, then optionally raise the OS prompt, then open the gate.
   * `markOnboarded` unmounts this screen, so it must come last — a permission
   * dialog attached to an unmounted screen is a dialog nobody answers.
   */
  async function finish(withAlerts: boolean) {
    const userId = session?.user.id;
    if (!userId || busy) return;

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
        timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
        weight_enabled: weightOn,
        weight_unit: weightUnit,
        daily_reminder_at: reminderAt,
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

    if (doneError) {
      setBusy(false);
      return setError("Could not finish setup. Try again.");
    }

    if (withAlerts) {
      // The OS prompt, with its reason still on screen. Failures are fine —
      // the app works without alerts, and the tabs layout retries the token
      // registration on every mount anyway.
      await registerForPush(userId);
      if (reminderAt) await syncReminder(reminderAt);
    }

    setBusy(false);
    markOnboarded();
  }

  const heading = {
    ...androidMetrics,
    fontFamily: "Inter_400Regular",
    fontSize: size.lg,
    lineHeight: size.lg * 1.4,
    color: color.ink,
  } as const;

  // The shared metrics, at first-run size on the page surface.
  const leverField = [
    field,
    { minHeight: 56, backgroundColor: color.surface },
  ] as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <ScrollView
        ref={scroll}
        // JS owns the insets, same as `Screen` — left automatic, UIKit adds its
        // own keyboard inset on top of the KAV's padding a frame late, which is
        // the keyboard twitch the sign-in screen had.
        contentInsetAdjustmentBehavior="never"
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
          <Label>
            {step + 1} / {STEPS}
          </Label>
        </View>

        {step === 0 && (
          <>
            <Text style={heading}>
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
                    {...fieldTint}
                    autoFocus={i === 0}
                    value={label}
                    maxLength={LEVER_LABEL_MAX}
                    onChangeText={(v) =>
                      setLabels(labels.map((l, n) => (n === i ? v : l)))
                    }
                    placeholder={`Lever ${i + 1}`}
                    placeholderTextColor={color.inkMute}
                    style={[leverField, { flex: 1 }]}
                  />
                  {labels.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove lever ${i + 1}`}
                      onPress={() =>
                        setLabels(labels.filter((_, n) => n !== i))
                      }
                      // Not `TextButton`: this one already carries its own
                      // horizontal padding inside a flex row, and the shared
                      // component's negative margin would move it. Same
                      // ripple, laid out where it already was.
                      android_ripple={ripple("surface")}
                      style={{
                        minHeight: TAP,
                        paddingHorizontal: space[3],
                        justifyContent: "center",
                        borderRadius: radius.md,
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
                android_ripple={ripple("surface")}
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
                for (const label of named) {
                  const check = validateLeverLabel(label);
                  if (!check.ok) return setError(check.reason);
                }
                if (named.length === 0) {
                  return setError("Name at least one lever — one is enough.");
                }
                setError(null);
                setStep(1);
              }}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={heading}>Keep a number alongside the system?</Text>
            <Body tone="mute" style={{ marginTop: space[3] }}>
              Optional, and structurally separate: weight is recorded next to
              uptime, never inside it. It cannot make a day up or down.
            </Body>

            <Group title="tracking" first={false}>
              <SwitchRow
                title="Track weight"
                value={weightOn}
                onValueChange={setWeightOn}
              />
            </Group>
            {weightOn && (
              <>
                <Label style={{ marginTop: space[6], marginBottom: space[3] }}>
                  unit
                </Label>
                <Segmented
                  label="Weight unit"
                  options={UNIT_CHOICES}
                  value={weightUnit}
                  onChange={setWeightUnit}
                />
              </>
            )}
            <Note>
              No goal, no target, no judgement of the trend — a number you
              chose to keep, not a score kept on you. Off by default, and
              changeable in Settings at any time.
            </Note>

            <Cta label="continue" onPress={() => setStep(2)} />
            <StepBack onPress={() => setStep(0)} label="← back to levers" />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={heading}>Want a daily nudge?</Text>
            <Body tone="mute" style={{ marginTop: space[3] }}>
              A quiet reminder from this device at a time you pick. Off by
              default — the monitor is a pager, not a nag.
            </Body>

            <Group title="daily reminder" first={false}>
              <SwitchRow
                title="Remind me daily"
                value={reminderAt !== null}
                onValueChange={(on) =>
                  setReminderAt(on ? DEFAULT_REMINDER : null)
                }
              />
              {reminderAt !== null && (
                <>
                  <RowRule />
                  <TimeRow
                    title="Time"
                    value={reminderAt}
                    onChange={setReminderAt}
                  />
                </>
              )}
            </Group>

            <Cta label="continue" onPress={() => setStep(3)} />
            <StepBack onPress={() => setStep(1)} label="← back to tracking" />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={heading}>
              When the system goes down, it pages you.
            </Text>
            <Body tone="mute" style={{ marginTop: space[3] }}>
              Silent while things are fine. If you stop logging, an alert
              reaches the lock screen — that is the product doing its one job:
              catching the fade early. It escalates on a fixed ladder and
              never asks how you feel about it.
            </Body>
            {reminderAt !== null && (
              <Body tone="mute" style={{ marginTop: space[3] }}>
                Your daily reminder needs the same permission, so this one
                prompt covers both.
              </Body>
            )}

            <Cta
              label={busy ? "setting up…" : "enable alerts and start"}
              onPress={() => finish(true)}
              disabled={busy}
            />
            <TextButton
              title="not now — start without alerts"
              disabled={busy}
              onPress={() => finish(false)}
            />
            <StepBack onPress={() => setStep(2)} label="← back to reminder" />
          </>
        )}

        {error && (
          <Body tone="degraded" style={{ marginTop: space[4] }}>
            {error}
          </Body>
        )}

        {/* The escape hatch.
            This screen is deliberately unskippable — there is nothing behind
            it and the account has no levers until it completes — but
            "unskippable" must never mean "trapped". A session whose user no
            longer exists lands here and CANNOT finish: every write fails and
            retrying is hopeless. Signing out is the only honest way back to
            sign-in. Quiet, and last, because for everyone else it is the wrong
            direction. (Owner, 2026-07-30: deleted their auth row mid-setup and
            had no exit.) */}
        <View style={{ marginTop: space[6] }}>
          <TextButton
            title="sign out"
            accessibilityLabel="Sign out and start over"
            onPress={() => supabase.auth.signOut({ scope: "local" })}
          />
        </View>
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
    <View style={{ marginTop: "auto", paddingTop: space[10] }}>
      <Button title={label} onPress={onPress} disabled={disabled} tall />
    </View>
  );
}

function StepBack({ onPress, label }: { onPress: () => void; label: string }) {
  return <TextButton title={label} onPress={onPress} />;
}
