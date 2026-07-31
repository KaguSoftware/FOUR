import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";

import { Button } from "@/components/button";
import { field, fieldTint } from "@/components/fields";
import { Screen } from "@/components/screen";
import { Note } from "@/components/settings-ui";
import { Body, Label } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { color, space } from "@/theme";

const MIN_LENGTH = 8;

/**
 * Set a new password on the live session.
 *
 * No "current password" field: Supabase authorises this with the session
 * token, and the session sits in the keychain — someone holding an unlocked
 * phone already holds the account. Asking for the old password would be
 * theatre, and it is unanswerable for accounts created through Apple, Google
 * or an emailed code, which is exactly who needs this screen.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  // This screen sits under a shown native header. `padding` measures from the
  // window, so without the header's height the avoidance is short by exactly
  // that much and the focused field can sit under the keyboard.
  const headerHeight = useHeaderHeight();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) return setError(error.message.toLowerCase());
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <Screen underHeader>
        <View style={{ gap: space[3] }}>
          <Label>new password</Label>
          <TextInput
            {...fieldTint}
            value={password}
            onChangeText={setPassword}
            placeholder={`at least ${MIN_LENGTH} characters`}
            placeholderTextColor={color.inkMute}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
            // Hands the password manager the generate-a-password affordance.
            autoComplete="new-password"
            textContentType="newPassword"
            style={[field, { backgroundColor: color.surface }]}
          />

          <Label style={{ marginTop: space[2] }}>confirm</Label>
          <TextInput
            {...fieldTint}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="same again"
            placeholderTextColor={color.inkMute}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={[field, { backgroundColor: color.surface }]}
          />

          {mismatch && (
            <Body tone="degraded">The two fields don&apos;t match yet.</Body>
          )}
          {error && (
            <Body tone="down" accessibilityRole="alert">
              {error}
            </Body>
          )}

          <View style={{ marginTop: space[2] }}>
            <Button
              title="change password"
              onPress={submit}
              disabled={!ready}
              busy={busy}
            />
          </View>
        </View>

        <Note>
          Applies everywhere immediately. Also sets a first password for Apple
          or Google accounts.
        </Note>
      </Screen>
    </KeyboardAvoidingView>
  );
}
