import { Redirect } from "expo-router";

import { useSession } from "@/lib/session";

/**
 * Safety net for the OAuth redirect.
 *
 * On iOS `openAuthSessionAsync` intercepts the redirect before the router ever
 * sees it, so this screen normally never renders. Android's Custom Tab
 * sometimes delivers the callback as a deep link into the app instead — this
 * route catches it so the URL resolves to something instead of an unmatched
 * route screen mid-sign-in. The code exchange itself lives in `lib/oauth.ts`;
 * by the time navigation settles the session either exists or it does not,
 * and the root gate routes accordingly.
 */
export default function AuthCallback() {
  const { session } = useSession();
  return <Redirect href={session ? "/" : "/sign-in"} />;
}
