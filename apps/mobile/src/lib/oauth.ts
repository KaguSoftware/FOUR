import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { googleSignin } from "./google-native";
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
  if (Platform.OS === "android") {
    const native = await signInWithGoogleNative();
    // `null` means Play Services is genuinely absent — a de-Googled ROM, or a
    // device where it needs updating. Fall through to the browser flow rather
    // than dead-ending; it still works, it is just not the native sheet.
    if (native !== null) return native;
  }

  return signInWithGoogleWeb();
}

/**
 * Sign in with Google on Android, via Credential Manager.
 *
 * This is what Google Sign-In looks like on Android and has since Play
 * Services 23: a bottom sheet listing the accounts already on the device, with
 * the app's name on it, resolved without ever leaving the app. The web flow
 * below — bounce to a Custom Tab, consent screen, redirect back — is what
 * Android apps did before that existed, and to a fluent user it reads as the
 * app not having bothered.
 *
 * It also removes the failure mode the web flow's `detail` diagnostics exist
 * for: there is no redirect URL to misroute, so there is nothing to misroute.
 *
 * The token path is the same one the Apple button already uses —
 * `signInWithIdToken` — so the session, the `Stack.Protected` gate and the
 * routing afterwards are unchanged. Nothing downstream knows which of the
 * three ways the session was created.
 *
 * **Returns `null`, distinctly from a failure, when Play Services is missing.**
 * That is not the user's fault and not an error worth showing: the caller
 * falls back to the web round trip, which needs nothing from Google's SDK.
 *
 * Needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — the **Web** client ID from Google
 * Cloud, not the Android one. Android's own client is matched by package name
 * and SHA-1 certificate fingerprint and is never named in code; the web client
 * is the audience the returned `idToken` is minted for, and it is the value
 * Supabase's Google provider must list as an authorised client. Getting these
 * two confused is the single most common way this flow fails, and it fails
 * with `DEVELOPER_ERROR`, which says nothing.
 */
async function signInWithGoogleNative(): Promise<OAuthResult | null> {
  // `null` in Expo Go, where the native module is not in the binary — the
  // same "not the user's fault" fallback as missing Play Services.
  const gsi = googleSignin();
  if (!gsi) return null;
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = gsi;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    // A build-configuration problem, not a user-facing one. Fall back rather
    // than show someone an error about an environment variable.
    if (__DEV__) {
      console.warn(
        "[oauth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is unset — " +
          "falling back to the browser flow. See README.",
      );
    }
    return null;
  }

  try {
    // Idempotent, and cheap enough to do per attempt rather than keeping a
    // module-level "have I configured this yet" flag that a fast refresh
    // would desynchronise.
    GoogleSignin.configure({ webClientId });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {
    return null;
  }

  try {
    const response = await GoogleSignin.signIn();

    // Dismissing the sheet is a decision, not a failure — the same rule the
    // Apple path and the web path already follow.
    if (!isSuccessResponse(response)) {
      return { ok: false, reason: "canceled", canceled: true };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return {
        ok: false,
        reason: "Google returned no identity token.",
        detail: "native credential manager; check the web client ID",
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, reason: "canceled", canceled: true };
    }
    return {
      ok: false,
      reason: String(e),
      detail: isErrorWithCode(e) ? `code=${e.code}` : undefined,
    };
  }
}

/**
 * The browser round trip. **iOS always, and Android's fallback.**
 *
 * Unchanged from what shipped — see the docblock above `signInWithGoogle` for
 * the `prompt=select_account` and `detail` reasoning, both of which cost a
 * debugging session to arrive at.
 */
async function signInWithGoogleWeb(): Promise<OAuthResult> {
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
