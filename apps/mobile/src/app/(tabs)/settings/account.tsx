import { Alert, View } from "react-native";

import { Screen } from "@/components/screen";
import {
  ActionRow,
  Group,
  Note,
  RowRule,
  ValueRow,
} from "@/components/settings-ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color } from "@/theme";

export default function AccountScreen() {
  const { status } = useStatus();

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const { state, user } = status;

  return (
    <Screen underHeader>
      <Group first>
        <ValueRow title="Signed in as" value={user.email ?? "—"} />
        <RowRule />
        <ValueRow title="Timezone" value={state.timezone} />
      </Group>
      <Note>
        The timezone is read from this device and kept in sync automatically.
        The pager uses it, so it has to match the day you are looking at.
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
                onPress: () => supabase.auth.signOut(),
              },
            ])
          }
        />
      </Group>
    </Screen>
  );
}
