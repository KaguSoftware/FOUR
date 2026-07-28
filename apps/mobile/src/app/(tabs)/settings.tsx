import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Host, Switch } from "@expo/ui";
import {
  addDays,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  type Posture,
} from "@uptime/core";

import { Body, Label, Rule, Wordmark } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, radius, size, space, TAP } from "@/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { status, refresh } = useStatus();
  const [busy, setBusy] = useState(false);

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state, levers, slammed } = status;

  async function update(patch: Record<string, unknown>) {
    setBusy(true);
    await supabase
      .from("system_state")
      .update(patch)
      .eq("user_id", state.user_id);
    await refresh();
    setBusy(false);
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
        {POSTURE_CHOICES.map((choice) => {
          const on = choice.value === state.posture;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              disabled={busy}
              onPress={() => update({ posture: choice.value satisfies Posture })}
              style={{
                padding: space[3],
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: on ? color.lineHi : color.line,
                backgroundColor: on ? color.surfaceHi : color.surface,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Body tone={on ? "ink" : "dim"}>{choice.title}</Body>
                {on && <Body tone="ink">✓</Body>}
              </View>
              <Body tone="mute" style={{ marginTop: space[1], fontSize: size.xs }}>
                {choice.detail}
              </Body>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      {/* A real UISwitch / Material Switch, not a lookalike — the platform owns
          its gesture, its animation and its accessibility. */}
      <Row
        title="Slammed mode"
        note={
          slammed
            ? `Raised thresholds until ${state.slammed_until}. Still one lever, still ten minutes of anything.`
            : "For genuinely overloaded stretches. Raises the alert thresholds; never pauses the system. Auto-expires after 14 days."
        }
      >
        <Host matchContents>
          <Switch
            value={slammed}
            onValueChange={(on) =>
              update({
                slammed_until: on ? addDays(status.today, 14) : null,
              })
            }
          />
        </Host>
      </Row>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <Row
        title="Track weight"
        note="Off by default. Recorded and plotted, and that is the whole feature — it never affects uptime, there is no goal and no interpretation. Switching it off hides it without deleting anything."
      >
        <Host matchContents>
          <Switch
            value={state.weight_enabled}
            onValueChange={(on) => update({ weight_enabled: on })}
          />
        </Host>
      </Row>

      <View style={{ marginVertical: space[6] }}>
        <Rule />
      </View>

      <Label style={{ marginBottom: space[2] }}>levers</Label>
      <Body tone="mute" style={{ marginBottom: space[3], fontSize: size.xs }}>
        Renaming is free and archiving keeps every day you already logged.
      </Body>
      {levers.map((l) => (
        <View key={l.key}>
          <View style={{ paddingVertical: space[3] }}>
            <Body tone="dim">{l.label}</Body>
          </View>
          <Rule />
        </View>
      ))}
      {/* SCOPE(v1-mobile): read-only here. Create, rename and archive all work
          on the web app and write to the same table.
          GROWS LATER → the same CRUD via a native list with swipe actions. */}
      <Body tone="mute" style={{ marginTop: space[3], fontSize: size.xs }}>
        Add, rename and archive levers on the web app for now.
      </Body>

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
