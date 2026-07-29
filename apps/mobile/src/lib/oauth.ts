import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";

/**
 * Third-party sign-in. Both providers end at a Supabase session, so the root
 * layout's `Stack.Protected` gate does the navigation — nothing here routes.
 *
 * `canceled: true` marks the user closing the dialog themselves. That is not
 * an error and must not be rendered as one; the screen ignores it.
 */
export type OAuthResult =
  | { ok: true }
  | { ok: false; reason: string; canceled?: boolean };

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
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, reason: error?.message ?? "No sign-in URL." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    // 'cancel' and 'dismiss' are the user closing the browser.
    return { ok: false, reason: result.type, canceled: true };
  }

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  if (!code) {
    const detail = queryParams?.error_description;
    return {
      ok: false,
      reason: typeof detail === "string" ? detail : "No code in the redirect.",
    };
  }

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { ok: false, reason: exchangeError.message };
  return { ok: true };
}
