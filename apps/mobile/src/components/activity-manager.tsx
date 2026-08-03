import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import {
  ACTIVITY_FULL_COPY,
  ACTIVITY_LABEL_MAX,
  canAddActivity,
  rankActivities,
  validateActivityLabel,
  type ActivityRow,
} from "@uptime/core";

import { field, fieldTint } from "./fields";
import { Body, Label, Rule } from "./ui";
import { useNotify } from "./snackbar";
import {
  createActivity,
  deleteActivity,
  loadActivities,
  renameActivity,
  restoreActivity,
} from "@/lib/playbook";
import { pressFill, ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * Activities for one lever — the things that have already worked.
 *
 * Until now these could only be CREATED, as a side effect of logging a lever
 * with a detail. A typo lived forever, the list grew without bound behind a
 * picker that showed three, and there was no way to see the rest of it.
 *
 * The cap has two halves and they are not symmetric, which is the thing to
 * understand before changing anything here:
 *
 * - **Adding here refuses at ten.** You are looking at the list; being told it
 *   is full is an answer you can act on.
 * - **Logging never refuses.** A new detail at the cap quietly retires
 *   something unpinned and used at most once, and if nothing qualifies it
 *   creates nothing at all — the day still logs either way. Blocking a log
 *   would be the one failure this product exists to prevent.
 *
 * Lifted from `lever-manager.tsx`, including its `run()` shape and its row
 * motion. Read that file's notes before changing either.
 */
export function ActivityManager({
  userId,
  lever,
  leverLabel,
}: {
  userId: string;
  lever: string;
  leverLabel: string;
}) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  // Statements go through `notify` — a snackbar on Android, an Alert on iOS.
  // The delete CONFIRMATION below stays `Alert.alert` on both, because it asks
  // a question and must block. See `snackbar.tsx`.
  const notify = useNotify();

  const load = useCallback(async () => {
    const res = await loadActivities(userId, lever);
    // A failed read leaves what is on screen rather than blanking the list.
    if (!res.error) setRows(res.rows);
    setLoaded(true);
  }, [userId, lever]);

  useEffect(() => {
    load();
  }, [load]);

  const active = rankActivities(rows);
  const retired = rows.filter((r) => r.archived);
  const full = !canAddActivity(active.length);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (busy) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      notify("Didn't save", res.error ?? "That change didn't reach the server.");
      return;
    }
    await load();
  }

  function confirmDelete(item: ActivityRow) {
    Alert.alert(
      `Delete "${item.label}"?`,
      // The reassurance that matters: this is a shortcut, not a record. What
      // it says is already written into every day it was used on.
      "Every day you logged it stays exactly as it is, with what you did still written on it. This only removes the shortcut.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => run(() => deleteActivity(userId, item.id)),
        },
      ],
    );
  }

  return (
    <View>
      <Label style={{ marginBottom: space[2] }}>{leverLabel} activities</Label>
      <Body
        tone="mute"
        // xs text needs an xs line box — `Note`'s docblock records why.
        style={{
          marginBottom: space[3],
          fontSize: size.xs,
          lineHeight: size.xs * 1.5,
        }}
      >
        What has already worked, offered next time you log {leverLabel}. These
        fill themselves in as you use them — you never have to write one.
      </Body>

      {loaded && active.length === 0 && (
        // An empty playbook is a WORKING screen, and the copy has to read that
        // way. The lever sheet always offers "just mark it up", so nothing is
        // blocked by this being empty.
        <Body tone="mute" style={{ marginBottom: space[3] }}>
          Nothing yet. Log {leverLabel} with a note of what you did and it will
          be here next time.
        </Body>
      )}

      {active.map((item) => (
        <Animated.View
          key={item.id}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.duration(240)}
        >
          {editing === item.id ? (
            <View style={ROW}>
              <TextInput
                {...fieldTint}
                autoFocus
                value={draft}
                onChangeText={setDraft}
                maxLength={ACTIVITY_LABEL_MAX}
                onSubmitEditing={() => {
                  const check = validateActivityLabel(draft);
                  if (!check.ok) return notify("Can't rename", check.reason);
                  setEditing(null);
                  run(() => renameActivity(userId, item.id, draft));
                }}
                returnKeyType="done"
                style={[
                  field,
                  {
                    flex: 1,
                    borderColor: color.lineHi,
                    backgroundColor: color.surface,
                    paddingHorizontal: space[3],
                  },
                ]}
              />
              <InlineButton label="cancel" onPress={() => setEditing(null)} />
            </View>
          ) : (
            <View style={ROW}>
              <Body tone="dim" style={{ flex: 1 }} numberOfLines={1}>
                {item.label}
              </Body>
              <InlineButton
                label="rename"
                accessibilityLabel={`Rename ${item.label}`}
                onPress={() => {
                  setDraft(item.label);
                  setEditing(item.id);
                }}
              />
              <InlineButton
                label="delete"
                accessibilityLabel={`Delete ${item.label}`}
                onPress={() => confirmDelete(item)}
              />
            </View>
          )}
          <Rule />
        </Animated.View>
      ))}

      {full ? (
        <Body
          tone="mute"
          style={{
            marginTop: space[3],
            fontSize: size.xs,
            lineHeight: size.xs * 1.5,
          }}
        >
          {ACTIVITY_FULL_COPY}
        </Body>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            marginTop: space[3],
          }}
        >
          <TextInput
            {...fieldTint}
            value={adding}
            onChangeText={setAdding}
            placeholder="Add an activity"
            placeholderTextColor={color.inkMute}
            maxLength={ACTIVITY_LABEL_MAX}
            onSubmitEditing={create}
            returnKeyType="done"
            style={[
              field,
              {
                flex: 1,
                backgroundColor: color.surface,
                paddingHorizontal: space[3],
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!adding.trim() || busy}
            onPress={create}
            android_ripple={!adding.trim() || busy ? undefined : ripple()}
            style={({ pressed }) => ({
              minHeight: TAP,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.lineHi,
              backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
              alignItems: "center",
              justifyContent: "center",
              opacity: !adding.trim() || busy ? 0.4 : 1,
            })}
          >
            <Label style={{ color: color.ink }}>add</Label>
          </Pressable>
        </View>
      )}

      {/* Retired rows: what the cap moved aside to make room. Collapsed, since
          the whole point is that they are out of the way — but reachable, so
          the eviction is recoverable rather than a silent loss. */}
      {retired.length > 0 && (
        <View style={{ marginTop: space[6] }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowRetired((s) => !s)}
            android_ripple={ripple()}
            style={{
              minHeight: TAP,
              justifyContent: "center",
              borderRadius: radius.md,
            }}
          >
            <Body tone="mute" style={{ fontSize: size.xs }}>
              {showRetired ? "hide" : "show"} {retired.length} retired
            </Body>
          </Pressable>

          {showRetired &&
            retired.map((item) => (
              <View key={item.id}>
                <View style={ROW}>
                  <Body tone="mute" style={{ flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Body>
                  <InlineButton
                    label="restore"
                    accessibilityLabel={`Restore ${item.label}`}
                    onPress={() => run(() => restoreActivity(userId, item.id))}
                  />
                </View>
                <Rule />
              </View>
            ))}
        </View>
      )}
    </View>
  );

  async function create() {
    const res = await createActivity(userId, lever, adding);
    if (!res.ok) {
      // `full` is the cap refusing, which is not a fault and gets the ceiling
      // copy rather than a save error.
      return notify(
        res.error === "full" ? "Ten is the maximum" : "Can't add that",
        res.error === "full" ? ACTIVITY_FULL_COPY : res.error,
      );
    }
    setAdding("");
    await load();
  }
}

const ROW = {
  flexDirection: "row",
  alignItems: "center",
  gap: space[2],
  paddingVertical: space[2],
} as const;

/**
 * An inline text button in a row.
 *
 * The radius is invisible — no fill, no border. It exists only so the
 * foreground ripple has an outline to clip to, or it paints a hard-edged
 * rectangle over a row that has none. See `lib/press`.
 */
function InlineButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      // Neutral, not destructive: this row is not red, and deleting still has
      // to get past a confirmation. The destructive ripple belongs to the rows
      // that sign you out and delete the account, where the text is `down` too.
      android_ripple={ripple()}
      style={{
        minHeight: TAP,
        justifyContent: "center",
        paddingHorizontal: space[2],
        borderRadius: radius.md,
      }}
    >
      <Body tone="mute" style={{ fontSize: size.xs }}>
        {label}
      </Body>
    </Pressable>
  );
}
