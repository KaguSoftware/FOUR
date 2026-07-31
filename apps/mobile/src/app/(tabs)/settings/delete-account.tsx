import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";

import { Button } from "@/components/button";
import { field, fieldTint } from "@/components/fields";
import { Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { Body, Label } from "@/components/ui";
import { clearOutbox } from "@/lib/outbox";
import { cancelReminder } from "@/lib/reminder";
import { supabase } from "@/lib/supabase";
import { clearStatusCache, useStatus } from "@/lib/use-status";
import { color, space } from "@/theme";

/**
 * The one place the product deletes.
 *
 * Everywhere else the rule is archive-never-delete, because history is the
 * product. Here the data belongs to the user and they are asking for it gone —
 * so it goes, entirely, via a definer RPC that can only ever target the
 * caller's own row. Apple requires this flow to exist in-app; the FK layout
 * was set up for it a migration ago.
 *
 * Two gates on purpose: type the word, then the platform's own destructive
 * alert. The typed word is not a password check — the session already proves
 * the account — it is a speed bump that makes "I was just tapping" impossible
 * for the one action that cannot be walked back.
 *
 * It used to ask for the account's email address, which locked out the people
 * most likely to need this screen: sign in with Apple or Google and you may
 * never have been shown which address the account carries, so the gate demands
 * a string the user has no way to know. A flow Apple requires to exist cannot
 * be one a real user can be shut out of. `DELETE` is knowable by everyone,
 * unambiguous, and impossible to arrive at by accident.
 */
/** Typed verbatim to arm the button. Uppercase so the match can be exact. */
const CONFIRM_WORD = "DELETE";

export default function DeleteAccountScreen() {
  const { status } = useStatus();
  // Under a shown native header, `padding` under-avoids by exactly the
  // header's height without this — see change-password.
  const headerHeight = useHeaderHeight();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!status) return <Loading />;

  // Case-sensitive on purpose. Matching `delete` too would let the keyboard's
  // own autocapitalisation decide whether the gate is a gate.
  const armed = typed.trim() === CONFIRM_WORD;

  function confirm() {
    if (!armed || busy) return;
    Alert.alert(
      "Delete this account?",
      "Every entry, run, outage, note and setting goes with it. There is no undo and nothing is kept.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete forever", style: "destructive", onPress: destroy },
      ],
    );
  }

  async function destroy() {
    setBusy(true);
    setError(null);

    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setBusy(false);
      return setError("Couldn't delete the account. Try again.");
    }

    // The row is gone; now make the device forget. Order matters only in that
    // all of it must happen — the sign-out flips the auth gate and unmounts
    // this screen.
    await cancelReminder();
    clearOutbox();
    clearStatusCache();
    await supabase.auth.signOut();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <Screen underHeader>
        <Body tone="ink">This deletes the account and everything on it.</Body>
        <Body tone="mute" style={{ marginTop: space[3] }}>
          Every entry, note and setting — permanently, from the server. Want a
          copy first? Export it from Account.
        </Body>

        <Label style={{ marginTop: space[8], marginBottom: space[3] }}>
          type {CONFIRM_WORD} to confirm
        </Label>
        <TextInput
          {...fieldTint}
          value={typed}
          onChangeText={setTyped}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={color.inkMute}
          // Caps by default so the exact match costs one tap, not a shift
          // dance — the friction should come from meaning it, not from typing.
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          style={[field, { backgroundColor: color.surface }]}
        />

        {error && (
          <Body tone="down" accessibilityRole="alert" style={{ marginTop: space[3] }}>
            {error}
          </Body>
        )}

        <View style={{ marginTop: space[4] }}>
          <Button
            title="delete account forever"
            onPress={confirm}
            disabled={!armed}
            busy={busy}
            destructive
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
