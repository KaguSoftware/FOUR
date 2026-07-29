import { Redirect } from "expo-router";

import { useSession } from "@/lib/session";

/**
 * Safety net for the OAuth redirect.
 *
 * On iOS `openAuthSessionAsync` intercepts the redirect before the router ever
 * sees it, so this screen normally never renders. Android's Custom Tab
 * sometimes delivers the callback as a deep link into the app instead — this
 * route catches it so the URL resolves to something instead of an unmatched
 * route screen mid-sign-in.
 *
 * The redirect must cover ALL THREE gate states, not just signed-in/out. It
 * originally sent every session to "/", and for a brand-new account "/" does
 * not exist — `(tabs)` is guarded behind `onboarded === true` — so the first
 * Apple sign-in on a fresh account redirected into nothing and showed a blank
 * screen (on device, 2026-07-29). A target the gate has actually mounted:
 */
export default function AuthCallback() {
  const { session, onboarded } = useSession();

  if (!session) return <Redirect href="/sign-in" />;
  if (onboarded === false) return <Redirect href="/onboarding" />;
  return <Redirect href="/" />;
}
