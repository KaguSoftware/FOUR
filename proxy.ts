import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/proxy";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Do not run code between createClient and getUser — a mistimed call here
  // makes sessions randomly log out and it is miserable to debug.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the deep link so a page from Telegram survives sign-in.
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - static assets
     *  - the cron endpoint, which authenticates with CRON_SECRET rather than
     *    a user session
     *  - the manifest and icons, which iOS fetches WITHOUT the session cookie
     *    when installing to the home screen. Redirecting those to /login
     *    silently breaks "Add to Home Screen".
     */
    "/((?!_next/static|_next/image|api/monitor|manifest.webmanifest|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
