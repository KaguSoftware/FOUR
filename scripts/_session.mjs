import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Shared sign-in for the local dev scripts.
 *
 * Credentials come from .env.local (gitignored) — never hardcoded, because
 * these scripts live in a public repo.
 *
 * The env file lives at apps/web/.env.local, which is where Next.js natively
 * looks for it. Resolving from this file rather than process.cwd() keeps one
 * copy of the secrets instead of one per workspace, and lets the scripts run
 * from anywhere in the tree.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ENV_CANDIDATES = [
  join(REPO_ROOT, "apps", "web", ".env.local"),
  join(REPO_ROOT, ".env.local"),
];

function env() {
  const out = { ...process.env };
  for (const path of ENV_CANDIDATES) {
    let contents;
    try {
      contents = readFileSync(path, "utf8");
    } catch {
      continue; // Not there — try the next candidate, then the real environment.
    }
    for (const line of contents.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !line.trimStart().startsWith("#")) out[m[1]] ??= m[2];
    }
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
