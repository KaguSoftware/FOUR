import { redirect } from "next/navigation";
import { getStatus } from "@/lib/system";
import { PlaybookList } from "./playbook-list";
import { BackLink } from "@/app/components/back-link";

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
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="label">Playbook</h1>
        <BackLink />
      </header>

      <PlaybookList items={status.playbook} />
    </main>
  );
}
