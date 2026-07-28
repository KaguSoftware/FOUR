import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Label, Wordmark } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { color, radius, size, space, TAP } from "@/theme";

type Mode = "in" | "up";

/**
 * Sign in, or create an account.
 *
 * Both are the same two fields, so they are one screen with a mode rather than
 * two routes. Nothing here decides where you land afterwards — the root layout
 * reads the session and whether the account is onboarded, so a session created
 * any other way (a magic link today, Apple or Google later) takes the same
 * route without this file knowing about it.
 *
 * SCOPE(v1): email and password only.
 * GROWS LATER → Sign in with Apple (mandatory for App Store review once any
 * third-party sign-in ships) and Google, both via `signInWithIdToken`.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const field = {
    minHeight: TAP,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    paddingHorizontal: space[4],
    color: color.ink,
    fontFamily: "Inter_400Regular",
    // 16 minimum, or iOS zooms the view when the field takes focus.
    fontSize: 16,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: color.bg,
        paddingHorizontal: space[5],
        paddingTop: insets.top + space[12],
        paddingBottom: insets.bottom + space[6],
      }}
    >
      <Wordmark />
      <Body tone="mute" style={{ marginTop: space[2], marginBottom: space[10] }}>
        Authentication required.
      </Body>

      {notice ? (
        <Body tone="dim">{notice}</Body>
      ) : (
        <View style={{ gap: space[3] }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={color.inkMute}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            style={field}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            placeholderTextColor={color.inkMute}
            secureTextEntry
            autoCapitalize="none"
            // Tells the password manager to offer a generated password on
            // sign-up and the saved one on sign-in.
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            onSubmitEditing={submit}
            returnKeyType="go"
            style={field}
          />

          {error && (
            <Body tone="down" accessibilityRole="alert">
              {error}
            </Body>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => ({
              minHeight: TAP,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.lineHi,
              backgroundColor: pressed ? color.line : color.surfaceHi,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.5 : 1,
            })}
          >
            <Label style={{ color: color.ink }}>
              {busy ? "…" : mode === "in" ? "sign in" : "create account"}
            </Label>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
            }}
            style={{
              minHeight: TAP,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Body tone="mute" style={{ fontSize: size.xs }}>
              {mode === "in" ? "or create an account" : "or sign in"}
            </Body>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
