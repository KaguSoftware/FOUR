import { useState } from "react";
import { Alert, View } from "react-native";

import { Screen } from "@/components/screen";
import { Group, Note, SwitchRow } from "@/components/settings-ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color } from "@/theme";

/**
 * Things recorded alongside uptime, and structurally unable to affect it.
 *
 * Weight is stored in `signals`, not `entries`. `entries` is the only thing
 * uptime derives from, so a weight reading is *incapable* of making a day up or
 * down — that separation is the guarantee, not a convention.
 */
export default function TrackingScreen() {
  const { status, refresh } = useStatus();
  const [pending, setPending] = useState<boolean | null>(null);

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state } = status;

  const weightEnabled = pending ?? state.weight_enabled;

  async function setWeight(on: boolean) {
    setPending(on);
    const { error } = await supabase
      .from("system_state")
      .update({ weight_enabled: on })
      .eq("user_id", state.user_id);

    if (error) {
      setPending(null);
      Alert.alert("Didn't save", "That change didn't reach the server.");
      return;
    }
    // Hold the optimistic value until the reload lands, then drop it — the
    // other order flashes the old state for the length of the round trip.
    await refresh();
    setPending(null);
  }

  return (
    <Screen underHeader>
      <Group first>
        <SwitchRow
          title="Track weight"
          value={weightEnabled}
          onValueChange={setWeight}
        />
      </Group>
      <Note>
        Off by default. Recorded and plotted on Proof, and that is the whole
        feature — it never affects uptime, there is no goal and no
        interpretation of the trend. Switching it off hides it without deleting
        anything.
      </Note>
    </Screen>
  );
}
