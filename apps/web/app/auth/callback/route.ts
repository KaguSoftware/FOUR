import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { safePath } from "@/lib/safe-path";

/**
 * Magic-link landing. Exchanges the code for a session, then honours the
 * `next` param so a deep link from a Telegram page survives sign-in.
 *
 * Every failure used to leave here as "link expired". That is one real cause
 * among many — a provider refusing consent, a misconfigured redirect and a
 * genuinely stale link all arrived wearing the same label, which makes the
 * screen actively misleading and the logs useless. Each now reports itself.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safePath(searchParams.get("next"));

  const fail = (reason: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(reason)}`,
    );

  // The provider rejected it before we ever saw a code. Its own wording is
  // more accurate than anything we could infer from the absence of one.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail(providerError);

  if (!code) return fail("link expired");

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return NextResponse.redirect(`${origin}${next}`);
}
