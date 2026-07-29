import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import { field } from "@/components/fields";
import { Screen } from "@/components/screen";
import { Note } from "@/components/settings-ui";
import { Body, Label } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

// Deliberately loose. The real validator is the confirmation email — this only
// catches "that is not an address" before a round trip.
const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

/**
 * Change the account's email.
 *
 * Supabase runs this as a two-sided confirmation: a link goes to the old
 * address and one to the new, and the change lands only after both are opened.
 * That means this screen's job ends at "sent" — the email on the account
 * updates on its own once the links are tapped, and until then the old address
 * keeps working. Slower than flipping a row, and the reason a stolen session
 * cannot quietly re-home an account.
 */
export default function ChangeEmailScreen() {
  const { status, refresh } = useStatus();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  const current = status.user.email ?? "—";

  const next = email.trim().toLowerCase();
  const ready =
    looksLikeEmail(next) && next !== (status.user.email ?? "").toLowerCase();

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ email: next });
    setBusy(false);

    if (error) return setError(error.message.toLowerCase());
    setSent(true);
    // The user object may already carry `new_email`; harmless if not.
    refresh();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <Screen underHeader>
        {sent ? (
          <>
            <Body tone="dim">
              Confirmation sent to {current} and {next}.
            </Body>
            <Note>
              Open both. The address changes once the two links have been
              tapped; until then, {current} keeps working.
            </Note>
          </>
        ) : (
          <View style={{ gap: space[3] }}>
            <Label>current</Label>
            <Body tone="mute">{current}</Body>

            <Label style={{ marginTop: space[2] }}>new email</Label>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="new address"
              placeholderTextColor={color.inkMute}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={submit}
              style={[field, { backgroundColor: color.surface }]}
            />

            {error && (
              <Body tone="down" accessibilityRole="alert">
                {error}
              </Body>
            )}

            <View style={{ marginTop: space[2] }}>
              <Button
                title="send confirmation"
                onPress={submit}
                disabled={!ready}
                busy={busy}
              />
            </View>

            <Note style={{ paddingHorizontal: 0 }}>
              A link goes to the old address and one to the new. The change
              lands after both are opened — that is what stops a stolen phone
              from quietly re-homing the account.
            </Note>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
