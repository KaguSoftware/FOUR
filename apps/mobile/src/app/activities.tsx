import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityManager } from "@/components/activity-manager";
import { Button } from "@/components/button";
import { Loading } from "@/components/states";
import { Label } from "@/components/ui";
import { cachedStatus, refreshStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

/**
 * The activity editor, reached from the log sheet.
 *
 * **A `modal`, not a `formSheet`.** The log sheet it is opened from uses
 * `sheetAllowedDetents: "fitToContents"`, which measures its content ONCE to
 * size itself — that is why `log.tsx` reads `cachedStatus()` instead of
 * subscribing. A screen whose height changes as rows are added, renamed and
 * deleted would resize under the finger, which is the documented sheet-jolt
 * this project has already fixed twice. Same reasoning as `how-it-works`.
 *
 * The log sheet reaches this with `router.replace`, not `push`: it read the
 * status cache once, so returning to it after an edit would show the chips it
 * was measured with rather than the ones that now exist.
 */
export default function ActivitiesModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lever } = useLocalSearchParams<{ lever: string }>();
  const status = cachedStatus();

  if (!status) return <Loading />;

  const row = status.levers.find((l) => l.key === lever);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[6],
          paddingBottom: insets.bottom + space[8],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Label style={{ marginBottom: space[6] }}>activities</Label>

        <ActivityManager
          userId={status.state.user_id}
          lever={String(lever)}
          leverLabel={row?.label ?? String(lever)}
        />

        <View style={{ marginTop: space[10] }}>
          <Button
            title="done"
            onPress={async () => {
              // Reload the shared status BEFORE dismissing, never after.
              //
              // `add-lever.tsx` documents this exact failure: relying on the
              // screen behind to refetch on focus stopped working once focus
              // refreshes started skipping a recent load, and the symptom was
              // the worst kind — the write really had succeeded, so nothing
              // looked broken; the change just did not appear.
              await refreshStatus().catch(() => {
                // The edits landed; only the reload failed. Dismiss anyway
                // rather than trap someone here.
              });
              router.back();
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
