import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, startSessionAutoRefresh } from "./supabase";
import { clearStatusCache } from "./use-status";
import { clearOutbox } from "./outbox";

/**
 * Who is signed in, and whether they have finished first-run setup.
 *
 * Both answers gate navigation, so they live in one place rather than being
 * re-derived per screen. `onboarded` is a separate fetch from the session
 * because a valid session says nothing about whether the account has levers —
 * the signup trigger creates `system_state` and nothing else.
 */

type SessionState = {
  session: Session | null;
  /** Null while unknown. Navigation must not decide anything until it isn't. */
  onboarded: boolean | null;
  loading: boolean;
  /** Called by onboarding on completion, so the gate reopens without a refetch. */
  markOnboarded: () => void;
  refreshOnboarded: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function useSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

async function fetchOnboarded(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("system_state")
    .select("onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();

  // A failed read must NOT read as "onboarded" — that would drop someone onto
  // a dashboard with no levers. Unknown resolves to "needs onboarding", which
  // is the recoverable direction: that screen is idempotent and exits early if
  // the account turns out to be set up already.
  if (error) return false;
  return data?.onboarded_at != null;
}

/**
 * Is the stored session still backed by a real user?
 *
 * `getSession()` reads the keychain and asks nobody, so a session whose user
 * has been deleted still looks perfectly valid: the gate lets them in, decides
 * they are un-onboarded (the `system_state` row went with the user), and parks
 * them on a screen where every write fails. That is not hypothetical — the
 * owner deleted their own auth row mid-setup on 2026-07-30 and the app trapped
 * them in "Could not save that. Try again." with no exit.
 *
 * `getUser()` asks the server, so it is the only thing that can tell the
 * difference. **Only an explicit auth rejection counts.** A network failure
 * must never sign anyone out — this app is built to work in a gym basement,
 * and resolving "offline" to "signed out" would throw away the keychain
 * session and the unsent outbox with it.
 */
async function userStillExists(): Promise<boolean> {
  const { error } = await supabase.auth.getUser();
  if (!error) return true;
  const status = (error as { status?: number }).status;
  return status !== 401 && status !== 403;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Read inside the auth listener without re-subscribing on every session
  // change — resubscribing would tear down and rebuild the listener mid-flight.
  const currentUserId = session?.user.id;
  const userIdRef = useRef(currentUserId);
  userIdRef.current = currentUserId;

  useEffect(() => {
    startSessionAutoRefresh();

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;

      // Validate before trusting it — see `userStillExists`. `scope: "local"`
      // so the keychain is cleared even though the server call is guaranteed to
      // fail (the user it would authenticate is gone).
      if (data.session && !(await userStillExists())) {
        await supabase.auth.signOut({ scope: "local" });
        if (active) setLoading(false);
        return;
      }

      if (!active) return;
      setSession(data.session);
      setOnboarded(
        data.session ? await fetchOnboarded(data.session.user.id) : null,
      );
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, next) => {
        if (!active) return;
        // Before anything else: one account must never see another's cached
        // dashboard for even a frame — nor inherit its unsent taps, which the
        // outbox would otherwise flush under the new user's credentials.
        if (next?.user.id !== userIdRef.current) {
          clearStatusCache();
          clearOutbox();
        }
        setSession(next);
        // Cleared on sign-out so the next account cannot inherit the previous
        // one's answer for the moment before its own fetch lands.
        setOnboarded(next ? await fetchOnboarded(next.user.id) : null);
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        onboarded,
        loading,
        markOnboarded: () => setOnboarded(true),
        refreshOnboarded: async () => {
          if (session) setOnboarded(await fetchOnboarded(session.user.id));
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
