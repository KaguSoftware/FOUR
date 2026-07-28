import { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addDays,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  type Posture,
} from "@uptime/core";

import { Body, Rule, Wordmark } from "@/components/ui";
import { ChoiceCard } from "@/components/choice-card";
import { LeverManager } from "@/components/lever-manager";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, size, space, TAP } from "@/theme";

/** Local overrides held only until the server confirms them. */
type Pending = { slammed?: boolean; weight?: boolean; posture?: Posture };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { status, refresh } = useStatus();
  const [pending, setPending] = useState<Pending>({});

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state, levers } = status;

  // A switch moves the instant it is tapped.
  //
  // These used to read straight from server state, so the thumb did not move
  // until a write AND a five-query reload had both come back — seconds, on a
  // phone, for a toggle. Now the local view flips first and only reverts if the
  // write actually fails, which is the honest version of optimistic: the UI is
  // ahead of the server, never lying about it.
  const slammed = pending?.slammed ?? status.slammed;
  const weightEnabled = pending?.weight ?? state.weight_enabled;

  async function update(
    patch: Record<string, unknown>,
    optimistic: Pending,
  ) {
    setPending((p) => ({ ...p, ...optimistic }));
    const { error } = await supabase
      .from("system_state")
      .update(patch)
      .eq("user_id", state.user_id);

    const drop = () =>
      setPending((p) => {
        const next = { ...p };
        for (const k of Object.keys(optimistic)) delete next[k as keyof Pending];
        return next;
      });

    if (error) {
      // Put it back. A switch that stays on after a failed write is a lie the
      // user only discovers later, when the monitor behaves unexpectedly.
      drop();
      Alert.alert("Didn't save", "That change didn't reach the server.");
      return;
    }

    // Hold the optimistic value until the reload lands, THEN drop it. Dropping
    // first would flash the old value for the length of the round trip.
    await refresh();
    drop();
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[5],
        paddingBottom: space[12],
      }}
    >
      <View style={{ marginBottom: space[8] }}>
        <Wordmark />
      </View>

      {/* Posture. Settings is the ONLY place it lives — deliberately not on the
          takeover, even though someone having a bad week is exactly who would
          benefit from switching. Offering it there turns a rough moment into a
          configuration task. */}
      <Body tone="ink">Alert posture</Body>
      <Body tone="mute" style={{ marginTop: space[1], marginBottom: space[4], fontSize: size.xs }}>
        How the system talks to you. {POSTURE_FOOTNOTE}
      </Body>

      <View style={{ gap: space[2] }}>
        {POSTURE_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.value}
            title={choice.title}
            detail={choice.detail}
            selected={choice.value === (pending.posture ?? state.posture)}
            onPress={() =>
              update({ posture: choice.value }, { posture: choice.value })
            }
          />
        ))}
      </View>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      {/* React Native's Switch IS the platform control — a real UISwitch on
          iOS and a Material switch on Android, with the OS owning its gesture,
          animation and accessibility. Only the track and thumb are themed. */}
      <Row
        title="Slammed mode"
        note={
          slammed
            ? `Raised thresholds until ${state.slammed_until}. Still one lever, still ten minutes of anything.`
            : "For genuinely overloaded stretches. Raises the alert thresholds; never pauses the system. Auto-expires after 14 days."
        }
      >
        <SettingSwitch
          label="Slammed mode"
          value={slammed}
          onValueChange={(on) =>
            update(
              { slammed_until: on ? addDays(status.today, 14) : null },
              { slammed: on },
            )
          }
        />
      </Row>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <Row
        title="Track weight"
        note="Off by default. Recorded and plotted, and that is the whole feature — it never affects uptime, there is no goal and no interpretation. Switching it off hides it without deleting anything."
      >
        <SettingSwitch
          label="Track weight"
          value={weightEnabled}
          onValueChange={(on) => update({ weight_enabled: on }, { weight: on })}
        />
      </Row>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <LeverManager
        userId={state.user_id}
        levers={levers}
        onChanged={refresh}
      />

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <Row title="Timezone" note={state.timezone} />

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          // The platform's own alert, so the destructive action reads the way
          // every other destructive action on this phone reads.
          Alert.alert("Sign out?", "Your history stays on the account.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: () => supabase.auth.signOut(),
            },
          ])
        }
        style={{ minHeight: TAP, justifyContent: "center" }}
      >
        <Body tone="mute">sign out</Body>
      </Pressable>
    </ScrollView>
  );
}

/**
 * A switch whose ON state is unmistakable.
 *
 * The first version tinted the track `line-hi` when on, which measures only
 * **2.29:1** against the off track — technically different, and the owner
 * could not tell on a real phone.
 *
 * This palette reserves every bright hue for status (amber is DEGRADED, red is
 * DOWN), so a switch cannot borrow the usual green. The answer is to go the
 * other way and take the track all the way to `ink`: **16.52:1** against the
 * page versus 1.45:1 off, with a dark thumb that stays legible on top of it.
 * On is now the brightest thing on the screen, which is exactly what it should
 * be for a setting that changes how the monitor behaves.
 */
function SettingSwitch({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={label}
      trackColor={{ false: color.line, true: color.ink }}
      thumbColor={color.bg}
      // iOS draws the off-state track from this rather than trackColor.false.
      ios_backgroundColor={color.line}
    />
  );
}

function Row({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4] }}>
      <View style={{ flex: 1 }}>
        <Body tone="ink">{title}</Body>
        {note && (
          <Body tone="mute" style={{ marginTop: space[1], fontSize: size.xs }}>
            {note}
          </Body>
        )}
      </View>
      {children}
    </View>
  );
}
