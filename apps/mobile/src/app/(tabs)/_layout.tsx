import { NativeTabs } from "expo-router/unstable-native-tabs";
import { color, size } from "@/theme";

/**
 * The tab bar, and it is the platform's own.
 *
 * `NativeTabs` renders a real `UITabBar` on iOS — which on iOS 26 is the glass
 * bar that minimises as you scroll — and a real Material 3 navigation bar on
 * Android. Not a lookalike: the blur, the selection animation, the haptics, the
 * accessibility tree and the scroll-edge behaviour all come from the OS.
 *
 * That is the whole point of `sf` versus `md` below. The same tab carries an SF
 * Symbol on iOS and a Material Symbol on Android, because iconography is part
 * of the interaction layer that adapts per OS. The palette, the type and the
 * copy are identical on both — those belong to the brand, not the platform.
 */
export default function TabsLayout() {
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
      iconColor={{ default: color.inkMute, selected: color.ink }}
      labelStyle={{
        default: {
          fontFamily: "Inter_400Regular",
          fontSize: size["2xs"],
          color: color.inkMute,
        },
        selected: { fontFamily: "Inter_500Medium", color: color.ink },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Status</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform.path.ecg" md="monitor_heart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="proof">
        <NativeTabs.Trigger.Label>Proof</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
