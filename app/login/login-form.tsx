"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(initialSent ?? false);
  const [pending, startTransition] = useTransition();

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message.toLowerCase());
      return;
    }
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
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

  if (sent) {
    return (
      <p className="text-ink-dim text-sm leading-relaxed">
        Link sent to{" "}
        <span className="tabular text-ink">{email || "your inbox"}</span>. Open
        it on this device.
      </p>
    );
  }

  return (
    <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
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
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute rounded border px-3 py-2.5 text-sm outline-none transition-colors"
      />

      <label className="sr-only" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute rounded border px-3 py-2.5 text-sm outline-none transition-colors"
      />

      {error && (
        <p role="alert" className="text-down text-xs">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-surface-hi border-line-hi text-ink hover:bg-line active:bg-line-hi rounded border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {pending ? "..." : "Sign in"}
      </button>

      <button
        type="button"
        onClick={sendMagicLink}
        className="text-ink-mute hover:text-ink-dim mt-1 text-xs transition-colors"
      >
        or send a magic link
      </button>
    </form>
  );
}
