
import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { LeverManager } from "@/components/lever-manager";
import { useStatus } from "@/lib/use-status";

/**
 * The full lever manager: rename, archive, add.
 *
 * The dashboard offers adding, because that is where you notice one is missing,
 * and long-press dragging for order and archiving. Everything else lives here.
 * The manager carries its own one-line header; nothing is repeated below it.
 */
export default function LeversScreen() {
  const { status, refresh } = useStatus();

  if (!status) return <Loading />;

  return (
    <Screen underHeader>
      <LeverManager
        userId={status.state.user_id}
        levers={status.levers}
        onChanged={refresh}
      />
    </Screen>
  );
}
