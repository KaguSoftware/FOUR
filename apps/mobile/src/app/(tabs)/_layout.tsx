import { useEffect } from "react";
import { Platform } from "react-native";
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { registerForPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { color, size } from "@/theme";

/**
 * The tab bar, and it is the platform's own.
 *
 * `NativeTabs` renders a real `UITabBar` on iOS — which on iOS 26 is the glass
 * bar that minimises as you scroll — and a real Material 3 navigation bar on
 * Android. Not a lookalike: the blur, the selection animation, the haptics, the
 * accessibility tree and the scroll-edge behaviour all come from the OS.
 *
 * **Icons are per-platform by design**, because iconography belongs to the
 * interaction layer that adapts per OS. On iOS that is an SF Symbol by name.
 * On Android, expo-router 6 offers `drawable` (a native resource, which needs a
 * prebuild and so does not work in Expo Go) or an image — so we hand it a
 * Material icon rendered by `@expo/vector-icons`, which works in Expo Go and is
 * still the correct Material glyph.
 *
 * The palette, the type and the copy are identical on both. Those belong to the
 * brand, not the platform.
 */
export default function TabsLayout() {
  const { session } = useSession();
  const router = useRouter();
  const userId = session?.user.id;

  useEffect(() => {
    // Runs here rather than at first launch: by the time someone reaches the
    // tabs they have chosen levers, so the permission prompt is about something
    // rather than being the first thing a stranger sees. Re-running is cheap —
    // it re-stores the token, which is what catches an OS rotation.
    if (userId) registerForPush(userId);
  }, [userId]);

  useEffect(() => {
    // Tapping a page opens the app on the screen the page was about. The
    // dashboard becomes the takeover on its own when down >= 3, so this only
    // has to get us to the root.
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate("/");
    });
    return () => sub.remove();
  }, [router]);

  return (
    <NativeTabs
      backgroundColor={color.bg}
      // Dark chrome material, so the glass reads as this app's black rather
      // than sampling toward the system default.
      blurEffect="systemChromeMaterialDark"
      // The iOS 26 behaviour: the bar shrinks to an island as you scroll down
      // and returns the moment you scroll back up.
      minimizeBehavior="onScrollDown"
      tintColor={color.ink}
      iconColor={color.inkMute}
      labelStyle={{
        fontFamily: "Inter_400Regular",
        fontSize: size["2xs"],
        color: color.inkMute,
      }}
    >
      <NativeTabs.Trigger name="index">
        <Label>Status</Label>
        <TabIcon sf="waveform.path.ecg" md="monitor-heart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Label>History</Label>
        <TabIcon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proof">
        <Label>Proof</Label>
        <TabIcon sf="chart.xyaxis.line" md="show-chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <TabIcon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/**
 * One tab icon, expressed once per platform.
 *
 * `Icon` and `VectorIcon` are different components in expo-router 6, so the
 * branch is here rather than repeated at every call site.
 */
function TabIcon({
  sf,
  md,
}: {
  sf: React.ComponentProps<typeof Icon>["sf"];
  md: React.ComponentProps<typeof MaterialIcons>["name"];
}) {
  if (Platform.OS === "ios") return <Icon sf={sf} />;
  return <VectorIcon family={MaterialIcons} name={md} />;
}
