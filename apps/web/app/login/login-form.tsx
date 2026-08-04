"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Mode = "in" | "up";

/**
 * Sign in, or create an account.
 *
 * Both modes are on one form because they are the same two fields — a separate
 * page for the second would be two routes to maintain and one more thing to
 * get lost in. The magic link works for either: Supabase creates the account
 * if the address is new, which is why it stays offered in both modes.
 *
 * A new account lands on `/onboarding` rather than the dashboard. That is not
 * this component's business — `requireStatus()` on the server decides it, so a
 * session created any other way (magic link, and later Apple or Google) goes
 * the same route without this file knowing about it.
 */
export function LoginForm({
  next,
  error: initialError,
  sent: initialSent,
}: {
  next: string;
  error?: string;
  sent?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(initialSent ?? false);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  function enter() {
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();

    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return setError(error.message.toLowerCase());
      return enter();
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return setError(error.message.toLowerCase());

    // With email confirmation on, signUp returns a user but no session. Saying
    // "check your inbox" is the honest answer; pushing to the app would land on
    // the login screen again with no explanation.
    if (!data.session) return setConfirm(true);
    enter();
  }

  async function sendMagicLink() {
    setError(null);
    if (!email) {
      setError("email required");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message.toLowerCase());
    else setSent(true);
  }

  if (sent || confirm) {
    return (
      <p className="text-ink-dim text-sm leading-relaxed">
        {confirm ? "Confirmation sent to " : "Link sent to "}
        <span className="tabular text-ink">{email || "your inbox"}</span>. Open
        it on this device.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-12 rounded border px-3 text-sm outline-none transition-colors"
      />

      <label className="sr-only" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        // Tells a password manager to offer a generated password on sign-up and
        // the saved one on sign-in — the wrong hint here is a real annoyance.
        autoComplete={mode === "up" ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-12 rounded border px-3 text-sm outline-none transition-colors"
      />

      {error && (
        <p role="alert" className="text-down text-xs">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-surface-hi border-line-hi text-ink hover:bg-line active:bg-line-hi min-h-12 rounded border px-3 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {pending ? "..." : mode === "in" ? "Sign in" : "Create account"}
      </button>

      {/* The two alternatives, as real controls splitting the width. They were
          bare text at `text-ink-mute text-xs` — no border, no fill — which read
          as a caption under the submit button rather than as two things you
          could click. Same border and radius as the primary above, one step
          quieter in fill and text, so they are unmistakably buttons without
          competing with it. Mirrors `variant="subtle"` on mobile. */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
          className="bg-surface border-line-hi text-ink-dim hover:bg-surface-hi hover:text-ink active:bg-line min-h-12 flex-1 rounded border px-3 text-xs transition-colors"
        >
          {mode === "in" ? "create account" : "sign in"}
        </button>

        <button
          type="button"
          onClick={sendMagicLink}
          className="bg-surface border-line-hi text-ink-dim hover:bg-surface-hi hover:text-ink active:bg-line min-h-12 flex-1 rounded border px-3 text-xs transition-colors"
        >
          {/* "magic link", not mobile's "email a code": this really does send
              a link and land you back here via `/auth/callback`, with nothing
              to type. Mobile's path verifies a 6-digit token instead. Matching
              the wording would misdescribe one of them. */}
          email a link
        </button>
      </div>
    </form>
  );
}
