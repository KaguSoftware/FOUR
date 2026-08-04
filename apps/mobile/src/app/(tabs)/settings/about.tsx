import { Linking, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { Screen } from "@/components/screen";
import {
  ActionRow,
  Group,
  Note,
  RowRule,
  ValueRow,
} from "@/components/settings-ui";
import { useNotify } from "@/components/snackbar";
import { Logo } from "@/components/ui";
import { useStatus } from "@/lib/use-status";
import { resetWalkthrough } from "@/lib/walkthrough";
import { space } from "@/theme";

/**
 * The web app is the canonical home of the legal pages, so the app links
 * rather than embedding copies that would drift. Opened in the in-app browser
 * sheet — leaving the app entirely to read a paragraph is the "ported from a
 * website" tell in reverse.
 *
 * Both pages are pending on the web side; the rows exist now so the surface is
 * complete, and HANDOFF carries the pre-submission reminder that they must
 * resolve before review.
 */
const SITE = "https://personal-system-rho.vercel.app";
const SUPPORT = "parsaa.mansourii@gmail.com";

const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE}${path}`);

export default function AboutScreen() {
  const router = useRouter();
  const notify = useNotify();
  const { status } = useStatus();
  const version = Constants.expoConfig?.version ?? "—";

  /**
   * Clear the seen-once flag, and SAY that nothing visible happened.
   *
   * The effect of this row is entirely in the future — the guide appears on the
   * next launch, not now — so without a confirmation it reads as a dead
   * control. A statement, so it goes through `notify` (a snackbar on Android,
   * an Alert on iOS) rather than a blocking dialog.
   */
  async function replay() {
    const userId = status?.state.user_id;
    if (!userId) return;
    const ok = await resetWalkthrough(userId);
    notify(
      ok ? "The guide will open next launch" : "Couldn't reset the guide",
      ok
        ? "Fully close the app and reopen it."
        : "This device wouldn't let go of the setting.",
    );
  }

  return (
    <Screen underHeader>
      <View style={{ marginBottom: space[8] }}>
        <Logo width={72} />
        <Note style={{ paddingHorizontal: 0, marginTop: space[4] }}>
          Uptime monitoring for one body. A day is up if one small real thing
          got logged — the rest is derived.
        </Note>
      </View>

      <Group first>
        <ValueRow title="Version" value={version} />
        <RowRule />
        {/* The walkthrough, on demand. It auto-opens exactly once per device
            (see lib/walkthrough.ts); this row is the way back to it. */}
        <ActionRow
          title="How four works"
          onPress={() => router.push("/how-it-works")}
        />
        <RowRule />
        {/* Replays the FIRST-LAUNCH behaviour, which the row above cannot.
            That one opens the guide; this one forgets the device ever saw it,
            so the automatic open on next launch happens again. It is the only
            way to retest a path that otherwise runs once per install without
            deleting the app. */}
        <ActionRow title="Show the guide again on next launch" onPress={replay} />
      </Group>

      <Group>
        <ActionRow title="Privacy policy" onPress={() => open("/privacy")} />
        <RowRule />
        <ActionRow title="Terms of use" onPress={() => open("/terms")} />
        <RowRule />
        <ActionRow
          title="Support"
          onPress={() =>
            Linking.openURL(
              `mailto:${SUPPORT}?subject=four ${version}`,
            )
          }
        />
      </Group>
      <Note>Say what the screen did — it gets fixed faster.</Note>
    </Screen>
  );
}
