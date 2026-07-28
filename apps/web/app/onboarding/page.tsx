import { redirect } from "next/navigation";
import { getSupabase, getSystemState } from "@/lib/system";
import { Onboarding } from "./onboarding";

export const dynamic = "force-dynamic";

/**
 * First run.
 *
 * The only genuinely new flow in the multi-user version — the web app never had
 * one, because it never had a second user. The signup trigger creates a
 * `system_state` row and nothing else, so this screen is what puts levers on
 * the account. Until it completes there is no dashboard to show.
 *
 * Deliberately NOT behind `requireStatus()`: that is the thing that redirects
 * here, and routing this page through it would loop.
 */
export default async function OnboardingPage() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = await getSystemState(user.id);
  // Already set up — including every account that predates onboarding, which
  // the migration marked done rather than dragging back through setup.
  if (state.onboarded) redirect("/");

  return <Onboarding />;
}
