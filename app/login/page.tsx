import { LoginForm } from "./login-form";

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
          <h1 className="label mb-1">System</h1>
          <p className="text-ink-mute text-sm">Authentication required.</p>
        </div>
        <LoginForm
          next={params.next ?? "/"}
          error={params.error}
          sent={params.sent === "1"}
        />
      </div>
    </main>
  );
}
