import { LoginForm } from "./login-form";
import { Wordmark } from "@/app/components/wordmark";
import { safePath } from "@/lib/safe-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="mb-8">
          <Wordmark />
          <p className="text-ink-mute mt-2 text-sm">Authentication required.</p>
        </div>
        <LoginForm
          next={safePath(params.next)}
          error={params.error}
          sent={params.sent === "1"}
        />
      </div>
    </main>
  );
}
