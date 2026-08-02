import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { DAILY_TREND_DAYS, NOTE_MAX } from "@uptime/core";

import { Body, Label, Mono, Rule } from "@/components/ui";
import { field, fieldTint, noteField } from "@/components/fields";
import { Fault, Loading } from "@/components/states";
import { Screen } from "@/components/screen";
import { Trend, WeightTrend } from "@/components/trend";
import { pressFill, pressFillFlat, ripple } from "@/lib/press";
import { useStatus } from "@/lib/use-status";
import {
  loadSignals,
  loadWeights,
  logSignals,
  type SignalRow,
  type WeightRow,
} from "@/lib/signals";
import { color, radius, size, space, TAP } from "@/theme";

const android = Platform.OS === "android";

/**
 * Proof — the file of what came back.
 *
 * The runs that lasted held while progress was perceptible and died when it
 * stopped being. During a run this answers "is this doing anything". During
 * re-entry it is evidence it worked last time, which is a better argument for
 * restarting than any motivational copy.
 *
 * Nothing on this screen can affect uptime. Skipping is free and says so.
 */
export default function ProofScreen() {
  const router = useRouter();
  const { status } = useStatus();
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const userId = status?.state.user_id;
  const weightOn = status?.state.weight_enabled ?? false;

  const load = useCallback(async () => {
    if (!userId) return;
    const signals = await loadSignals(userId);
    const weight = weightOn
      ? await loadWeights(userId, DAILY_TREND_DAYS)
      : { rows: [], error: null };

    setError(signals.error ?? weight.error);
    // Rows are replaced only on a clean read. A failed refresh keeps whatever
    // was already on screen — blanking a journal because the network blinked
    // is the one thing this screen must never do.
    if (!signals.error) setRows(signals.rows);
    if (!weight.error) setWeights(weight.rows);
  }, [userId, weightOn]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!status) return <Loading />;

  const notes = rows.filter((r) => r.detail);
  const scalars = rows.filter((r) => r.value !== null);
  const loggedToday = rows.some((r) => r.observed_on === status.today);

  // What today already holds. The check-in reads these back so the screen can
  // answer "did I do this today" without the user having to remember.
  const todayValue = (kind: string) =>
    rows.find((r) => r.observed_on === status.today && r.kind === kind)
      ?.value ?? null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <Screen>
        <DailyCheck
          userId={status.state.user_id}
          loggedToday={loggedToday}
          savedEnergy={todayValue("energy")}
          savedSleep={todayValue("sleep")}
          weightUnit={weightOn ? status.state.weight_unit : null}
          onSaved={load}
        />

        {scalars.length > 0 && (
          <View style={{ marginTop: space[10] }}>
            <Label style={{ marginBottom: space[3] }}>trend</Label>
            <Trend samples={scalars} />
          </View>
        )}

        {weightOn && weights.length > 0 && (
          <View style={{ marginTop: space[10] }}>
            <Label style={{ marginBottom: space[3] }}>weight</Label>
            <WeightTrend points={weights} unit={status.state.weight_unit} />
          </View>
        )}

        <View style={{ marginTop: space[10] }}>
          <Label style={{ marginBottom: space[3] }}>the log</Label>
          {error ? (
            // Never the empty state while a read is failing. "Nothing written
            // yet" over a journal that exists is a lie the user has no way to
            // check, and it lands on the screen that is supposed to be the
            // evidence their history is intact.
            <Fault message={error} onRetry={load} />
          ) : notes.length === 0 ? (
            <Body tone="mute">
              Nothing written yet. Anything you want to remember about a day
              goes here — what moved, what didn&apos;t, what it felt like. This
              list only grows, and it is what you read on the way back after a
              break.
            </Body>
          ) : (
            notes.map((n) => (
              <View key={`${n.observed_on}-${n.kind}`}>
                {/* Tap any day to edit it. This is the ONLY place a note is
                    shown prefilled — the daily field stays blank, so editing
                    is something you choose rather than something you are
                    handed every time you open the screen. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit the entry for ${n.observed_on}`}
                  onPress={() =>
                    router.push({
                      pathname: "/edit-note",
                      params: { date: n.observed_on, text: n.detail ?? "" },
                    })
                  }
                  // The ripple needs somewhere to be drawn: the iOS version
                  // grows the row's padding under the finger and pulls the
                  // margin back to keep the text still, which is a held state
                  // and cannot be animated per-frame from a ripple. Android
                  // instead carries the inset permanently — invisible while
                  // resting, and the ripple then covers the whole row.
                  android_ripple={ripple("surface")}
                  style={({ pressed }) => ({
                    paddingVertical: space[4],
                    paddingHorizontal: android ? space[2] : pressed ? space[2] : 0,
                    marginHorizontal: android ? -space[2] : pressed ? -space[2] : 0,
                    borderRadius: radius.md,
                    backgroundColor: pressFillFlat(color.surface, pressed),
                  })}
                >
                  {/* The date sits ABOVE the entry. These are paragraphs, not
                      one-liners, and a fixed-width date column squeezed them
                      into a gutter. */}
                  <Mono
                    style={{
                      fontSize: size.xs,
                      color: color.inkMute,
                      marginBottom: space[2],
                    }}
                  >
                    {n.observed_on}
                  </Mono>
                  <Body tone="dim">{n.detail}</Body>
                </Pressable>
                <Rule />
              </View>
            ))
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * The daily check.
 *
 * Stays on screen even once something is logged today. It used to disappear
 * after the first entry, which was fine when the note was a one-line
 * observation — but people write these as a journal, and "you already checked
 * in this morning" is not a reason to refuse what happened this evening.
 *
 * **The scales show what today already holds.** They used to reset to blank on
 * save, which left no way to tell a logged day from an unlogged one — the only
 * evidence was a transient "Saved." and a one-word label change, both gone by
 * the next time the screen was opened. Reading the stored values back means the
 * question "did I already do this today" is answered by looking.
 *
 * The note field is the deliberate exception: it opens BLANK every time. Being
 * handed back this morning's text to edit is not how a journal is used. Writing
 * again the same day appends instead of replacing (`appendNote` in core), so
 * nothing is lost — and editing what is already there is a separate act: tap
 * the day in the log.
 */
function DailyCheck({
  userId,
  loggedToday,
  savedEnergy,
  savedSleep,
  weightUnit,
  onSaved,
}: {
  userId: string;
  loggedToday: boolean;
  /** What today already holds, or null. Shown back, not just counted. */
  savedEnergy: number | null;
  savedSleep: number | null;
  weightUnit: "kg" | "lb" | null;
  onSaved: () => void;
}) {
  const [energy, setEnergy] = useState<number | null>(savedEnergy);
  const [sleep, setSleep] = useState<number | null>(savedSleep);
  // Always blank. Writing again the same day APPENDS (see core's appendNote),
  // so nothing is lost — editing what is already there is a separate, explicit
  // act, reached by tapping the day in the log.
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * Adopt the stored values only when they actually CHANGE.
   *
   * The screen reloads on every focus, so syncing on each render would throw
   * away a selection the user made and had not saved yet — tab away, tab back,
   * and their 4 is gone. Comparing against the last values seen from the server
   * means a refresh that returns the same thing is a no-op, and only a real
   * write (or a new day) moves the scales.
   */
  const lastSeen = useRef({ energy: savedEnergy, sleep: savedSleep });
  useEffect(() => {
    if (lastSeen.current.energy !== savedEnergy) setEnergy(savedEnergy);
    if (lastSeen.current.sleep !== savedSleep) setSleep(savedSleep);
    lastSeen.current = { energy: savedEnergy, sleep: savedSleep };
  }, [savedEnergy, savedSleep]);

  const empty = !energy && !sleep && !note.trim() && !weight.trim();

  async function save() {
    if (empty || saving) return;
    setSaving(true);
    setFailed(null);
    setSaved(false);
    const w = weightUnit && weight.trim() ? Number(weight) : null;
    const { error } = await logSignals(userId, {
      energy,
      sleep,
      detail: note,
      weight: Number.isFinite(w) ? w : null,
    });
    setSaving(false);

    // This used to set "Saved." unconditionally and reload regardless. A write
    // that failed reported success, and the reload then showed the day without
    // it — the readout contradicting itself, which is the one thing a panel
    // cannot do.
    if (error) {
      setFailed(error.message);
      return;
    }

    // The NOTE clears; the scales do not. The note field is documented to open
    // blank, and leaving the text in it made a second tap append the same
    // entry twice. Energy and sleep are the opposite case: they are today's
    // state, not a message, so blanking them threw away the only on-screen
    // evidence that the day had been logged at all. `onSaved` reloads and the
    // sync effect above confirms them from the server.
    //
    // Cleared only on success, so a failed save leaves every field exactly as
    // typed and the retry is one tap.
    setNote("");
    setWeight("");
    setSaved(true);
    onSaved();
  }

  return (
    <View>
      <Label style={{ marginBottom: space[1] }}>
        {loggedToday ? "today" : "daily check"}
      </Label>
      {/* States the fact when the day is done, so the answer to "did I already
          do this" is on screen rather than in memory. Flat, not congratulatory
          — see DESIGN.md on register. */}
      <Body tone="dim" style={{ marginBottom: space[4], fontSize: size.xs }}>
        {loggedToday
          ? "Logged today. Anything you add appends to it."
          : "Skipping costs nothing. This never affects uptime."}
      </Body>

      <Scale label="energy" value={energy} onChange={setEnergy} />
      <Scale label="sleep" value={sleep} onChange={setSleep} />

      {weightUnit && (
        <View style={{ marginTop: space[4] }}>
          <Label style={{ marginBottom: space[2] }}>weight ({weightUnit})</Label>
          <TextInput
            {...fieldTint}
            value={weight}
            onChangeText={setWeight}
            placeholder="—"
            placeholderTextColor={color.inkMute}
            keyboardType="decimal-pad"
            inputMode="decimal"
            // No goal, no target, no comparison to a previous value. The field
            // takes a number and says nothing about it.
            style={[field, { backgroundColor: color.surface }]}
          />
        </View>
      )}

      <Label style={{ marginTop: space[4], marginBottom: space[2] }}>
        what&apos;s up?
      </Label>
      <TextInput
        {...fieldTint}
        value={note}
        onChangeText={setNote}
        placeholder="Whatever you want to remember about today."
        placeholderTextColor={color.inkMute}
        multiline
        maxLength={NOTE_MAX}
        textAlignVertical="top"
        style={[noteField, { backgroundColor: color.surface }]}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          marginTop: space[4],
        }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={empty || saving}
          onPress={save}
          android_ripple={empty || saving ? undefined : ripple("line")}
          style={({ pressed }) => ({
            minHeight: TAP,
            paddingHorizontal: space[5],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
            alignItems: "center",
            justifyContent: "center",
            opacity: empty || saving ? 0.4 : 1,
          })}
        >
          <Label style={{ color: color.ink }}>
            {saving ? "…" : loggedToday ? "save" : "log"}
          </Label>
        </Pressable>
        {saved && !saving && (
          // Announced, not just drawn: the confirmation is the only feedback
          // this control gives, and a screen reader user gets no other signal
          // that the write landed.
          <Body tone="mute" accessibilityLiveRegion="polite">
            Saved.
          </Body>
        )}
      </View>

      {failed && !saving && (
        <View style={{ marginTop: space[4] }}>
          <Fault
            label="not saved"
            message={failed}
            onRetry={save}
            retryLabel="try again"
          />
        </View>
      )}
    </View>
  );
}

/**
 * The 1–5 signal control, tapped every time this screen is used.
 *
 * `Segmented` was lifted from this control — "the treatment is lifted from the
 * `Scale` control on the Proof screen, which is already measured" — and when
 * the Android pass reached Segmented it noted that the shape had **no press
 * feedback on either platform** and gave it a ripple. The original was left
 * where it was, so the derived control answered an Android tap and the one it
 * was derived from did not.
 *
 * Android-only, for the same reason recorded there: on iOS the selection
 * moving is immediate enough to be the acknowledgement, and iOS ignores
 * `android_ripple` outright, so nothing here can move an iOS pixel.
 */
function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <Label style={{ marginBottom: space[2] }}>{label}</Label>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${n} of 5`}
              onPress={() => onChange(n)}
              // `line-hi`, not `line`. Four of these five cells rest on
              // `surface`, and they are the ones actually tapped — a ripple
              // in `line` measures 1.35:1 there, which is the same reading
              // that already condemned that token on the sheet handle, the
              // segmented divider and the day cell. `line-hi` is 3.09:1 on
              // `surface` and still reads on the selected cell's `line`.
              android_ripple={ripple("line-hi")}
              style={{
                flex: 1,
                minHeight: TAP,
                borderRadius: radius.md,
                borderWidth: on ? 2 : 1,
                // Selected has to be unmistakable: on web this pair once
                // measured 1.10:1 and was effectively invisible. `line` fill
                // plus a `line-hi` border plus ink text is 11.37:1 for the
                // number itself.
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

