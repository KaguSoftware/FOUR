import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/app/components/wordmark";

/**
 * The privacy policy.
 *
 * Required by Apple before this app can go to external TestFlight testers, and
 * linked from Settings on both clients. It is deliberately PUBLIC — see
 * `PUBLIC_PATHS` in `proxy.ts`. A policy behind a sign-in wall is not a policy,
 * and App Review reads it while signed out.
 *
 * Written plainly on purpose. The honest version of this document is short
 * because the app genuinely collects very little: an email to sign you in, the
 * things you choose to log, and a push token if you turn alerts on. There is no
 * analytics SDK, no advertising identifier, and nothing to say about either, so
 * nothing here pads it out to look thorough.
 *
 * If a column is added that holds anything a person would recognise as theirs,
 * it belongs in "What four stores" below on the same commit.
 */

/**
 * The published contact address.
 *
 * A policy has to name a reachable human. Deliberately the SAME address the app
 * already publishes as Support in `settings/about.tsx` — two different contacts
 * for one product is how people end up mailing the one nobody reads. Swap both
 * for a role address if `four` ever gets a domain.
 */
const CONTACT = "parsaa.mansourii@gmail.com";

/** Bump on any change to the substance below, not on typo fixes. */
const LAST_UPDATED = "30 July 2026";

export const metadata: Metadata = {
  title: "Privacy — four",
  description: "What four stores, what it never collects, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-12">
        <Wordmark />
        <h1 className="text-ink mt-6 text-2xl">Privacy</h1>
        <p className="text-ink-mute mt-2 text-sm">
          Last updated <span className="tabular">{LAST_UPDATED}</span>
        </p>
      </header>

      <p className="text-ink-dim">
        <span className="text-ink">four</span> is an uptime monitor for one body.
        It exists to notice when you fade and make restarting trivial. That job
        needs very little about you, so it asks for very little.
      </p>

      <Section title="What four stores">
        <Item term="Your email address">
          To sign you in and to send a password reset if you ask for one. It is
          not used for marketing and there is no mailing list to be on.
        </Item>
        <Item term="What you log">
          The date, which lever you logged, and any note you attach to it. Notes
          are optional and always have been.
        </Item>
        <Item term="How the day felt">
          A single number from one to a hundred, set by dragging a slider, on
          the days you choose to set it. Nothing else — the app asks one
          question and it is optional.
        </Item>
        <Item term="A push token">
          Only if you turn alerts on. It is an identifier issued by Apple or
          Google for one install of the app, and it is the only way a
          notification can reach your device. Turning alerts off discards it.
        </Item>
        <Item term="Your time zone">
          So the day rolls over at 04:00 where you are rather than where the
          server is. Read from your device, never from your IP address.
        </Item>
        <Item term="Your settings">
          Your levers and their names, whether slammed mode is on, and your
          reminder time.
        </Item>
      </Section>

      <Section title="What four never collects">
        <p className="text-ink-dim">
          No analytics. No tracking pixels, no advertising identifier, no
          third-party SDK watching what you tap. Nothing is sold, rented, or
          shared for marketing, and there is no mechanism in the app capable of
          doing so.
        </p>
        <p className="text-ink-dim mt-4">
          Your location, contacts, photos, microphone, camera, calendar and
          health app are never read. Nothing is written to Apple Health or
          Google Fit.
        </p>
      </Section>

      <Section title="The daily reading">
        <p className="text-ink-dim">
          It is health-adjacent, so it gets said plainly: it is stored exactly
          like everything else you log, visible only to your account, and never
          shared with anyone or used for any purpose other than drawing your
          own history back to you. It is not sent to any health platform and it
          is not used to profile you.
        </p>
        <p className="text-ink-dim mt-4">
          Earlier versions of the app also recorded energy, sleep and an
          optional weight. Those readings are no longer collected. Anything you
          already wrote is kept and still shown on the day it belongs to,
          because deleting your history without asking would be the worse
          answer — and everything of yours leaves with your account.
        </p>
      </Section>

      <Section title="Who else handles it">
        <p className="text-ink-dim">
          Three service providers, each doing one job and none of them permitted
          to use your data for anything else:
        </p>
        <ul className="mt-4 space-y-3">
          <Provider name="Supabase">
            Hosts the database and handles sign-in. Access is enforced per row,
            so one account cannot read another&apos;s data.
          </Provider>
          <Provider name="Vercel">Hosts the web app.</Provider>
          <Provider name="Apple and Google push services">
            Carry the notification itself, and only when alerts are on. They see
            the text of the alert and the device it is going to.
          </Provider>
        </ul>
        <p className="text-ink-mute mt-4 text-sm">
          These providers operate servers in several countries, so your data may
          be processed outside the country you live in.
        </p>
      </Section>

      <Section title="Deleting everything">
        <p className="text-ink-dim">
          <span className="text-ink">Settings → delete account</span>, in the
          app. It is immediate and it is complete: every entry, note, lever,
          signal and setting is removed along with the account itself. Nothing
          is kept in a holding area and there is no copy to ask about
          afterwards.
        </p>
        <p className="text-ink-mute mt-4 text-sm">
          Because it is irreversible, it asks you to confirm first. There is no
          undo.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p className="text-ink-dim">
          For as long as your account exists, because the whole point is that
          your history is still there when you come back after a break. An
          all-time figure that quietly forgot last year would defeat the
          product. Delete the account and it goes.
        </p>
      </Section>

      <Section title="Children">
        <p className="text-ink-dim">
          four is not directed at children under 13 and does not knowingly
          collect anything from them.
        </p>
      </Section>

      <Section title="Changes">
        <p className="text-ink-dim">
          If this changes in a way that affects what is collected or who touches
          it, the date at the top of this page changes with it.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-ink-dim">
          Questions about any of the above, or about your own data:{" "}
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

/**
 * A stored category. The term carries `ink` and the explanation `ink-dim`, so
 * the list can be skimmed for WHAT is held before reading why.
 */
function Item({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line border-t py-4 first:border-t-0 first:pt-0">
      <p className="text-ink">{term}</p>
      <p className="text-ink-dim mt-1">{children}</p>
    </div>
  );
}

function Provider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="text-ink-dim">
      <span className="text-ink">{name}</span> — {children}
    </li>
  );
}
