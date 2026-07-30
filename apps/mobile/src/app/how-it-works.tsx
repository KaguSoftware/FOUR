import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { addDays, gridFill, type Entry } from "@uptime/core";

import { Button } from "@/components/button";
import { DayGrid } from "@/components/day-grid";
import { LeverButtons } from "@/components/lever-buttons";
import { Body, Label, Mono, Rule, Wordmark } from "@/components/ui";
import { today } from "@/lib/status";
import type { LeverRow } from "@/lib/status";
import { color, radius, size, space, TAP } from "@/theme";

const STEPS = 7;

/** One name per page — the announcement a screen reader gets on page change. */
const TITLES = [
  "The number",
  "The levers",
  "The grid",
  "The outage screen",
  "The pager",
  "The journal",
  "The rest",
] as const;

/**
 * The manual. Every control in the app, shown and explained.
 *
 * Opened once, automatically, the first time the dashboard mounts on a device
 * (see `lib/walkthrough.ts`), and any time after that from Settings → About.
 * It exists because the one thing the dashboard cannot say about itself is
 * what its parts mean: the owner — who built the thing — read "24/30" as
 * "this month" and asked why the month was a day short. If the author
 * misreads it, a stranger will.
 *
 * **The pages render the REAL components** — the same `DayGrid`, the same
 * `LeverButtons`, the same ramp function colouring the legend swatches — fed
 * sample data. A guide made of screenshots or redrawn mockups starts lying
 * the first time a component changes; this one cannot drift because it and
 * the app share the parts.
 *
 * Same register as everything else: it explains, it does not sell, and
 * nothing in it congratulates.
 */
export default function HowItWorksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollView>(null);

  // A page change is a page change, not a re-render of the same one. The
  // scroll position resets — a long page scrolled to reach "next" must not
  // hand its offset to the next page, which would open headless — and a
  // screen reader is told, because swapping a subtree under local state fires
  // no navigation event and is otherwise silent.
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(
      `Page ${step + 1} of ${STEPS}: ${TITLES[step]}`,
    );
  }, [step]);

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: color.bg }}
      // JS owns the insets — same rule as every other ScrollView in the app.
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: space[5],
        // `insets.top` is 0 inside an iOS pageSheet, so this is the sheet
        // margin there — but Android presents "modal" as a fullscreen screen
        // under an edge-to-edge status bar, where the inset is load-bearing.
        paddingTop: insets.top + space[8],
        paddingBottom: Math.max(insets.bottom, space[4]) + space[4],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[8],
        }}
      >
        <Wordmark />
        <Label accessibilityLabel={`Page ${step + 1} of ${STEPS}`}>
          {step + 1} / {STEPS}
        </Label>
      </View>

      {step === 0 && <TheNumber />}
      {step === 1 && <TheLevers />}
      {step === 2 && <TheGrid />}
      {step === 3 && <TheOutage />}
      {step === 4 && <ThePager />}
      {step === 5 && <TheJournal />}
      {step === 6 && <TheRest />}

      <View style={{ marginTop: "auto", paddingTop: space[8] }}>
        <Button
          title={step === STEPS - 1 ? "got it" : "next"}
          onPress={() =>
            step === STEPS - 1 ? router.back() : setStep(step + 1)
          }
          tall
        />
        {step > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to the previous page"
            onPress={() => setStep(step - 1)}
            style={{
              minHeight: TAP,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Body tone="mute" style={{ fontSize: size.xs }}>
              ← back
            </Body>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

// --- shared pieces -----------------------------------------------------------

const heading = {
  fontFamily: "Inter_400Regular",
  fontSize: size.lg,
  lineHeight: size.lg * 1.4,
  color: color.ink,
} as const;

/** A framed specimen: the real component, set apart from the prose. */
function Specimen({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: space[5],
        padding: space[4],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color.line,
        backgroundColor: color.surface,
      }}
      // One object to the reader; each page's prose does the explaining.
      accessible
    >
      {children}
    </View>
  );
}

/** One annotated fact: a key on the left, what it means on the right. */
function Callout({
  swatch,
  term,
  children,
}: {
  swatch?: React.ReactNode;
  term: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space[3],
        marginTop: space[4],
        alignItems: "flex-start",
      }}
    >
      {swatch && <View style={{ marginTop: 2 }}>{swatch}</View>}
      <View style={{ flex: 1 }}>
        <Body tone="ink">{term}</Body>
        <Body tone="mute" style={{ marginTop: 2 }}>
          {children}
        </Body>
      </View>
    </View>
  );
}

/** A grid-cell swatch, coloured by the SAME ramp the real grid uses. */
function Cell({
  fired,
  of,
  outline,
  ring,
}: {
  fired?: number;
  of?: number;
  outline?: boolean;
  ring?: boolean;
}) {
  const fill = fired !== undefined ? gridFill(fired, of ?? fired) : null;
  return (
    <View
      style={{
        width: 21,
        height: 21,
        borderRadius: radius.sm,
        backgroundColor: fill ?? color.surface,
        borderWidth: ring ? 2 : outline || !fill ? 1 : 0,
        borderColor: ring ? color.ink : color.line,
      }}
    />
  );
}

