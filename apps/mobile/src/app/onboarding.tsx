import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import {
  gridRamp,
  LEVER_LABEL_MAX,
  MAX_LEVERS,
  uniqueLeverKey,
  validateLeverLabel,
} from "@four/core";

import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
} from "react-native-reanimated";

import { Button, TextButton } from "@/components/button";
import { fieldTint } from "@/components/fields";
import { androidMetrics, Body, Label, Logo } from "@/components/ui";
import { SwitchRow, TimeRow } from "@/components/settings-ui";
import { useAndroidBack } from "@/lib/back";
import { nudged } from "@/lib/haptics";
import { registerForPush } from "@/lib/push";
import { syncReminder } from "@/lib/reminder";
import { useReduceMotion } from "@/lib/reduce-motion";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { color, LEVER_HEIGHT, radius, size, space } from "@/theme";

const STEPS = 2;
const DEFAULT_REMINDER = "21:00:00";

/**
 * First run, in two screens, in plain words — and in the product's own
 * material. Everything ornamental here is a day-grid cell: the step counter
 * is two cells, the four lever slots are the 2×2 block the app is named
 * after (lighting as they are named), and the notifications screen shows a
 * strip of days going quiet followed by a specimen of the actual alert.
 * Redesigned 2026-08-06 after the owner called the plain-prose version
 * "looks like HTML" — the brand's squares ARE the explanation now.
 *
 * The spotlight tour teaches the app itself moments later, on the live
 * screens. The ops register ("the pager", "down") stays out of the PROSE;
 * the one place it appears is inside the alert specimen, because that is
 * verbatim what will arrive on the lock screen and showing it beats
 * describing it.
 *
 * Nothing is written until the last tap. A half-finished account cannot open
 * the app at all, so there is no intermediate state worth saving.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, markOnboarded } = useSession();
  const [step, setStep] = useState(0);
  const [labels, setLabels] = useState<string[]>(["", "", "", ""]);
  const [reminderAt, setReminderAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const reduce = useReduceMotion();

  /**
   * The one way steps change. Direction feeds the page transition (forward
   * slides in from the right, back from the left), a stale error dies with
   * the page it described, and the advance ticks the same haptic the tour
   * uses.
   */
  const dirRef = useRef<1 | -1>(1);
  const go = useCallback(
    (n: number) => {
      dirRef.current = n > step ? 1 : -1;
      setError(null);
      nudged();
      setStep(n);
    },
    [step],
  );

  /**
   * Android's Back, walking the two steps.
   *
   * The root layout sets `gestureEnabled: false` on this route, which blocks
   * the iOS edge-swipe and does **nothing at all** to the Android Back button
   * — different mechanisms entirely. So Back on a later step popped the only
   * screen in the stack and dropped the user out of a setup they had not
   * finished, having written nothing (nothing is saved until the last tap).
   *
   * Step 0 swallows the press rather than passing it on. There is genuinely
   * nothing behind this screen: the session exists, the account has no levers,
   * and `Stack.Protected` has removed every other branch from the navigation
   * state. Letting Back through would close the app on someone mid-signup —
   * and the deliberate way out, sign out, reveals itself with any failure.
   */
  useAndroidBack(
    useCallback(() => {
      if (step > 0) go(step - 1);
      return true;
    }, [step, go]),
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
        // The reminder switch and "not now" share a screen, so the switch can
        // be on while notifications are declined — a reminder the OS cannot
        // deliver must not be recorded, or Settings → Alerts shows a switch
        // that lies.
        daily_reminder_at: withAlerts ? reminderAt : null,
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

  // First-run prose reads at `base`, not Body's 13 — this screen is the one
  // place someone is actually READING the app rather than glancing at it,
  // and the owner's device feedback was that xs/sm here was straining
  // (2026-08-06).
  const prose = {
    fontSize: size.base,
    lineHeight: size.base * 1.55,
  } as const;

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
            // The logo is an image — no baseline to align, so centre the row.
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: space[10],
          }}
        >
          <Logo width={44} />
          <StepCells step={step} />
        </View>

        {/* The page. Keyed on the step so a change swaps it with a
            directional slide-and-fade — forward arrives from the right,
            back from the left — instead of an instant subtree cut. The
            exiting page animates out in place while the next one lands.
            Under reduce-motion the swap is immediate. */}
        <Animated.View
          key={step}
          style={{ flexGrow: 1 }}
          entering={
            reduce
              ? undefined
              : (dirRef.current === 1 ? FadeInRight : FadeInLeft).duration(240)
          }
          exiting={
            reduce
              ? undefined
              : (dirRef.current === 1 ? FadeOutLeft : FadeOutRight).duration(
                  160,
                )
          }
        >
        {step === 0 && (
          <>
            <Text style={heading}>
              A day counts if you do{" "}
              <Text style={{ fontFamily: "Inter_500Medium" }}>
                one small thing
              </Text>
              .
            </Text>

            {/* The whole screen is the heading and the panel. The panel
                assembles itself: one slot at first, the next materialising
                as each is named — the structure says "one is enough, more if
                you want" so no help text has to. */}
            <View style={{ marginTop: space[8] }}>
              <SlotGrid labels={labels} onChange={setLabels} />
            </View>

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
                go(1);
              }}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={heading}>If you go quiet, we check on you.</Text>
            <Body tone="mute" style={[prose, { marginTop: space[3] }]}>
              Most days, nothing. If you stop logging for a few days, one
              notification. That&apos;s it.
            </Body>

            {/* The demonstration, in the product's own material: a strip of
                days going quiet, then a specimen of exactly what would land
                on the lock screen. Shown rather than described. */}
            <QuietDays />
            <AlertSpecimen />

            {/* Bare rows, no Group card: this is a first-run choice, not a
                settings pane. The time is set right here (owner, 2026-08-06)
                with the platform's own picker. */}
            <View style={{ marginTop: space[8] }}>
              <SwitchRow
                title="Also remind me each evening"
                value={reminderAt !== null}
                onValueChange={(on) =>
                  setReminderAt(on ? DEFAULT_REMINDER : null)
                }
              />
              {reminderAt !== null && (
                <TimeRow title="At" value={reminderAt} onChange={setReminderAt} />
              )}
            </View>

            <Cta
              label={busy ? "setting up…" : "turn on notifications"}
              onPress={() => finish(true)}
              disabled={busy}
            />
            {/* The same secondary chrome the sign-in screen settled on: two
                real outlined controls splitting the width, a clear step below
                the CTA — not a stack of grey links. */}
            <View
              style={{ flexDirection: "row", gap: space[2], marginTop: space[2] }}
            >
              <View style={{ flex: 1 }}>
                <Button
                  title="← back"
                  variant="subtle"
                  disabled={busy}
                  onPress={() => go(0)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="not now"
                  variant="subtle"
                  disabled={busy}
                  onPress={() => finish(false)}
                />
              </View>
            </View>
          </>
        )}

        {/* The fault well, and the escape hatch inside it.
            A failure is stated at full ink in a bordered well, never in a
            status colour — the product rule from `states.tsx`. Sign out
            lives HERE and nowhere else (owner, 2026-08-06: a resting
            sign-out link on a first-run screen read as clutter). The one
            user who genuinely needs it — a session whose auth row is gone,
            for whom every write fails forever (owner hit this 2026-07-30) —
            is by definition looking at this well, because nothing is
            written until the final tap and only writes can fail. */}
        {error && (
          <View
            style={{
              marginTop: space[4],
              borderWidth: 1,
              borderColor: color.line,
              borderRadius: radius.md,
              backgroundColor: color.surface,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              flexDirection: "row",
              alignItems: "center",
              gap: space[3],
            }}
          >
            <Body tone="ink" style={{ flex: 1 }}>
              {error}
            </Body>
            <TextButton
              title="sign out"
              accessibilityLabel="Sign out and start over"
              onPress={() => supabase.auth.signOut({ scope: "local" })}
            />
          </View>
        )}
        </Animated.View>
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

