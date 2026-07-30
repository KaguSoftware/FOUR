import Constants from "expo-constants";

import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { Group, LinkRow, RowRule } from "@/components/settings-ui";
import { reminderLabel } from "@/lib/reminder";
import { useStatus } from "@/lib/use-status";

/**
 * The Settings index.
 *
 * Every row states its current value, so this screen answers "is slammed mode
 * on?" and "which levers do I have?" without being opened. That is the point of
 * an index over a wall: the summary IS the interface, and you push in only when
 * you want to change something.
 *
 * Two groups. The first holds what the product does; the second holds the
 * account and the app itself. Section headings over single rows are grammar
 * rather than structure — the grouping already says it.
 */
export default function SettingsIndex() {
  const { status } = useStatus();

  if (!status) return <Loading />;
  const { state, levers, user } = status;

  // "21:00 · slammed" — whatever is on. Nothing on still states the truth:
  // the pager needs no configuration and cannot be turned off.
  const alerts =
    [
      state.daily_reminder_at && reminderLabel(state.daily_reminder_at),
      status.slammed && "slammed",
    ]
      .filter(Boolean)
      .join(" · ") || "pager only";

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
        <LinkRow title="Alerts" value={alerts} href="/(tabs)/settings/alerts" />
        <RowRule />
        <LinkRow
          title="Tracking"
          value={
            state.weight_enabled ? `Weight · ${state.weight_unit}` : "Weight off"
          }
          href="/(tabs)/settings/tracking"
        />
      </Group>

      <Group>
        <LinkRow
          title="Account"
          value={user.email ?? "—"}
          href="/(tabs)/settings/account"
        />
        <RowRule />
        <LinkRow
          title="About"
          value={Constants.expoConfig?.version ?? "—"}
          href="/(tabs)/settings/about"
        />
      </Group>
    </Screen>
  );
}
