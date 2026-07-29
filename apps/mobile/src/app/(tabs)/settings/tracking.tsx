import { useState } from "react";
import { Alert, View } from "react-native";

import { Label } from "@/components/ui";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Group, Note, SwitchRow } from "@/components/settings-ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

type Unit = "kg" | "lb";

const UNIT_CHOICES = [
  { value: "kg", title: "kg" },
  { value: "lb", title: "lb" },
] as const;

/** Local overrides held only until the server confirms them. */
type Pending = { enabled?: boolean; unit?: Unit };

/**
 * Things recorded alongside uptime, and structurally unable to affect it.
 *
 * Weight is stored in `signals`, not `entries`. `entries` is the only thing
 * uptime derives from, so a weight reading is *incapable* of making a day up or
 * down — that separation is the guarantee, not a convention.
 *
 * The unit is display only, by schema comment: the stored number is whatever
 * the user typed, in whatever unit they picked. Switching units never converts
 * anything, so the control is safe to flip freely.
 */
export default function TrackingScreen() {
  const { status, refresh } = useStatus();
  const [pending, setPending] = useState<Pending>({});

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state } = status;

  const weightEnabled = pending.enabled ?? state.weight_enabled;
  const unit = pending.unit ?? state.weight_unit;

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
      drop();
      Alert.alert("Didn't save", "That change didn't reach the server.");
      return;
    }
    // Hold the optimistic value until the reload lands, then drop it — the
    // other order flashes the old state for the length of the round trip.
    await refresh();
    drop();
  }

  return (
    <Screen underHeader>
      <Group first>
        <SwitchRow
          title="Track weight"
          value={weightEnabled}
          onValueChange={(on) =>
            update({ weight_enabled: on }, { enabled: on })
          }
        />
      </Group>
      <Note>
        Off by default. Recorded and plotted on Proof, and that is the whole
        feature — it never affects uptime, there is no goal and no
        interpretation of the trend. Switching it off hides it without deleting
        anything.
      </Note>

      {weightEnabled && (
        <>
          <Label style={{ marginTop: space[8], marginBottom: space[3] }}>
            unit
          </Label>
          <Segmented
            label="Weight unit"
            options={UNIT_CHOICES}
            value={unit}
            onChange={(next) => update({ weight_unit: next }, { unit: next })}
          />
          <Note>
            A label, not a conversion. The numbers you have logged stay exactly
            as you typed them.
          </Note>
        </>
      )}
    </Screen>
  );
}
