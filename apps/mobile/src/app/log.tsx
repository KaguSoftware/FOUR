import { useState } from "react";
import { Alert, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  appendDetail,
  rankActivities,
  splitDetail,
  type ActivityRow,
} from "@uptime/core";
import { field, fieldTint } from "@/components/fields";
import { Body, Label } from "@/components/ui";
import { SheetHandle } from "@/components/sheet";
import { committed } from "@/lib/haptics";
import { deleteActivity, renameActivity } from "@/lib/playbook";
import { pressFill, pressFillFlat, ripple } from "@/lib/press";
import { cachedStatus, refreshStatus } from "@/lib/use-status";
import { outboxStore, queueWrite } from "@/lib/outbox";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * The optional half of one tap.
 *
 * Tapping a lever logs the day. Full stop. This sheet exists only to attach
 * *what* you did, and every route out of it is a valid log — including
 * dismissing it by swiping down, which still leaves the day up, because the
 * entry is written the moment you choose anything here and "just mark it up"
 * is always offered.
 *
 * **It is also where a logged lever is un-logged.** There used to be a separate
 * undo control on the dashboard; putting it here means the lever is the only
 * thing you ever press, and what you can do with it lives behind it. Tapping a
 * lever you already logged opens this in its second state: what is recorded,
 * the option to add what else you did, and the option to take the day back.
 *
 * Ranked by what has actually worked, so restarting is reopening a file rather
 * than reinventing anything. An empty playbook is a working screen: the button
 * at the bottom needs no history at all.
 */
