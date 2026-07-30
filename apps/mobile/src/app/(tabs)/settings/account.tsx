import { useSyncExternalStore } from "react";
import { Alert, View } from "react-native";
import { oldestAgeDays, pending, type OutboxItem } from "@uptime/core";

import { Fault, Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import {
  ActionRow,
  Group,
  LinkRow,
  RowRule,
  ValueRow,
} from "@/components/settings-ui";
import { exportData } from "@/lib/export";
import { clearBlocked, outboxHealthStore, outboxStore } from "@/lib/outbox";
import { unregisterPush } from "@/lib/push";
import { cancelReminder } from "@/lib/reminder";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { space } from "@/theme";

/**
 * "3 queued · 5m" — how far behind the server this device is.
 *
 * Once the oldest tap is a whole day old it is reported in days rather than
 * hours, because that is the point at which it stops being a sync detail and
 * starts being a day the user believes is up and is not.
 */
function syncLabel(queue: readonly OutboxItem[]): string {
  if (queue.length === 0) return "Up to date";

  const now = Date.now();
  const days = oldestAgeDays(queue, now);
  if (days >= 1) return `${queue.length} queued · ${days}d`;

  const mins = Math.floor((now - Math.min(...queue.map((q) => q.queued_at))) / 60_000);
  const ago =
    mins < 1 ? "just now" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
  return `${queue.length} queued · ${ago}`;
}

export default function AccountScreen() {
  const { status } = useStatus();
  const queue = useSyncExternalStore(outboxStore.subscribe, outboxStore.get);
  const health = useSyncExternalStore(
    outboxHealthStore.subscribe,
    outboxHealthStore.get,
  );

  if (!status) return <Loading />;
  const { state, user } = status;

  const waiting = pending(queue);
  const refused = health.blocked.length + health.dropped;

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
        {/* Read from the device and synced automatically; the pager uses it. */}
        <ValueRow title="Timezone" value={state.timezone} />
      </Group>

      <Group title="data">
        {/* Passive reporting only. The queue flushes itself on network, on
            foreground and on every write — a manual "sync now" button would
            imply it needs one. */}
        <ValueRow title="Sync" value={syncLabel(waiting)} />
        <RowRule />
        {/* One JSON file of raw entries, through the share sheet — anyone
            holding the entries can re-derive every figure the app shows. */}
        <ActionRow title="Export my data" onPress={onExport} />
      </Group>

      {/* Silence is the default — this block exists only when something was
          actually lost. A tap the server refused is a day the user believes is
          up and is not, and that is exactly the kind of quiet wrongness the
          product is built to refuse. */}
      {refused > 0 && (
        <View style={{ marginTop: space[5] }}>
          <Fault
            label={`${refused} ${refused === 1 ? "tap" : "taps"} not saved`}
            message={
              health.blocked[0]?.reason ??
              "Queued too long and dropped to keep the queue bounded."
            }
            onRetry={() => clearBlocked(state.user_id)}
            retryLabel="dismiss"
          />
        </View>
      )}

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
                  // Release the push token BEFORE signing out — the update is
                  // an RLS-protected write and needs the session that is about
                  // to end. Skipping it left a signed-out phone still receiving
                  // that account's pages, which is both a privacy leak and a
                  // pager firing at someone who cannot act on it.
                  await unregisterPush(state.user_id);
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
