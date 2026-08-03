import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
} from "@expo-google-fonts/inter";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

import { SnackbarProvider } from "@/components/snackbar";
import { SessionProvider, useSession } from "@/lib/session";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync();

/**
 * A real native sheet, presented by the navigator rather than drawn by us:
 * `UISheetPresentationController` on iOS with its own detents and
 * drag-to-dismiss, the platform equivalent on Android. `fitToContents` means
 * it is exactly as tall as what it holds.
 *
 * **`contentStyle` must be the sheet's own surface, not the app background.**
 * The screen paints the full sheet including the strip behind the home
 * indicator, and inheriting the darker page background left a black bar under
 * the content — the sheet looked like it stopped early. Each sheet also pads
 * its own bottom inset so nothing sits under the indicator.
 */
const SHEET = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 16,
  headerShown: false,
  contentStyle: { backgroundColor: color.surface },
} as const;

/**
 * Native chrome — headers, back buttons, sheet and screen backgrounds — is
 * themed through the navigator's `screenOptions` below rather than a
 * ThemeProvider, which expo-router 6 does not export. Every surface this app
 * shows is set explicitly there, so nothing falls back to a system default.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    ArchivoBlack_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  return (
    // Required for `GestureDetector` to receive anything — expo-router's
    // `ExpoRoot` does NOT provide this, so without it the lever drag gesture
    // silently never activates. (The native stack's edge-swipe is unaffected:
    // that one is handled natively by react-native-screens.)
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="light" />
        {/* Above the navigator, so a snackbar raised from a sheet or a pushed
            screen is neither clipped by it nor dismissed with it. Android
            only in effect — on iOS `useNotify` goes straight to `Alert` and
            this provider never renders anything. */}
        <SnackbarProvider>
          <RootNavigator fontsLoaded={fontsLoaded} />
        </SnackbarProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The gate, declared rather than imperative.
 *
 * `Stack.Protected` removes the whole branch from the navigation state when its
 * guard is false, so there is no window in which a signed-out user reaches the
 * dashboard via a deep link, and no redirect flash on launch. It replaces the
 * `requireStatus()` server-side redirect the web app uses — the same two
 * questions in the same order: is there a session, and is the account set up.
 */
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, onboarded, loading } = useSession();

  // Both answers must be known before the first frame. Hiding the splash early
  // would show an empty stack for the moment before the guards resolve, which
  // reads as a crash.
  const ready = fontsLoaded && !loading && (!session || onboarded !== null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.ink,
        headerTitleStyle: { fontFamily: "Inter_500Medium" },
        contentStyle: { backgroundColor: color.bg },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session && onboarded === false}>
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            // No swipe-back and no back button: there is nothing behind this
            // screen. The account has no levers until it completes.
            gestureEnabled: false,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!!session && onboarded === true}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The lever sheet is a real native sheet, presented by the navigator
            rather than drawn by us: UISheetPresentationController on iOS with
            its own detents and drag-to-dismiss, the platform equivalent on
            Android. `fitToContents` means it is exactly as tall as the
            playbook it holds — a fixed detent would leave dead space for
            someone with one item and clip someone with three. */}
        <Stack.Screen name="log" options={SHEET} />
        <Stack.Screen name="add-lever" options={SHEET} />
        {/* Read-only: what a tapped day held. */}
        <Stack.Screen name="day" options={SHEET} />
        {/* The activity editor, opened from the log sheet. A modal for the
            same reason the walkthrough is one: its height changes as rows are
            added and deleted, and `fitToContents` measures once. */}
        <Stack.Screen
          name="activities"
          options={{
            presentation: "modal",
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
          }}
        />
        {/* The walkthrough. A full-height native modal, NOT the formSheet
            options above: `fitToContents` measures content once, and a
            three-step screen whose steps differ in height would resize under
            the finger — the documented sheet-jolt. */}
        <Stack.Screen
          name="how-it-works"
          options={{
            presentation: "modal",
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
          }}
        />
      </Stack.Protected>

      {/* Outside every guard, and deliberately LAST. The OAuth redirect can
          arrive in any auth state, so it must always resolve — but an
          unguarded screen declared before the branches becomes the initial
          route the moment its predecessors are guarded away, which is how the
          first Apple sign-in landed on a blank screen instead of onboarding
          (2026-07-29). Declared last, it is reachable by deep link and
          nothing else. */}
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
