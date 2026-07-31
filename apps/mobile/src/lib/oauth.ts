import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase } from "./supabase";

/**
 * Third-party sign-in. Both providers end at a Supabase session, so the root
 * layout's `Stack.Protected` gate does the navigation — nothing here routes.
 *
 * `canceled: true` marks the user closing the dialog themselves. That is not
 * an error and must not be rendered as one; the screen ignores it.
 *
 * `detail` carries the redirect URL and the browser's verdict. It exists
 * because this flow spent a debugging session unfalsifiable: every non-success
 * was reported as a cancellation, so a redirect landing somewhere unexpected
 * showed the user precisely nothing. Anything that is not a plain user
 * cancellation must be able to say where it actually went.
 */
export type OAuthResult =
  | { ok: true }
  | { ok: false; reason: string; canceled?: boolean; detail?: string };

/**
 * Sign in with Apple, via the native sheet.
 *
 * The nonce dance: Apple embeds whatever nonce the request carries verbatim in
 * the identity token, and Supabase compares the token's claim against the
 * SHA-256 of the raw nonce it is given. So the HASH goes to Apple and the RAW
 * value goes to Supabase, and a stolen token cannot be replayed against a
 * different sign-in attempt.
 *
 * Expo Go caveat: the token's audience is Expo Go's own bundle id, so the
 * Supabase Apple provider must list `host.exp.Exponent` alongside
 * `com.kagusoftware.uptime` or verification fails with a reason that names
 * the audience.
 */
export async function signInWithApple(): Promise<OAuthResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ERR_REQUEST_CANCELED") {
      return { ok: false, reason: "canceled", canceled: true };
    }
    return { ok: false, reason: String(e) };
  }

  if (!credential.identityToken) {
    return { ok: false, reason: "Apple returned no identity token." };
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/**
 * Sign in with Google, via the system browser.
 *
 * No native Google module exists that runs in Expo Go, so this is the OAuth
 * web round-trip: Supabase builds the consent URL, the auth session opens it,
 * and the redirect lands back here carrying a PKCE code the client exchanges
 * for a session. `Linking.createURL` makes the redirect scheme-correct in
 * both worlds — `exp://…` inside Expo Go, `uptime://…` in a real build — and
 * whichever one is in play must be on the Supabase redirect allowlist.
 *
 * `prompt=select_account` is not optional. The auth session shares Safari's
 * cookie jar, so without it an existing Google session is chosen silently and
 * the user never learns WHICH account they signed up with — which then breaks
 * every screen that names their address back to them, and makes "why is my
 * data missing" unanswerable. The alternative, `preferEphemeralSession`, gets
 * the picker by discarding the shared session entirely and costs a full
 * password login every time; too harsh for the problem.
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data?.url) {
    return { ok: false, reason: error?.message ?? "No sign-in URL." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    // Only `cancel` is unambiguously the user's own decision. Android returns
    // `dismiss` for the back button too, so it stays silent there — but on iOS
    // a user cancel is always `cancel`, which makes `dismiss` a real fault and
    // reporting it as a cancellation is how a broken redirect hides.
    const userClosed =
      result.type === "cancel" ||
      (Platform.OS === "android" && result.type === "dismiss");

    return {
      ok: false,
      reason: userClosed ? result.type : `Sign-in did not complete (${result.type}).`,
      canceled: userClosed,
      detail: `redirectTo=${redirectTo}`,
    };
  }

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  if (!code) {
    const described = queryParams?.error_description;
    return {
      ok: false,
      reason:
        typeof described === "string" ? described : "No code in the redirect.",
      // The landing URL is the single most useful fact when this fails, and
      // it is the one thing the old code threw away.
      detail: `redirectTo=${redirectTo} landed=${result.url}`,
    };
  }

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return {
      ok: false,
      reason: exchangeError.message,
      detail: `redirectTo=${redirectTo}`,
    };
  }
  return { ok: true };
}
