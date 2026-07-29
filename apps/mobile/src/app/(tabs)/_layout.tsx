import { useEffect } from "react";
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
 * **`Label` and `Icon` must be DIRECT children of `NativeTabs.Trigger`.** They
 * are never rendered — expo-router walks the children and matches on strict
 * element identity (`child.type === Icon`), reading their props as config. A
 * wrapper component, however tidy, produces an element of the wrong type and is
 * silently dropped, which is exactly how this shipped with no icons at all. Do
 * not factor these into a helper.
 *
 * **One `Icon` covers both platforms.** `sf` is read only when the build target
 * is iOS and `androidSrc` only on Android, so the unused branch costs nothing.
 * Android goes through `VectorIcon` because the alternative, `drawable`, is a
 * native resource that needs a prebuild and therefore cannot work in Expo Go.
 * `VectorIcon` is *not* a valid child on its own — it is only understood as the
 * `src`/`androidSrc` prop of an `Icon`.
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
        <Label>Home</Label>
        <Icon
          sf="house"
          androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Label>History</Label>
        <Icon
          sf="clock.arrow.circlepath"
          androidSrc={<VectorIcon family={MaterialIcons} name="history" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proof">
        <Label>Proof</Label>
        <Icon
          sf="chart.xyaxis.line"
          androidSrc={<VectorIcon family={MaterialIcons} name="show-chart" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon
          sf="gearshape"
          androidSrc={<VectorIcon family={MaterialIcons} name="settings" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