/**
 * A day-grid cell, borrowed as onboarding's only ornament. Same recipe as the
 * real grid: constant 1px border so filled and unfilled cells are identical
 * boxes, a filled cell's border being its own fill.
 */
function Cell({
  size: s,
  fill,
  ring = false,
}: {
  size: number;
  fill?: string | null;
  ring?: boolean;
}) {
  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: radius.sm,
        backgroundColor: fill ?? color.surface,
        borderWidth: 1,
        borderColor: ring ? color.lineHi : (fill ?? color.line),
      }}
    />
  );
}

/** The step counter as two cells — you are the lit one. */
function StepCells({ step }: { step: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`Step ${step + 1} of ${STEPS}`}
      style={{ flexDirection: "row", gap: 3 }}
    >
      {Array.from({ length: STEPS }, (_, i) => (
        <Cell key={i} size={10} fill={i === step ? color.ink : null} />
      ))}
    </View>
  );
}

/**
 * The panel that assembles itself.
 *
 * One slot at first — the entire ask. The moment it holds a character, the
 * next dashed slot materialises beside it, up to four: the dashboard's own
 * 2×2 lever grid building under the user's hands, which states "one is
 * enough, more if you want" structurally instead of in copy. A named slot
 * takes the real lever button's treatment (`surface-hi` fill, `line-hi`
 * edge); an empty one is a dashed outline. No examples rest in the slots —
 * the product ships the package, the user brings the goal.
 *
 * Revealed slots never retract (clearing text keeps the slot; an empty slot
 * simply never becomes a lever) — a panel that dismantles itself while you
 * type in it punishes editing. The first slot is full width; from two
 * onward they sit in the dashboard's two-column rows, an odd last slot
 * half-width like its dashboard twin. `LinearTransition` carries the
 * reflow, `FadeInDown` the arrivals; reduce-motion gets the grid with no
 * movement.
 */
