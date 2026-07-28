import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { DAILY_TREND_DAYS, NOTE_MAX } from "@uptime/core";

import { Body, Label, Mono, Rule, Wordmark } from "@/components/ui";
import { Trend, WeightTrend } from "@/components/trend";
import { useStatus } from "@/lib/use-status";
import {
  loadSignals,
  loadWeights,
  logSignals,
  type SignalRow,
  type WeightRow,
} from "@/lib/signals";
import { color, radius, size, space, TAP } from "@/theme";

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useStatus();
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [weights, setWeights] = useState<WeightRow[]>([]);

  const userId = status?.state.user_id;
  const weightOn = status?.state.weight_enabled ?? false;

  const load = useCallback(async () => {
    if (!userId) return;
    setRows(await loadSignals(userId));
    setWeights(weightOn ? await loadWeights(userId, DAILY_TREND_DAYS) : []);
  }, [userId, weightOn]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!status) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  const notes = rows.filter((r) => r.detail);
  const scalars = rows.filter((r) => r.value !== null);
  const loggedToday = rows.some((r) => r.observed_on === status.today);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[5],
          paddingBottom: space[12],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: space[8] }}>
          <Wordmark />
        </View>

        <DailyCheck
          userId={status.state.user_id}
          loggedToday={loggedToday}
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
          {notes.length === 0 ? (
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
                  style={({ pressed }) => ({
                    paddingVertical: space[4],
                    paddingHorizontal: pressed ? space[2] : 0,
                    marginHorizontal: pressed ? -space[2] : 0,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? color.surface : "transparent",
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
      </ScrollView>
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
 * The note field opens BLANK every time. Being handed back this morning's text
 * to edit is not how a journal is used. Writing again the same day appends
 * instead of replacing (`appendNote` in core), so nothing is lost — and editing
 * what is already there is a separate, deliberate act: tap the day in the log.
 */
function DailyCheck({
  userId,
  loggedToday,
  weightUnit,
  onSaved,
}: {
  userId: string;
  loggedToday: boolean;
  weightUnit: "kg" | "lb" | null;
  onSaved: () => void;
}) {
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  // Always blank. Writing again the same day APPENDS (see core's appendNote),
  // so nothing is lost — editing what is already there is a separate, explicit
  // act, reached by tapping the day in the log.
  const [note, setNote] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const empty = !energy && !sleep && !note.trim() && !weight.trim();

  async function save() {
    if (empty || saving) return;
    setSaving(true);
    const w = weightUnit && weight.trim() ? Number(weight) : null;
    await logSignals(userId, {
      energy,
      sleep,
      detail: note,
      weight: Number.isFinite(w) ? w : null,
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <View>
      <Label style={{ marginBottom: space[1] }}>
        {loggedToday ? "today" : "daily check"}
      </Label>
      <Body tone="dim" style={{ marginBottom: space[4], fontSize: size.xs }}>
        Skipping costs nothing. This never affects uptime.
      </Body>

      <Scale label="energy" value={energy} onChange={setEnergy} />
      <Scale label="sleep" value={sleep} onChange={setSleep} />

      {weightUnit && (
        <View style={{ marginTop: space[4] }}>
          <Label style={{ marginBottom: space[2] }}>weight ({weightUnit})</Label>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="—"
            placeholderTextColor={color.inkMute}
            keyboardType="decimal-pad"
            inputMode="decimal"
            // No goal, no target, no comparison to a previous value. The field
            // takes a number and says nothing about it.
            style={field}
          />
        </View>
      )}

      <Label style={{ marginTop: space[4], marginBottom: space[2] }}>
        what&apos;s up?
      </Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Whatever you want to remember about today."
        placeholderTextColor={color.inkMute}
        multiline
        maxLength={NOTE_MAX}
        textAlignVertical="top"
        style={[field, { minHeight: 110, paddingTop: space[3] }]}
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
          style={({ pressed }) => ({
            minHeight: TAP,
            paddingHorizontal: space[5],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: pressed ? color.line : color.surfaceHi,
            alignItems: "center",
            justifyContent: "center",
            opacity: empty || saving ? 0.4 : 1,
          })}
        >
          <Label style={{ color: color.ink }}>
            {saving ? "…" : loggedToday ? "save" : "log"}
          </Label>
        </Pressable>
        {saved && !saving && <Body tone="mute">Saved.</Body>}
      </View>
    </View>
  );
}

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

const field = {
  minHeight: TAP,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.line,
  backgroundColor: color.surface,
  paddingHorizontal: space[4],
  color: color.ink,
  fontFamily: "Inter_400Regular",
  // 16 minimum on a touch device, or iOS zooms the view when it takes focus.
  fontSize: 16,
  lineHeight: 24,
} as const;
