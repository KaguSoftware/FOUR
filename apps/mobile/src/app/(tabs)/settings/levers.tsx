import { View } from "react-native";

import { Screen } from "@/components/screen";
import { Note } from "@/components/settings-ui";
import { LeverManager } from "@/components/lever-manager";
import { useStatus } from "@/lib/use-status";
import { color } from "@/theme";

/**
 * The full lever manager: rename, archive, add.
 *
 * The dashboard offers adding, because that is where you notice one is missing,
 * and long-press dragging for order and archiving. Everything else lives here.
 */
export default function LeversScreen() {
  const { status, refresh } = useStatus();

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  return (
    <Screen underHeader>
      <LeverManager
        userId={status.state.user_id}
        levers={status.levers}
        onChanged={refresh}
      />
      <Note>
        One tap on any of these keeps the day up — not all of them, one.
        Renaming is free: the history follows. Archiving keeps every day you
        already logged and only stops the button being offered.
      </Note>
    </Screen>
  );
}
