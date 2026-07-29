import { useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import {
  addDays,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  type Posture,
} from "@uptime/core";

import { Body, Label, Rule } from "@/components/ui";
import { LeverManager } from "@/components/lever-manager";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, radius, size, space, TAP } from "@/theme";

/** Local overrides held only until the server confirms them. */
type Pending = { slammed?: boolean; weight?: boolean; posture?: Posture };

/**
 * Settings.
 *
 * Grouped into four sections, in the order they are actually used. Levers come
 * first because they are the only thing here anyone changes more than once;
 * posture, the two switches and the account rows follow.
 *
 * It used to be a flat stack of six blocks with a 24 / hairline / 24 separator
 * between each — about 300pt of pure separator — led by a two-value setting
 * rendered as two full explanatory cards taking another 300. Almost nothing was
 * above the fold. The rules now live INSIDE a section, between peer rows, and
 * the gap between sections does the separating.
 */
export default function SettingsScreen() {
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
  const posture = pending.posture ?? state.posture;

  async function update(patch: Record<string, unknown>, optimistic: Pending) {
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
    <Screen>
      <Section title="levers" first>
        <LeverManager
          userId={state.user_id}
          levers={levers}
          onChanged={refresh}
        />
      </Section>

      {/* Posture. Settings is the ONLY place it lives — deliberately not on the
          takeover, even though someone having a bad week is exactly who would
          benefit from switching. Offering it there turns a rough moment into a
          configuration task. */}
      <Section title="alerts">
        <Body tone="ink" style={{ marginBottom: space[2] }}>
          Alert posture
        </Body>

        <Segmented
          label="Alert posture"
          options={POSTURE_CHOICES}
          value={posture}
          onChange={(next) => update({ posture: next }, { posture: next })}
        />

        {/* Only the SELECTED option's detail, not both. Two descriptions on
            screen is a comparison, and this is a setting you already made.
            The footnote stays in full: core marks it load-bearing, because
            without it `soft` reads as the easier setting and the whole point
            is that there is no easier setting. */}
        <Note style={{ marginTop: space[3] }}>
          {POSTURE_CHOICES.find((c) => c.value === posture)?.detail}{" "}
          {POSTURE_FOOTNOTE}
        </Note>

        <View style={{ marginVertical: space[4] }}>
          <Rule />
        </View>

        {/* React Native's Switch IS the platform control — a real UISwitch on
            iOS and a Material switch on Android, with the OS owning its
            gesture, animation and accessibility. Only track and thumb are
            themed. */}
        <Row
          title="Slammed mode"
          note={
            slammed
              ? `Raised thresholds until ${state.slammed_until}. Still one lever.`
              : "Raises the alert thresholds for overloaded stretches. Never pauses the system; expires after 14 days."
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
      </Section>

      <Section title="tracking">
        <Row
          title="Track weight"
          note="Recorded and plotted, and that is the whole feature. It never affects uptime."
        >
          <SettingSwitch
            label="Track weight"
            value={weightEnabled}
            onValueChange={(on) =>
              update({ weight_enabled: on }, { weight: on })
            }
          />
        </Row>
      </Section>

      <Section title="account">
        <Row title="Timezone" note={state.timezone} />

        <View style={{ marginVertical: space[4] }}>
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
          style={({ pressed }) => ({
            minHeight: TAP,
            justifyContent: "center",
            borderRadius: radius.md,
            paddingHorizontal: pressed ? space[2] : 0,
            marginHorizontal: pressed ? -space[2] : 0,
            backgroundColor: pressed ? color.surface : "transparent",
          })}
        >
          <Body tone="mute">Sign out</Body>
        </Pressable>
      </Section>
    </Screen>
  );
}

/**
 * A group of related settings under a quiet heading.
 *
 * The heading is what replaced the hairline rules between blocks: a label
 * carries the same separation for a fifth of the height, and unlike a rule it
 * also says what the group is.
 */
function Section({
  title,
  children,
  first = false,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={{ marginTop: first ? 0 : space[10] }}>
      <Label style={{ marginBottom: space[3] }}>{title}</Label>
      {children}
    </View>
  );
}

/**
 * Small print.
 *
 * `Body` bakes in `lineHeight: size.sm * 1.55` = 20.15. Overriding `fontSize`
 * to `xs` without also overriding the line height — which this screen did in
 * five places — leaves 12px text sitting on 20pt lines, which is most of why
 * the page felt loose.
 */
function Note({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Body
      tone="mute"
      style={[{ fontSize: size.xs, lineHeight: size.xs * 1.5 }, style]}
    >
      {children}
    </Body>
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
    <View
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4] }}
    >
      <View style={{ flex: 1 }}>
        <Body tone="ink">{title}</Body>
        {note && <Note style={{ marginTop: space[1] }}>{note}</Note>}
      </View>
      {children}
    </View>
  );
}
