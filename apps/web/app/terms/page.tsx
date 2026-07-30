import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/app/components/wordmark";

/**
 * Terms of use.
 *
 * Linked from Settings → About in the app, so it has to resolve — a dead legal
 * link is a metadata rejection waiting for a reviewer to tap it. Public for the
 * same reason as /privacy: it is read signed-out.
 *
 * Short on purpose. The app is free, collects almost nothing, and sells
 * nothing, so most boilerplate has nothing to govern here. The clause that
 * actually matters for this product is "not medical advice" — the app stores
 * energy, sleep and weight, and the line between "a diary that draws charts"
 * and "a health product" should be drawn by us before anyone else draws it.
 */

const CONTACT = "parsaa.mansourii@gmail.com";
const LAST_UPDATED = "30 July 2026";

export const metadata: Metadata = {
  title: "Terms — four",
  description: "The terms for using four.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-12">
        <Wordmark />
        <h1 className="text-ink mt-6 text-2xl">Terms of use</h1>
        <p className="text-ink-mute mt-2 text-sm">
          Last updated <span className="tabular">{LAST_UPDATED}</span>
        </p>
      </header>

      <p className="text-ink-dim">
        Using <span className="text-ink">four</span> — the app or the web app —
        means agreeing to these terms. They are short because the deal is
        simple: it is a free tool for tracking whether you did one small real
        thing today.
      </p>

      <Section title="What four is, and is not">
        <p className="text-ink-dim">
          four is a self-tracking tool. It is <span className="text-ink">not
          a medical device, not medical advice, and not a treatment for
          anything</span>. The energy, sleep and weight you log are drawn back
          to you as your own history and nothing more — no diagnosis, no
          recommendation, no score of your health. If something about your
          health worries you, talk to a professional, not an app.
        </p>
      </Section>

      <Section title="Your account">
        <p className="text-ink-dim">
          You need to be at least 13 to use four. Keep your sign-in to
          yourself; what happens on your account is yours. You can delete the
          account at any time from Settings, and deletion is immediate and
          complete — see the{" "}
          <Link
            href="/privacy"
            className="text-ink underline decoration-line-hi underline-offset-4"
          >
            privacy policy
          </Link>{" "}
          for exactly what is stored while it exists.
        </p>
      </Section>

      <Section title="Your data is yours">
        <p className="text-ink-dim">
          Everything you log belongs to you. four claims no rights over your
          entries or notes beyond what is needed to store them and show them
          back to you. You can export a copy from Settings at any time.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p className="text-ink-dim">
          Don&apos;t attempt to break the service, probe other people&apos;s
          data, or use the app for anything unlawful. Access is enforced per
          account on the server; trying to get around that is the one thing
          that gets an account closed by us rather than by you.
        </p>
      </Section>

      <Section title="No warranty">
        <p className="text-ink-dim">
          four is provided as-is, free of charge, without warranty of any
          kind. It aims to be reliable — that is the whole point of an uptime
          monitor — but it may be unavailable, change, or end. If it ends,
          reasonable notice and a way to export your data come first. To the
          extent the law allows, liability for using four is limited to
          nothing, because nothing is what it costs.
        </p>
      </Section>

      <Section title="Changes">
        <p className="text-ink-dim">
          If these terms change in a way that matters, the date at the top
          changes with them, and continued use after that is acceptance. On
          iOS, Apple&apos;s standard licensed-application terms also apply
          where they go further than these.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-ink-dim">
          Questions:{" "}
          <a
            href={`mailto:${CONTACT}`}
            className="text-ink underline decoration-line-hi underline-offset-4"
          >
            {CONTACT}
          </a>
        </p>
      </Section>

      <footer className="border-line mt-12 border-t pt-6">
        <Link href="/" className="text-ink-mute text-sm underline underline-offset-4">
          Back to the dashboard
        </Link>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="label mb-3">{title}</h2>
      {children}
    </section>
  );
}
