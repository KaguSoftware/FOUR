import { useState } from "react";
import { View } from "react-native";

import { ActivityManager } from "@/components/activity-manager";
import { Segmented } from "@/components/segmented";
import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { Body } from "@/components/ui";
import { useStatus } from "@/lib/use-status";
import { space } from "@/theme";

/**
 * Activities, per lever.
 *
 * Activities belong to a lever, so this screen has to pick one first. A
 * segmented control rather than a stack of four sections: at most four levers
 * exist, they fit across a phone, and stacking them would put the fourth
 * lever's list a full screen below the first's.
 *
 * The same editor is reachable from the log sheet, where you actually use
 * these. This is the place you come to when you already know one is wrong.
 */
export default function ActivitiesScreen() {
  const { status } = useStatus();
  const [lever, setLever] = useState<string | null>(null);

  if (!status) return <Loading />;

  const { levers } = status;
  if (levers.length === 0) {
    return (
      <Screen underHeader>
        <Body tone="mute">
          Activities belong to a lever, and there are none yet. Add one in
          Settings → Levers.
        </Body>
      </Screen>
    );
  }

  const selected = levers.find((l) => l.key === lever) ?? levers[0];

  return (
    <Screen underHeader>
      {levers.length > 1 && (
        <View style={{ marginBottom: space[6] }}>
          <Segmented
            label="Lever"
            options={levers.map((l) => ({ value: l.key, title: l.label }))}
            value={selected.key}
            onChange={setLever}
          />
        </View>
      )}

      <ActivityManager
        // Keyed on the lever so switching gives a fresh list rather than
        // showing the previous lever's activities until the read returns.
        key={selected.key}
        userId={status.state.user_id}
        lever={selected.key}
        leverLabel={selected.label}
      />
    </Screen>
  );
}
