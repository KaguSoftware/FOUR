"use client";

import { useState, useTransition } from "react";
import { setPosture } from "@/app/actions";
import { POSTURE_CHOICES, POSTURE_FOOTNOTE, type Posture } from "@uptime/core";

/**
 * Posture, after onboarding.
 *
 * Settings is the only place it lives. It is deliberately NOT offered on the
 * takeover, even though someone having a bad week is exactly who would benefit
 * from switching — putting it there turns a rough moment into a configuration
 * task, which is the opposite of what that screen is for.
 */
export function PostureSetting({ posture }: { posture: Posture }) {
  const [current, setCurrent] = useState(posture);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(next: Posture) {
    if (next === current || pending) return;
    const previous = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const result = await setPosture(next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <p className="text-ink text-sm">Alert posture</p>
      <p className="text-ink-mute mt-1 mb-4 text-xs leading-relaxed">
        How the system talks to you. {POSTURE_FOOTNOTE}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Alert posture</legend>
        {POSTURE_CHOICES.map((choice) => {
          const on = choice.value === current;
          return (
            <label
              key={choice.value}
              className={[
                "cursor-pointer rounded border p-3 transition-colors",
                on
                  ? "border-line-hi bg-surface-hi"
                  : "border-line bg-surface hover:bg-surface-hi",
              ].join(" ")}
            >
              <input
                type="radio"
                name="posture-setting"
                value={choice.value}
                checked={on}
                onChange={() => choose(choice.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span className={on ? "text-ink text-sm" : "text-ink-dim text-sm"}>
                  {choice.title}
                </span>
                <span className="text-ink text-sm">{on ? "✓" : ""}</span>
              </span>
              <span className="text-ink-mute mt-1.5 block text-xs leading-relaxed">
                {choice.detail}
              </span>
            </label>
          );
        })}
      </fieldset>

      {error && <p className="text-degraded mt-3 text-xs">{error}</p>}
    </div>
  );
}