// --- sample data -------------------------------------------------------------

const DEMO_LEVERS: LeverRow[] = [
  { id: "demo-1", key: "gym", label: "gym", position: 1, archived: false, created_at: "", archived_at: null },
  { id: "demo-2", key: "food", label: "food", position: 2, archived: false, created_at: "", archived_at: null },
  { id: "demo-3", key: "pages", label: "pages", position: 3, archived: false, created_at: "", archived_at: null },
];

/**
 * A month of plausible history, generated around the real `today` so the grid
 * page always shows the current month with the ring on the actual today.
 * Deterministic — the same account every time, not a random one.
 */
function demoMonth(now: string): Entry[] {
  const entries: Entry[] = [];
  for (let back = 1; back <= 31; back++) {
    const date = addDays(now, -back);
    if (back % 5 === 0) continue; // a down day — gaps are part of the picture
    const count = back % 3 === 0 ? 3 : back % 2 === 0 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      entries.push({ logged_for: date, lever: DEMO_LEVERS[i].key, detail: null });
    }
  }
  // Today: one lever logged — enough, which is the whole point.
  entries.push({ logged_for: now, lever: "gym", detail: null });
  return entries;
}

const DEMO_SPANS = [{ created_on: "2026-01-01", archived_on: null }];

// --- the pages ---------------------------------------------------------------

function TheNumber() {
  return (
    <>
      <Text style={heading}>The number at the top.</Text>

      <Specimen>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Mono
            style={{
              fontFamily: "JetBrainsMono_500Medium",
              fontSize: size.hero,
              lineHeight: size.hero * 1.05,
            }}
          >
            23
          </Mono>
          <Mono style={{ fontSize: size.xl, color: color.inkMute }}>/30</Mono>
        </View>
        <Body tone="mute" style={{ marginTop: space[2] }}>
          days up · last 30d
          <Text style={{ color: color.inkDim }}> · current run 6d</Text>
        </Body>
      </Specimen>

      <Callout term="Days up, out of the last 30">
        A rolling window, not the calendar month. It slides forward each day
        and never resets — a bad week moves it a few days, never to zero.
      </Callout>
      <Callout term="A day is up if you did ONE of your levers">
        One, not all. Any one small real thing puts the day up on its own.
      </Callout>
      <Callout term="current run">
        Days up in a row, right now. It disappears rather than showing a zero —
        nothing in this app renders a zero at you.
      </Callout>
      <Callout term="up / degraded — top right of the dashboard">
        <Text style={{ color: color.inkDim }}>up</Text> means today or
        yesterday is logged.{" "}
        <Text style={{ color: color.degraded }}>degraded</Text> means the
        system is down and waiting for one small thing.
      </Callout>
    </>
  );
}

function TheLevers() {
  return (
    <>
      <Text style={heading}>The levers. The thing you open the app to press.</Text>

      {/* The REAL component with demo data. Taps are wired to nothing, so
          pressing one here is a safe rehearsal. */}
      <Specimen>
        <LeverButtons
          levers={DEMO_LEVERS}
          todayLevers={["gym"]}
          onPress={() => {}}
        />
      </Specimen>

      <Callout term="Tap one → the day is up">
        One tap logs it. A sheet slides up offering to note what you did —
        optional, always. &ldquo;Just mark it up&rdquo; logs with no note.
      </Callout>
      <Callout term="The filled one is already logged today">
        Tapping it again lets you add what else you did, or remove it if the
        tap was a mistake.
      </Callout>
      <Callout term="Hold and drag">
        Reorders them. Drag onto the trash that appears to archive — the
        button goes away, every day you logged with it stays.
      </Callout>
      <Callout term="+ add a lever">
        Up to four. A lever is one small real thing you can still do on a bad
        day — rename or swap them any time in Settings without losing history.
      </Callout>
    </>
  );
}

function TheGrid() {
  const now = today();
  const entries = useMemo(() => demoMonth(now), [now]);

  return (
    <>
      <Text style={heading}>The grid is this month, day by day.</Text>

      {/* The real month grid, real ramp, sample history, actual today. */}
      <Specimen>
        <DayGrid
          entries={entries}
          today={now}
          spans={DEMO_SPANS}
          mode="month"
        />
      </Specimen>

      <Callout swatch={<Cell fired={3} of={3} />} term="Bright — every lever fired">
        The more of your levers fired that day, the lighter the cell.
      </Callout>
      <Callout swatch={<Cell fired={1} of={3} />} term="Dim — some did">
        Still a whole cell, still an up day. Dim is not a failure; the day
        counts the same in the number above.
      </Callout>
      <Callout swatch={<Cell outline />} term="Outlined — a down day">
        A gap, drawn as a gap. It is never red and it never shouts.
      </Callout>
      <Callout swatch={<Cell fired={1} of={3} ring />} term="The slow ring — today">
        Breathing until you log something.
      </Callout>
      <Callout term="History is permanent">
        Renaming or archiving a lever never rewrites a day you already logged.
        Each day is shaded against the levers that existed then.
      </Callout>
    </>
  );
}