function SlotGrid({
  labels,
  onChange,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
}) {
  const reduce = useReduceMotion();
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [visible, setVisible] = useState(1);

  const rows: number[][] = [];
  for (let i = 0; i < visible; i += 2) {
    rows.push(i + 1 < visible ? [i, i + 1] : [i]);
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((i) => {
            const named = labels[i].trim().length > 0;
            const active = named || focused === i;
            return (
              <Animated.View
                key={i}
                style={{ flex: 1 }}
                layout={reduce ? undefined : LinearTransition.duration(220)}
                entering={reduce ? undefined : FadeInDown.duration(250)}
              >
                <TextInput
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  {...fieldTint}
                  value={labels[i]}
                  maxLength={LEVER_LABEL_MAX}
                  onChangeText={(v) => {
                    if (
                      v.trim() &&
                      i === visible - 1 &&
                      visible < MAX_LEVERS
                    ) {
                      setVisible(visible + 1);
                    }
                    onChange(labels.map((l, n) => (n === i ? v : l)));
                  }}
                  onFocus={() => setFocused(i)}
                  onBlur={() => setFocused((f) => (f === i ? null : f))}
                  placeholder={i === 0 ? "name it" : undefined}
                  placeholderTextColor={color.inkMute}
                  returnKeyType={i + 1 < visible ? "next" : "done"}
                  blurOnSubmit={i + 1 >= visible}
                  onSubmitEditing={() => {
                    if (i + 1 < visible) inputs.current[i + 1]?.focus();
                  }}
                  accessibilityLabel={`Lever ${i + 1} of ${MAX_LEVERS}`}
                  style={{
                    height: LEVER_HEIGHT,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderStyle: named ? "solid" : "dashed",
                    borderColor: active ? color.lineHi : color.line,
                    backgroundColor: named ? color.surfaceHi : "transparent",
                    color: color.ink,
                    fontFamily: "Inter_500Medium",
                    // 16 is the iOS no-zoom floor, not a taste choice.
                    fontSize: 16,
                    letterSpacing: 0.3,
                    textAlign: "center",
                    paddingHorizontal: space[3],
                    paddingVertical: 0,
                    writingDirection: "ltr",
                    ...androidMetrics,
                  }}
                />
              </Animated.View>
            );
          })}
          {/* An odd last slot sits half-width, like its dashboard twin —
              except the very first, which owns the screen alone. */}
          {row.length === 1 && visible > 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

/**
 * Ten days, drawn in the real grid's grammar: a healthy stretch in the real
 * two-lever ramp, then three quiet bordered cells, the last one ringed as
 * today — the moment the alert below would arrive.
 */
function QuietDays() {
  const ramp = gridRamp(2);
  const days: (string | null)[] = [
    ramp[1],
    ramp[0],
    ramp[1],
    ramp[1],
    ramp[0],
    ramp[1],
    ramp[0],
    null,
    null,
    null,
  ];
  return (
    <View
      accessible
      accessibilityLabel="A sample of ten days: a week logged, then three quiet days"
      style={{ flexDirection: "row", gap: 6, marginTop: space[8] }}
    >
      {days.map((fill, i) => (
        <View key={i} style={{ flex: 1, aspectRatio: 1 }}>
          <View
            style={{
              flex: 1,
              borderRadius: radius.sm,
              backgroundColor: fill ?? color.surface,
              borderWidth: 1,
              borderColor:
                i === days.length - 1 ? color.lineHi : (fill ?? color.line),
            }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * The alert, verbatim. A lock-screen-shaped well carrying exactly what the
 * app would send after those three quiet days — the one place the ops
 * register appears in onboarding, because this is not copy ABOUT the product,
 * it IS the product's output, quoted.
 */
function AlertSpecimen() {
  return (
    <View
      accessible
      accessibilityLabel="A sample notification from four: down 3 days"
      style={{
        marginTop: space[3],
        flexDirection: "row",
        alignItems: "center",
        gap: space[4],
        backgroundColor: color.surfaceHi,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.lg,
        paddingVertical: space[4],
        paddingHorizontal: space[4],
      }}
    >
      <Logo width={26} />
      <View style={{ flex: 1, gap: 3 }}>
        <Label>four · now</Label>
        <Text
          style={{
            ...androidMetrics,
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: size.base,
            lineHeight: size.base * 1.3,
            color: color.ink,
            fontVariant: ["tabular-nums"],
          }}
        >
          DOWN 3 DAYS
        </Text>
      </View>
    </View>
  );
}
