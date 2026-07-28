"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions";
import { Wordmark } from "@/app/components/wordmark";
import {
  MAX_LEVERS,
  POSTURE_CHOICES,
  POSTURE_FOOTNOTE,
  DEFAULT_POSTURE,
  type Posture,
} from "@uptime/core";

/**
 * First run, in two screens.
 *
 * The first states the rule before it asks for anything, because "one of these,
 * not all" is the single idea someone has to accept for the rest of the product
 * to make sense. It also explains, without a tour, why there is no streak
 * counter anywhere in the app.
 *
 * The second picks posture. Framed as how the system talks, never as difficulty
 * — and the line about the bar being identical is what stops SOFT reading as
 * the easier option.
 *
 * Nothing is written until the last tap. A half-finished account cannot open
 * the app at all, so there is no intermediate state worth saving.
 */
export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [labels, setLabels] = useState<string[]>([""]);
  const [posture, setPosture] = useState<Posture>(DEFAULT_POSTURE);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const named = labels.map((l) => l.trim()).filter(Boolean);

  function toStep(next: 0 | 1) {
    setError(null);
    setStep(next);
  }

  function finish() {
    setError(null);
    start(async () => {
      const result = await completeOnboarding(named, posture);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The gate reads `onboarded` server-side, so the cached route tree has to
      // go with it or the dashboard bounces straight back here.
      router.refresh();
      router.replace("/");
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(3rem,calc(env(safe-area-inset-top)+1.5rem))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-10 flex items-baseline justify-between">
        <Wordmark />
        <span className="label">{step + 1} / 2</span>
      </header>

      {step === 0 ? (
        <Levers
          labels={labels}
          onChange={setLabels}
          onContinue={() => {
            if (named.length === 0) {
              setError("Name at least one lever — one is enough.");
              return;
            }
            toStep(1);
          }}
        />
      ) : (
        <PostureStep
          posture={posture}
          onPick={setPosture}
          onBack={() => toStep(0)}
          onStart={finish}
          pending={pending}
        />
      )}

      {error && <p className="text-degraded mt-4 text-xs">{error}</p>}
    </main>
  );
}

/** 06·A — the rule, then the levers. The rule comes first, always. */
function Levers({
  labels,
  onChange,
  onContinue,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
  onContinue: () => void;
}) {
  function set(i: number, value: string) {
    onChange(labels.map((l, n) => (n === i ? value : l)));
  }

  function add() {
    if (labels.length < MAX_LEVERS) onChange([...labels, ""]);
  }

  function remove(i: number) {
    onChange(labels.length > 1 ? labels.filter((_, n) => n !== i) : [""]);
  }

  return (
    <>
      <div className="mb-10">
        <p className="text-ink text-lg leading-snug">
          A day is <strong className="font-medium">up</strong> if you do one of
          these. Not all of them.
        </p>
        <p className="text-ink-mute mt-3 text-sm leading-relaxed">
          No streaks. No scores. Nothing here resets to zero.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
        className="flex flex-1 flex-col"
      >
        <p className="label mb-1">your levers — up to {MAX_LEVERS}</p>
        <p className="text-ink-mute mb-4 text-xs leading-relaxed">
          One small real thing you can still do on a bad day. Gym, food, pages,
          practice, meds — whatever yours is. You can rename or change these
          later without losing a single day.
        </p>

        <div className="flex flex-col gap-2">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                autoFocus={i === 0}
                value={label}
                maxLength={24}
                onChange={(e) => set(i, e.target.value)}
                placeholder={`Lever ${i + 1}`}
                aria-label={`Lever ${i + 1}`}
                className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-h-14 min-w-0 flex-1 rounded border px-4 text-sm transition-colors outline-none"
              />
              {/* Only offered once there is something to remove, so the first
                  field never looks like it can be deleted out from under you. */}
              {labels.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove lever ${i + 1}`}
                  className="text-ink-mute hover:text-ink-dim min-h-11 px-3 text-xs transition-colors"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Deliberately shorter and quieter than a field. At the same height it
            read as a second empty input rather than as an action — dashed
            versus solid was not enough on its own to tell them apart. */}
        {labels.length < MAX_LEVERS && (
          <button
            type="button"
            onClick={add}
            className="border-line text-ink-mute hover:text-ink-dim hover:border-line-hi mt-2 min-h-11 self-start rounded border border-dashed px-3 text-xs transition-colors"
          >
            + add a lever
          </button>
        )}

        {/* Bottom-anchored: the fields are the work, the button is the exit.
            One lever leaves a lot of screen below it, and a CTA floating in the
            middle of that reads as an unfinished page. */}
        <div className="mt-auto pt-10">
          <button
            type="submit"
            className="border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi min-h-14 w-full rounded border text-sm font-medium tracking-wide uppercase transition-colors"
          >
            continue
          </button>
        </div>
      </form>
    </>
  );
}

/** 06·B — posture. How the system talks, never how hard it is. */
function PostureStep({
  posture,
  onPick,
  onBack,
  onStart,
  pending,
}: {
  posture: Posture;
  onPick: (p: Posture) => void;
  onBack: () => void;
  onStart: () => void;
  pending: boolean;
}) {
  return (
    <>
      <p className="text-ink mb-8 text-lg leading-snug">
        How should this system talk to you?
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Alert posture</legend>
        {POSTURE_CHOICES.map((choice) => {
          const on = choice.value === posture;
          return (
            <label
              key={choice.value}
              className={[
                "cursor-pointer rounded border p-4 transition-colors",
                on
                  ? "border-line-hi bg-surface-hi"
                  : "border-line bg-surface hover:bg-surface-hi",
              ].join(" ")}
            >
              <input
                type="radio"
                name="posture"
                value={choice.value}
                checked={on}
                onChange={() => onPick(choice.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span className={on ? "text-ink text-sm" : "text-ink-dim text-sm"}>
                  {choice.title}
                </span>
                {/* Selection is a mark as well as a fill — state never rests on
                    colour alone. */}
                <span className="text-ink text-sm">{on ? "✓" : ""}</span>
              </span>
              <span className="text-ink-mute mt-1.5 block text-xs leading-relaxed">
                {choice.detail}
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Load-bearing. Without it, SOFT reads as the easier setting — and the
          whole point is that there is no easier setting. */}
      <p className="text-ink-mute mt-4 text-xs leading-relaxed">
        {POSTURE_FOOTNOTE}
      </p>

      <div className="mt-auto pt-10">
        <button
          onClick={onStart}
          disabled={pending}
          className="border-line-hi bg-surface-hi text-ink hover:bg-line active:bg-line-hi min-h-14 w-full rounded border text-sm font-medium tracking-wide uppercase transition-colors disabled:opacity-50"
        >
          {pending ? "setting up…" : "start"}
        </button>

        <button
          onClick={onBack}
          disabled={pending}
          className="text-ink-mute hover:text-ink-dim active:text-ink mt-1 min-h-11 w-full text-xs transition-colors disabled:opacity-50"
        >
          ← back to levers
        </button>
      </div>
    </>
  );
}