export default function LogSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lever } = useLocalSearchParams<{ lever: string }>();
  /**
   * Read once from the cache, deliberately NOT `useStatus()`.
   *
   * iOS measures this sheet's content to size it (`fitToContents`). Fetching
   * here meant mounting nearly empty, being measured at that height, then
   * filling and resizing — a jolt on every open. The dashboard that launched
   * this sheet already loaded everything it needs, so re-fetching bought
   * nothing but the jump.
   */
  const [status] = useState(cachedStatus);
  const [custom, setCustom] = useState("");
  const [typing, setTyping] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const leverRow = status?.levers.find((l) => l.key === lever);
  const label = leverRow?.label ?? lever;
  /**
   * Three, and it stays three.
   *
   * Ten 56pt chips plus the input, the "something else" row and the footer is
   * roughly 800pt — taller than a phone — and `fitToContents` would happily
   * let this sheet try. Editing has to be REACHABLE from here, which it is;
   * all ten do not have to be listed here.
   *
   * Ranked through core so this and the takeover and the browser cannot
   * disagree about which three are the top three.
   */
  const items = rankActivities(
    (status?.playbook ?? []).filter((p) => p.lever === lever) as ActivityRow[],
  ).slice(0, 3);

  /**
   * Open the editor, REPLACING this sheet rather than pushing over it.
   *
   * This screen read `cachedStatus()` once so it could be measured once.
   * Coming back to it after an edit would therefore show the chips it was
   * measured with, not the ones that now exist.
   *
   * `focus` opens that screen with one row already in edit mode — see below.
   */
  function manage(focus?: string) {
    if (chosen !== null) return;
    router.replace({
      pathname: "/activities",
      params: focus ? { lever, focus } : { lever },
    });
  }

  /**
   * Long-press a chip to fix it.
   *
   * An `Alert` and not an inline editor, because an inline editor changes this
   * sheet's height and the sheet is measured once. A dialog changes nothing.
   *
   * **"Rename" used to not rename.** It called `manage()`, which dropped you on
   * the activities screen with nothing selected and nothing typed — the intent
   * was simply discarded, and the screen you landed on gave no sign it was
   * meant to be carrying one. Reported on device as renaming not saving
   * (2026-08-04).
   *
   * `Alert.prompt` is **iOS-only**, so it renames in place there. Android
   * still routes to the editor, but now names the row it should open for
   * editing, so the rename continues instead of starting over.
   */
  function editItem(item: { id: string; label: string }) {
    if (chosen !== null || !status) return;
    const userId = status.state.user_id;

    const rename = async (next: string) => {
      const res = await renameActivity(userId, item.id, next.trim());
      if (!res.ok) return;
      await refreshStatus().catch(() => {});
      router.back();
    };

    const remove = {
      text: "Delete",
      style: "destructive" as const,
      onPress: async () => {
        const res = await deleteActivity(userId, item.id);
        if (!res.ok) return;
        await refreshStatus().catch(() => {});
        router.back();
      },
    };

    // The prompt is a SECOND dialog, opened from "Rename" — the first one has
    // to keep offering Delete on both platforms. `Alert.prompt` cannot carry a
    // destructive third action and a text field at once.
    const promptForName = () =>
      Alert.prompt(
        "Rename",
        undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (next?: string) => {
              // Empty or unchanged is a cancel, not a write. `validateActivity
              // Label` would reject the empty string anyway; catching it here
              // means no error is raised for someone who simply changed their
              // mind.
              const trimmed = next?.trim();
              if (!trimmed || trimmed === item.label) return;
              rename(trimmed);
            },
          },
        ],
        "plain-text",
        item.label,
      );

    Alert.alert(item.label, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rename",
        // iOS renames in place. Android has no `Alert.prompt`, so it routes to
        // the editor — carrying the id, so the row opens already in edit mode.
        onPress:
          Platform.OS === "ios" ? promptForName : () => manage(item.id),
      },
      remove,
    ]);
  }

  /**
   * What is already recorded for today, if anything.
   *
   * The queue wins over the server: an unsent tap is still a tap, and the
   * dashboard is already showing it as logged. Reading the store rather than
   * subscribing keeps the sheet a single measured height.
   */
  const today = status?.today;
  const queued = outboxStore
    .get()
    .find((q) => q.logged_for === today && q.lever === lever);
  const serverEntry = status?.entries.find(
    (e) => e.logged_for === today && e.lever === lever,
  );
  const logged = queued ? queued.op === "log" : !!serverEntry;
  const detail = queued ? queued.detail : (serverEntry?.detail ?? null);

  function commit(next: string | null) {
    // One pick per sheet: the second tap is always an accident.
    if (chosen !== null || !status) return;
    setChosen(next ?? "");
    committed();
    router.back();
    // Adding to a day that is already logged APPENDS rather than replacing.
    // One entry per lever per day is a schema rule, not a product one — doing
    // the thing twice is still one day up, and the record of what you did
    // should not lose the first half.
    queueWrite(
      status.state.user_id,
      lever,
      "log",
      logged ? appendDetail(detail, next) : next,
    );
  }

  function remove() {
    if (chosen !== null || !status) return;
    setChosen("");
    committed();
    router.back();
    queueWrite(status.state.user_id, lever, "undo", null);
  }

  return (
    <View
      style={{
        backgroundColor: color.surface,
        paddingHorizontal: space[5],
        paddingTop: space[5],
        // The strip behind the home indicator belongs to the sheet. Padding it
        // here keeps the last button clear of the indicator; the screen's own
        // contentStyle is what actually paints it.
        paddingBottom: Math.max(insets.bottom, space[4]) + space[3],
        gap: space[2],
      }}
    >
      <SheetHandle />
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: space[1],
        }}
      >
        <Label>{label}</Label>
        {logged && <Label style={{ color: color.inkDim }}>logged today</Label>}
      </View>

      {/* What is already on the record. Shown before the options, so "add
          another" is obviously an addition rather than a replacement.

          Split into one line per thing done, for the same reason the day sheet
          is: `treadmill · walk` reads as one oddly-named activity rather than
          the two it is. `splitDetail` is the same function the outbox uses to
          fill the actions table, so this cannot drift from what was stored. */}
      {logged &&
        splitDetail(detail).map((action, i) => (
          <Body key={i} tone="dim" style={{ marginBottom: space[1] }}>
            {action}
          </Body>
        ))}

      {items.length > 0 && logged && (
        <Label style={{ color: color.inkMute, marginBottom: space[1] }}>
          add what else you did
        </Label>
      )}

      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityHint="Long press to rename or delete"
          disabled={chosen !== null}
          onPress={() => commit(item.label)}
          onLongPress={() => editItem(item)}
          android_ripple={chosen !== null ? undefined : ripple()}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: chosen === item.label ? color.lineHi : color.line,
            backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
            justifyContent: "center",
            paddingHorizontal: space[4],
          })}
        >
          <Body tone="ink">{item.label}</Body>
        </Pressable>
      ))}

      {typing ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <TextInput
            {...fieldTint}
            autoFocus
            value={custom}
            onChangeText={setCustom}
            placeholder="what did you do?"
            placeholderTextColor={color.inkMute}
            onSubmitEditing={() => commit(custom.trim() || null)}
            returnKeyType="done"
            style={[
              field,
              { flex: 1, minHeight: 56, backgroundColor: color.surfaceHi },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => commit(custom.trim() || null)}
            android_ripple={ripple()}
            style={{
              minHeight: 56,
              paddingHorizontal: space[4],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.lineHi,
              backgroundColor: color.surfaceHi,
              justifyContent: "center",
            }}
          >
            <Body tone="ink">{logged ? "add" : "log"}</Body>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setTyping(true)}
          android_ripple={ripple()}
          style={{
            minHeight: 56,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: color.line,
            justifyContent: "center",
            paddingHorizontal: space[4],
          }}
        >
          <Body tone="mute">something else</Body>
        </Pressable>
      )}

      {/* Always present, so it is part of the single measurement this sheet
          gets. The long-press on a chip covers the common fix; this is the way
          in when there is nothing on screen to long-press. */}
      <Pressable
        accessibilityRole="button"
        disabled={chosen !== null}
        // Wrapped, not passed directly: `manage` takes an optional id, and a
        // bare reference would hand it the press event as one.
        onPress={() => manage()}
        android_ripple={chosen !== null ? undefined : ripple()}
        style={{
          minHeight: TAP,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.md,
        }}
      >
        <Body tone="mute" style={{ fontSize: size.xs }}>
          manage activities
        </Body>
      </Pressable>

      {/* The floor when nothing is logged yet; the way back when something is.
          Exactly one of these is ever offered, so the sheet never asks you to
          read two similar buttons and pick. */}
      {logged ? (
        <Pressable
          accessibilityRole="button"
          disabled={chosen !== null}
          onPress={remove}
          android_ripple={chosen !== null ? undefined : ripple("destructive")}
          style={({ pressed }) => ({
            minHeight: TAP,
            alignItems: "center",
            justifyContent: "center",
            marginTop: space[1],
            borderRadius: radius.md,
            backgroundColor: pressFillFlat(color.downDim, pressed),
          })}
        >
          <Body style={{ fontSize: size.xs, color: color.down }}>
            remove today&apos;s {label}
          </Body>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={chosen !== null}
          onPress={() => commit(null)}
          android_ripple={chosen !== null ? undefined : ripple()}
          style={{
            minHeight: TAP,
            alignItems: "center",
            justifyContent: "center",
            marginTop: space[1],
            borderRadius: radius.md,
          }}
        >
          <Body tone="mute" style={{ fontSize: size.xs }}>
            just mark it up
          </Body>
        </Pressable>
      )}
    </View>
  );
}
