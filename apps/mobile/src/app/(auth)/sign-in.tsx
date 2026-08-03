import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

import { Button, TextButton } from "@/components/button";
import { field, fieldTint } from "@/components/fields";
import { Body, Label, Logo, Rule } from "@/components/ui";
import { googleSignin } from "@/lib/google-native";
import { signInWithApple, signInWithGoogle } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";
import { color, radius, space } from "@/theme";

// Closes the auth popup on platforms where the browser hands control back
// without resolving the session itself. A no-op everywhere else.
WebBrowser.maybeCompleteAuthSession();

const android = Platform.OS === "android";

// Google's branded button, or null where the native module is absent (Expo
// Go) — the screen then falls back to its own quiet button, matching what
// the sign-in flow actually does there (the browser round trip).
const GoogleSigninButton = googleSignin()?.GoogleSigninButton ?? null;

type Mode = "in" | "up";

/**
 * Sign in, or create an account.
 *
 * Both are the same two fields, so they are one screen with a mode rather than
 * two routes. Nothing here decides where you land afterwards — the root layout
 * reads the session and whether the account is onboarded, so a session created
 * any way at all (password, Apple, Google, an emailed code) takes the same
 * route without this file knowing about it.
 *
 * Apple renders Apple's own button — the HIG requires it, and review checks.
 * It only appears when the device can actually do it, so Android and old iOS
 * simply never see the option rather than seeing it fail.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleReady);
    }
  }, []);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) setError(error.message.toLowerCase());
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Say where the confirmation link should land. Without this, Supabase
        // falls back to the project's Site URL — which belongs to the WEB app,
        // so a phone signup would confirm the account and then dump the user in
        // a browser. `createURL` resolves to `uptime://auth/callback` in a real
        // build and the `exp://` LAN form in Expo Go; both are allowlisted.
        options: { emailRedirectTo: Linking.createURL("auth/callback") },
      });
      if (error) return setError(error.message.toLowerCase());

      // With email confirmation on, signUp returns a user but no session.
      // Saying so is the honest answer; silently doing nothing looks broken.
      if (!data.session) {
        setNotice(`Confirmation sent to ${email.trim()}. Open it on this device.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function withProvider(
    run: () => Promise<{
      ok: boolean;
      reason?: string;
      canceled?: boolean;
      detail?: string;
    }>,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await run();
    setBusy(false);
    // Closing the sheet is a decision, not a failure.
    if (res.ok || res.canceled) return;

    // The redirect URL is appended in development only: it is the fact that
    // identifies a misrouted OAuth round trip, and a real user can do nothing
    // with it. Without this the flow is undebuggable on a device — which is
    // how it stayed a mystery through two wrong theories.
    if (res.detail) console.warn("[oauth]", res.reason, res.detail);
    setError(
      __DEV__ && res.detail
        ? `${res.reason ?? "sign-in failed"}\n${res.detail}`
        : (res.reason ?? "sign-in failed"),
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <ScrollView
        // JS owns the insets, same as `Screen` — left automatic, UIKit adds its
        // own keyboard inset on top of the KAV's padding a frame late, and the
        // two fighting is the keyboard/QuickType-bar twitch while typing.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space[5],
          paddingTop: insets.top + space[12],
          paddingBottom: insets.bottom + space[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Logo width={88} />
        <Body tone="mute" style={{ marginTop: space[4], marginBottom: space[10] }}>
          Authentication required.
        </Body>

        {notice ? (
          <Body tone="dim">{notice}</Body>
        ) : (
          <View style={{ gap: space[3] }}>
            <TextInput
              {...fieldTint}
              value={email}
              onChangeText={setEmail}
              placeholder="email"
              placeholderTextColor={color.inkMute}
              accessibilityLabel="Email"
              autoCapitalize="none"
              // An email never wants QuickType. Leaving these on made iOS
              // show/hide the suggestion bar while typing, and every toggle
              // re-fires keyboardWillShow — half of the twitch.
              autoCorrect={false}
              spellCheck={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              textContentType="emailAddress"
              returnKeyType="next"
              style={[field, { backgroundColor: color.surface }]}
            />
            <TextInput
              {...fieldTint}
              value={password}
              onChangeText={setPassword}
              placeholder="password"
              placeholderTextColor={color.inkMute}
              accessibilityLabel="Password"
              secureTextEntry
              autoCapitalize="none"
              // Tells the password manager to offer a generated password on
              // sign-up and the saved one on sign-in.
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              textContentType={mode === "up" ? "newPassword" : "password"}
              onSubmitEditing={submit}
              returnKeyType="go"
              style={[field, { backgroundColor: color.surface }]}
            />

            {error && (
              <Body tone="down" accessibilityRole="alert">
                {error}
              </Body>
            )}

            <Button
              title={mode === "in" ? "sign in" : "create account"}
              onPress={submit}
              busy={busy}
              tall
            />

            {/* One quiet row for the two email alternatives. The emailed code
                doubles as the forgot-password path: sign in with the code,
                then set a new password in Settings. */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <TextButton
                title={mode === "in" ? "or create an account" : "or sign in"}
                align="start"
                onPress={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                }}
              />

              <TextButton
                title="email me a code"
                align="start"
                onPress={() =>
                  router.push({
                    pathname: "/email-otp",
                    params: { email: email.trim() },
                  })
                }
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[3],
                marginVertical: space[2],
              }}
            >
              <Rule style={{ flex: 1 }} />
              <Label>or</Label>
              <Rule style={{ flex: 1 }} />
            </View>

            {appleReady && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  mode === "up"
                    ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={radius.md}
                onPress={() => withProvider(signInWithApple)}
                style={{ height: 48 }}
              />
            )}

            {/* Google's own button on Android, for the same reason Apple's is
                Apple's above: the vendor's branding guidelines ask for it,
                store review checks, and on Android it is also the button
                users recognise as "the account sheet opens". Elsewhere — iOS,
                and any Android without Play Services — it is the app's own
                quiet button opening the browser flow, which is what that
                path actually does. */}
            {android && GoogleSigninButton ? (
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={() => withProvider(signInWithGoogle)}
                disabled={busy}
                // The button renders at a fixed intrinsic size; stretching the
                // wrapper and centring keeps it on the column's axis rather
                // than pinned left against full-width neighbours.
                style={{ alignSelf: "center", height: 48 }}
              />
            ) : (
              <Button
                title="continue with google"
                onPress={() => withProvider(signInWithGoogle)}
              />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
