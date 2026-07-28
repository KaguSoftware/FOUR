import { useEffect } from "react";
import { Stack } from "expo-router/stack";
import { ThemeProvider, type Theme } from "expo-router";
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

import { SessionProvider, useSession } from "@/lib/session";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync();

/**
 * The app's theme, handed to the navigator so NATIVE chrome — headers, back
 * buttons, sheet backgrounds, the tab bar — is drawn in this palette rather
 * than the system default. Theming is the layer the platform leaves open;
 * behaviour, gestures and accessibility still come from the OS.
 */
const theme: Theme = {
  dark: true,
  colors: {
    primary: color.ink,
    background: color.bg,
    card: color.bg,
    text: color.ink,
    border: color.line,
    notification: color.down,
  },
  fonts: {
    regular: { fontFamily: "Inter_400Regular", fontWeight: "400" },
    medium: { fontFamily: "Inter_500Medium", fontWeight: "500" },
    bold: { fontFamily: "Inter_500Medium", fontWeight: "600" },
    heavy: { fontFamily: "ArchivoBlack_400Regular", fontWeight: "700" },
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    ArchivoBlack_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  return (
    <SessionProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <RootNavigator fontsLoaded={fontsLoaded} />
      </ThemeProvider>
    </SessionProvider>
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
        <Stack.Screen
          name="log"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 16,
            headerShown: false,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
