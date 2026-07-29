import { View } from "react-native";
import { POSTURE_CHOICES } from "@uptime/core";

import { Screen } from "@/components/screen";
import { Group, LinkRow, RowRule } from "@/components/settings-ui";
import { useStatus } from "@/lib/use-status";
import { color } from "@/theme";

/**
 * The Settings index.
 *
 * Every row states its current value, so this screen answers "is slammed mode
 * on?" and "which levers do I have?" without being opened. That is the point of
 * an index over a wall: the summary IS the interface, and you push in only when
 * you want to change something.
 *
 * Two groups, not four. The first holds what the product does; the second holds
 * the account. Section headings over single rows are grammar rather than
 * structure — the grouping already says it.
 */
export default function SettingsIndex() {
  const { status } = useStatus();

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state, levers } = status;

  const posture =
    POSTURE_CHOICES.find((c) => c.value === state.posture)?.title ??
    state.posture;

  return (
    <Screen>
      <Group first>
        <LinkRow
          title="Levers"
          // The labels themselves, not a count. "gym, food" tells you what you
          // are about to edit; "2" makes you open it to find out.
          value={levers.map((l) => l.label).join(", ")}
          href="/(tabs)/settings/levers"
        />
        <RowRule />
        <LinkRow
          title="Alerts"
          value={status.slammed ? `${posture} · slammed` : posture}
          href="/(tabs)/settings/alerts"
        />
        <RowRule />
        <LinkRow
          title="Tracking"
          value={state.weight_enabled ? "Weight on" : "Weight off"}
          href="/(tabs)/settings/tracking"
        />
      </Group>

      <Group>
        <LinkRow
          title="Account"
          value={state.timezone}
          href="/(tabs)/settings/account"
        />
      </Group>
    </Screen>
  );
}
