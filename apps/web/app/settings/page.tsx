import { redirect } from "next/navigation";
import { getStatus } from "@/lib/system";
import { signOut } from "@/app/actions";
import { LeverManager } from "./lever-manager";
import { SlammedToggle } from "./slammed-toggle";
import { WeightToggle } from "./weight-toggle";
import { TelegramSetup } from "./telegram-setup";
import { BackLink } from "@/app/components/nav-link";
import { Wordmark } from "@/app/components/wordmark";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const status = await getStatus();
  if (!status) redirect("/login");

  const { state, slammed, user } = status;

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-baseline justify-between">
        <Wordmark page="settings" />
        <BackLink />
      </header>

      <section className="border-line mb-6 border-b pb-6">
        <LeverManager levers={status.levers} />
      </section>

      <section className="border-line border-b py-6">
        <SlammedToggle on={slammed} until={state.slammed_until} />
      </section>

      <section className="border-line border-b py-6">
        <WeightToggle on={state.weight_enabled} />
      </section>

      <Row label="timezone" value={state.timezone} />

      <section className="mb-2">
        <TelegramSetup chatId={state.telegram_chat_id} />
      </section>

      <Row label="account" value={user.email ?? "—"} />

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="border-line text-ink-mute hover:text-ink-dim active:text-ink min-h-11 rounded border px-4 text-xs transition-colors"
        >
          sign out
        </button>
      </form>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex items-baseline justify-between border-b py-3">
      <span className="label">{label}</span>
      <span className="text-ink-dim text-xs">{value}</span>
    </div>
  );
}
