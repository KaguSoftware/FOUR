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
import { Logo } from "@/components/ui";
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
  const version = Constants.expoConfig?.version ?? "—";

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
