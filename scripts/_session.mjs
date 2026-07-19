import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * Shared sign-in for the local dev scripts.
 *
 * Credentials come from .env.local (gitignored) — never hardcoded, because
 * these scripts live in a public repo.
 */
function env() {
  const out = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !line.trimStart().startsWith("#")) out[m[1]] ??= m[2];
    }
  } catch {
    // No .env.local — fall back to the real environment.
  }
  return out;
}

export async function signIn() {
  const e = env();
  const email = e.DEV_EMAIL;
  const password = e.DEV_PASSWORD;

  if (!email || !password) {
    console.error(
      "Set DEV_EMAIL and DEV_PASSWORD in .env.local to use the dev scripts.",
    );
    process.exit(1);
  }

  const sb = createClient(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("sign-in failed:", error.message);
    process.exit(1);
  }
  return { sb, user: data.user, session: data.session, env: e };
}

/** Logical dates relative to a fixed anchor, for reproducible seeding. */
export const dayOffset = (anchorISO, n) => {
  const [y, m, d] = anchorISO.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
