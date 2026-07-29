import { useSyncExternalStore } from "react";
import { Alert, View } from "react-native";
import { pending } from "@uptime/core";

import { Screen } from "@/components/screen";
import {
  ActionRow,
  Group,
  LinkRow,
  Note,
  RowRule,
  ValueRow,
} from "@/components/settings-ui";
import { exportData } from "@/lib/export";
import { outboxStore } from "@/lib/outbox";
import { cancelReminder } from "@/lib/reminder";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color } from "@/theme";

/** "3 queued · oldest 5m" — how far behind the server this device is. */
function syncLabel(queuedAts: number[]): string {
  if (queuedAts.length === 0) return "Up to date";
  const age = Date.now() - Math.min(...queuedAts);
  const mins = Math.floor(age / 60_000);
  const ago =
    mins < 1 ? "just now" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
  return `${queuedAts.length} queued · ${ago}`;
}

export default function AccountScreen() {
  const { status } = useStatus();
  const queue = useSyncExternalStore(outboxStore.subscribe, outboxStore.get);

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state, user } = status;

  const waiting = pending(queue).map((i) => i.queued_at);

  async function onExport() {
    const res = await exportData(state.user_id);
    if (!res.ok) Alert.alert("Couldn't export", res.reason);
  }

  return (
    <Screen underHeader>
      <Group first>
        <ValueRow title="Signed in as" value={user.email ?? "—"} />
        <RowRule />
        <LinkRow title="Change email" href="/(tabs)/settings/change-email" />
        <RowRule />
        <LinkRow
          title="Change password"
          href="/(tabs)/settings/change-password"
        />
        <RowRule />
        <ValueRow title="Timezone" value={state.timezone} />
      </Group>
      <Note>
        The timezone is read from this device and kept in sync automatically.
        The pager uses it, so it has to match the day you are looking at.
      </Note>

      <Group title="data">
        {/* Passive reporting only. The queue flushes itself on network, on
            foreground and on every write — a manual "sync now" button would
            imply it needs one. */}
        <ValueRow title="Sync" value={syncLabel(waiting)} />
        <RowRule />
        <ActionRow title="Export my data" onPress={onExport} />
      </Group>
      <Note>
        Everything the account has ever written, as one JSON file, through the
        share sheet. Raw entries rather than derived numbers — anyone holding
        the entries can re-derive every figure the app shows.
      </Note>

      <Group>
        <ActionRow
          title="Sign out"
          destructive
          onPress={() =>
            // The platform's own alert, so the destructive action reads the way
            // every other destructive action on this phone reads.
            Alert.alert("Sign out?", "Your history stays on the account.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: async () => {
                  // The reminder is device-local; the next account signing in
                  // here must not inherit this one's nudge.
                  await cancelReminder();
                  await supabase.auth.signOut();
                },
              },
            ])
          }
        />
        <RowRule />
        <LinkRow
          title="Delete account"
          destructive
          href="/(tabs)/settings/delete-account"
        />
      </Group>
    </Screen>
  );
}