function TheOutage() {
  return (
    <>
      <Text style={heading}>Three days down, the screen changes.</Text>

      {/* A type specimen of the takeover's opening, not the full screen — the
          real one needs live account state, but the part that matters to
          recognise is the headline. */}
      <Specimen>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: size["2xl"],
            color: color.down,
            letterSpacing: -0.3,
          }}
        >
          DOWN 4 DAYS
        </Text>
        <Label style={{ marginTop: space[4], marginBottom: space[2] }}>
          Minimum to get back up
        </Label>
        <View
          style={{
            minHeight: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: color.surfaceHi,
            justifyContent: "center",
            paddingHorizontal: space[4],
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: size.sm,
              color: color.ink,
            }}
          >
            shake @ lunch{"  "}
            <Text style={{ color: color.inkMute, fontSize: size.xs }}>food</Text>
          </Text>
        </View>
      </Specimen>

      <Callout term="The dashboard is replaced, not decorated">
        No uptime number — it is at its worst exactly then, and showing it
        helps nobody. Just the days down and the lightest ways back.
      </Callout>
      <Callout term="The options are yours">
        Things you have actually logged before, lightest first. One tap on any
        of them — or on a bare lever — ends the outage.
      </Callout>
      <Callout term="last run: 31 days">
        The run you had is reported with its final length. A break is an
        outage, not a wipe — there is no counter anywhere that went to zero.
      </Callout>
    </>
  );
}

function ThePager() {
  return (
    <>
      <Text style={heading}>When the system goes down, it pages you.</Text>

      <Callout term="Silent while things are fine">
        No check-ins, no nudges, no &ldquo;how are you feeling&rdquo;. The app
        only speaks when the system is down.
      </Callout>
      <Callout term="Down 2 days — a page reaches the lock screen">
        It escalates on a fixed ladder the longer the outage runs, and never
        more than once a day. It cannot be turned off; the pager is the
        product.
      </Callout>
      <Callout term="Slammed mode — Settings → Alerts">
        For genuinely overloaded stretches: raises the paging thresholds for
        14 days, then expires on its own. Still one lever, still ten minutes
        of anything.
      </Callout>
      <Callout term="The daily reminder is a different thing">
        An optional local nudge at a time you pick, off by default. The pager
        fires when something is wrong; the reminder just remembers for you.
      </Callout>
      <Callout term="Send yourself a test">
        Settings → Alerts → &ldquo;Send a test alert&rdquo;. A pager you have
        never seen fire is not a pager.
      </Callout>
    </>
  );
}

function TheJournal() {
  return (
    <>
      <Text style={heading}>Proof. The file of what came back.</Text>

      <Specimen>
        <Label style={{ marginBottom: space[2] }}>energy</Label>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = n === 4;
            return (
              <View
                key={n}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: radius.md,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? color.lineHi : color.line,
                  backgroundColor: on ? color.line : color.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mono
                  style={{
                    fontSize: size.sm,
                    color: on ? color.ink : color.inkMute,
                  }}
                >
                  {n}
                </Mono>
              </View>
            );
          })}
        </View>
      </Specimen>

      <Callout term="A daily check, if you want it">
        Energy and sleep on a 1–5, and &ldquo;what&rsquo;s up?&rdquo; — a
        journal that takes as much or as little as you write. Skipping costs
        nothing.
      </Callout>
      <Callout term="Writing twice in a day adds, never replaces">
        The field opens blank each time; the evening&rsquo;s entry lands under
        the morning&rsquo;s. Tap any day in the log to edit it properly.
      </Callout>
      <Callout term="Weight, only if you turn it on">
        Settings → Tracking. A number you chose to keep, plotted with no goal
        and no judgement.
      </Callout>
      <Callout term="None of this touches uptime">
        Structurally: the journal is stored beside the system, not inside it.
        A blank week of Proof changes nothing on the dashboard.
      </Callout>
    </>
  );
}

function TheRest() {
  return (
    <>
      <Text style={heading}>The other two tabs, and where this lives.</Text>

      <Callout term="History">
        Every run and every outage as ranges, the all-time figures, and a
        dense grid of the last quarter. All of it derived from the same
        entries — nothing is stored that could drift.
      </Callout>
      <Callout term="Settings">
        Levers (rename, archive, add) · Alerts (slammed mode, the reminder, a
        test page) · Tracking (weight) · Account (export everything as JSON,
        sign out, delete — deletion is immediate and total).
      </Callout>
      <View style={{ marginTop: space[6] }}>
        <Rule />
      </View>
      <Callout term="This guide">
        Settings → About → &ldquo;How four works&rdquo; reopens it any time.
      </Callout>
    </>
  );
}
