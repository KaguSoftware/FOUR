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
import { reconcileReminder } from "@/lib/reminder";
import { useSession } from "@/lib/session";
import { useStatus } from "@/lib/use-status";
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
  const { status } = useStatus();
  const router = useRouter();
  const userId = session?.user.id;

  useEffect(() => {
    // Refresh only — never prompt. This runs on every mount, and its job is to
    // re-store the token, which is what catches an OS rotation. Asking here
    // would overrule the choice the user just made in onboarding: someone who
    // picked "start without alerts" got the system dialog anyway, seconds
    // later, with nothing on screen explaining why.
    if (userId) registerForPush(userId, { prompt: false });
  }, [userId]);

  const reminderAt = status?.state.daily_reminder_at ?? null;
  const statusLoaded = status !== null;
  useEffect(() => {
    // The device schedule follows the server column: a reinstall, a reboot or
    // a change made on another device all land here. Never prompts — the
    // silent reconcile path inside skips when permission is missing.
    if (statusLoaded) reconcileReminder(reminderAt);
  }, [statusLoaded, reminderAt]);

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
      // Both of these MUST be the {default, selected} form. A flat value
      // applies to the selected state too and silently overrides `tintColor` —
      // the type docs say so outright — which left selected and unselected
      // identical in colour. On iOS 26 the glass pill still showed which tab
      // was active, so it looked correct; on anything without Liquid Glass
      // there was no indicator at all. Reported from the device.
      iconColor={{ default: color.inkMute, selected: color.ink }}
      labelStyle={{
        default: {
          fontFamily: "Inter_400Regular",
          fontSize: size["2xs"],
          color: color.inkMute,
        },
        selected: {
          // Medium as well as brighter: weight survives a colour-blind viewer
          // and a dimmed screen, both of which flatten a hue difference.
          fontFamily: "Inter_500Medium",
          fontSize: size["2xs"],
          color: color.ink,
        },
      }}
      // Android draws a Material 3 pill behind the selected icon, and there it
      // is the PRIMARY selection affordance — so it has to be visible against
      // the bar. `line` measures 1.45:1 on this background, which is a pill you
      // cannot see; `line-hi` is 3.33:1 and is the token this palette already
      // uses where a boundary has to read (the today ring in the day grid).
      indicatorColor={color.lineHi}
      // **Android-only, and it must be stated rather than left to default.**
      //
      // Unset, react-native-screens leaves the bar on
      // `NavigationBarView.LABEL_VISIBILITY_AUTO`
      // (`TabsHostAppearanceApplicator.kt`), and AUTO is a rule about item
      // COUNT: labelled at three items or fewer, selected-only at four or
      // more. This app has exactly four, so it sits on the wrong side of that
      // line — three of the four tabs render icon-only on Android while all
      // four are labelled on iOS, and the `labelStyle.default` configured
      // above describes a label that is never drawn.
      //
      // `labeled` is also the more native answer, not a concession to iOS:
      // AUTO's threshold is Material 2 `BottomNavigationView` behaviour, and
      // the M3 navigation bar labels every destination — which is what Gmail,
      // Photos and Play all show. Stating it explicitly also means adding a
      // fifth tab cannot silently restyle the bar.
      labelVisibilityMode="labeled"
    >
      {/* `Icon` also takes `sf={{ default, selected }}` for a filled-when-active
          symbol, which would make selection a change of SHAPE rather than only
          colour — the strongest fallback of all, and the iOS convention.

          Not used, because only `house` and `gearshape` have filled twins in
          SF Symbols: `clock.arrow.circlepath` and `chart.xyaxis.line` do not.
          Two tabs changing shape while two stayed flat would read as the other
          two being broken. Getting all four would mean swapping History and
          Proof to different metaphors (a plain clock, a bar chart), which is a
          design decision rather than part of this fix. The weight change on the
          selected label is the non-colour cue instead, and it applies to all
          four equally. */}
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
