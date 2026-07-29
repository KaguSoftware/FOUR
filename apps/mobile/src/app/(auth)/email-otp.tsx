import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { field } from "@/components/fields";
import { Body, Wordmark } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { color, size, space, TAP } from "@/theme";

const RESEND_COOLDOWN_S = 30;

/**
 * Sign in with a 6-digit emailed code.
 *
 * One screen, two phases: the address, then the code. This is also the
 * forgot-password path — a code proves the inbox the same way a reset link
 * would, and after it lands the user can set a new password in Settings →
 * Account. No deep links, no reset tokens, nothing to intercept.
 *
 * `shouldCreateUser` stays default-on, so an address with no account becomes
 * an account. That is deliberate: the code proves the inbox either way, and
 * "no account found" on a sign-in screen is an enumeration oracle.
 *
 * Server-side note: the Supabase Magic Link email template must contain
 * `{{ .Token }}` or the email carries only a link and the code phase has
 * nothing to type.
 */
export default function EmailOtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<TextInput>(null);

  // The resend timer. Not rate limiting — Supabase does that server-side —
  // just enough friction to stop "did it send?" double-taps.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    const addr = email.trim().toLowerCase();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({ email: addr });
    setBusy(false);

    if (error) return setError(error.message.toLowerCase());
    setPhase("code");
    setCode("");
    setCooldown(RESEND_COOLDOWN_S);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(token: string) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setBusy(false);

    if (error) {
      setCode("");
      return setError(error.message.toLowerCase());
    }
    // The session now exists and the root gate is already swapping stacks;
    // nothing to navigate. The router call would race the swap.
  }

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
        {phase === "email"
          ? "A 6-digit code, emailed. Works with or without a password — this is also how you get back in after forgetting one."
          : `Code sent to ${email.trim()}.`}
      </Body>

      {phase === "email" ? (
        <View style={{ gap: space[3] }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={color.inkMute}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            autoFocus={!email}
            returnKeyType="go"
            onSubmitEditing={send}
            style={[field, { backgroundColor: color.surface }]}
          />

          {error && (
            <Body tone="down" accessibilityRole="alert">
              {error}
            </Body>
          )}

          <Button title="send code" onPress={send} busy={busy} tall />
        </View>
      ) : (
        <View style={{ gap: space[3] }}>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              if (digits.length === 6) verify(digits);
            }}
            placeholder="000000"
            placeholderTextColor={color.inkMute}
            accessibilityLabel="6-digit code"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            // iOS reads the code out of Mail/Messages and offers it above the
            // keyboard; typing it is the fallback, not the plan.
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            style={[
              field,
              {
                backgroundColor: color.surface,
                fontFamily: "JetBrainsMono_500Medium",
                fontSize: size.xl,
                letterSpacing: size.xl * 0.4,
                textAlign: "center",
                minHeight: 56,
                // letterSpacing trails the LAST digit too, which drags a
                // centred run of glyphs half a space left. Widening the left
                // pad by one spacing unit shifts it back to true centre.
                paddingLeft: space[4] + size.xl * 0.4,
              },
            ]}
          />

          {error && (
            <Body tone="down" accessibilityRole="alert">
              {error}
            </Body>
          )}

          {busy && <Body tone="mute">checking…</Body>}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              disabled={cooldown > 0 || busy}
              onPress={send}
              style={{ minHeight: TAP, justifyContent: "center" }}
            >
              <Body
                tone="mute"
                style={{ fontSize: size.xs, opacity: cooldown > 0 ? 0.5 : 1 }}
              >
                {cooldown > 0 ? `resend in ${cooldown}s` : "resend the code"}
              </Body>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPhase("email");
                setError(null);
              }}
              style={{ minHeight: TAP, justifyContent: "center" }}
            >
              <Body tone="mute" style={{ fontSize: size.xs }}>
                wrong address?
              </Body>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={{
          minHeight: TAP,
          justifyContent: "center",
          alignItems: "center",
          marginTop: space[6],
        }}
      >
        <Body tone="mute" style={{ fontSize: size.xs }}>
          ← back to sign in
        </Body>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
