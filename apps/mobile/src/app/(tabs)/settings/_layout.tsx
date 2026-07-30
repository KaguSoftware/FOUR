import { Stack } from "expo-router/stack";
import { color } from "@/theme";

/**
 * Settings is a stack, not a page.
 *
 * It used to be one screen holding every setting, which meant the thing anyone
 * actually changes — levers — was buried under everything else. Splitting it
 * into an index of four groups puts each subject on its own screen and lets
 * the index state the current value of each without opening anything.
 *
 * **The transitions are the platform's own.** A native stack gives the push
 * animation, the back button, the header, the edge-swipe / predictive-back
 * gesture and the accessibility tree for free — all of it tuned by the OS and
 * none of it re-implemented here. That is the same rule the tab bar and the
 * sheets already follow: where the platform ships a component, use it and theme
 * it. A hand-animated slide would be the "ported from a website" tell.
 *
 * Headers ARE shown here, unlike everywhere else in the app. A pushed screen
 * needs a way back, and the platform's own is better than any custom one — so
 * these screens pass `underHeader` to `Screen`, which drops the top inset and
 * the status-bar scrim because real chrome is now doing that job.
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.ink,
        headerTitleStyle: { fontFamily: "Inter_500Medium" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: color.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      {/* The index keeps the wordmark and no header, so the tab looks like the
          other three rather than like a screen you already navigated into. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="levers" options={{ title: "Levers" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts" }} />
      <Stack.Screen name="tracking" options={{ title: "Tracking" }} />
      <Stack.Screen name="account" options={{ title: "Account" }} />
      <Stack.Screen name="change-password" options={{ title: "Change password" }} />
      <Stack.Screen name="change-email" options={{ title: "Change email" }} />
      <Stack.Screen name="delete-account" options={{ title: "Delete account" }} />
      <Stack.Screen name="about" options={{ title: "About" }} />
    </Stack>
  );
}
