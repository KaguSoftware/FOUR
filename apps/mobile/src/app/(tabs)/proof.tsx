import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Label, Wordmark } from "@/components/ui";
import { useStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

/**
 * Proof — the file of what came back.
 *
 * The runs that lasted held while progress was perceptible and died when it
 * stopped being. During a run this answers "is this doing anything". During
 * re-entry it is evidence it worked last time, which is a better argument for
 * restarting than any motivational copy.
 *
 * SCOPE(v1-mobile): the daily check-in and the trend are NOT ported yet — this
 * screen currently states what it will hold rather than pretending to be
 * finished. The web version at `apps/web/app/proof/page.tsx` is complete and is
 * the reference: daily points over 60 days, plus the optional weight line.
 * GROWS LATER → port the check-in (energy, sleep, note, optional weight) and
 * the trend chart via react-native-svg.
 */
export default function ProofScreen() {
  const insets = useSafeAreaInsets();
  const { status } = useStatus();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[5],
        paddingBottom: space[12],
      }}
    >
      <View style={{ marginBottom: space[8] }}>
        <Wordmark />
      </View>

      <Label style={{ marginBottom: space[3] }}>proof</Label>
      <Body tone="dim">
        The daily check-in and its trend are not on mobile yet. They are live on
        the web app, and nothing recorded there is lost — this screen will read
        the same rows when it ships.
      </Body>

      {status?.state.weight_enabled && (
        <Body tone="mute" style={{ marginTop: space[4] }}>
          Weight is on for this account. It never affects uptime.
        </Body>
      )}
    </ScrollView>
  );
}
