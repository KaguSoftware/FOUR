import { redirect } from "next/navigation";
import { getStatus } from "@/lib/system";
import { PlaybookList } from "./playbook-list";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

/**
 * The playbook: what has already worked, ranked by use.
 *
 * Self-populating from logging — editable, never mandatory. The point is that
 * fading or restarting never opens on a blank page.
 */
export default async function PlaybookPage() {
  const status = await getStatus();
  if (!status) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page="playbook" />
        <BackLink />
      </header>

      <PlaybookList items={status.playbook} levers={status.levers} />
    </main>
  );
}
