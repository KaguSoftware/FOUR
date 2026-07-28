import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, startSessionAutoRefresh } from "./supabase";

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startSessionAutoRefresh();

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
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
