import type { ReactNode } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import { Body, Label, Rule } from "./ui";
import { pressFillFlat, ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

const android = Platform.OS === "android";

/**
 * The vocabulary Settings is written in.
 *
 * Settings used to be one page holding everything, and it read as a wall:
 * six blocks separated by a 24 / hairline / 24 sandwich, led by a two-value
 * setting rendered as two full explanatory cards. Almost nothing was above the
 * fold and nothing suggested where anything was.
 *
 * It is now an index of four groups that push into their own screens. The
 * transitions are the platform's — a native stack, so the slide, the back
 * button, the edge-swipe and the header all come from the OS rather than being
 * animated by hand. That is the same rule the tab bar and the sheets follow.
 *
 * Each row states its current value on the right, so the index answers most
 * questions without being opened at all.
 */

/**
 * Row text sits on a tighter line box than paragraph text.
 *
 * `Body` bakes `lineHeight: 1.55` for prose, and on iOS the extra leading goes
 * ABOVE the glyphs — TextKit pins the baseline to the bottom of the line box.
 * Inside a vertically-centered row that skew is visible: the label rides a few
 * pixels low while a Switch or picker beside it is genuinely centered, so
 * every toggle looked misaligned with its own label (reported on device,
 * 2026-07-29). A line box close to the glyph height centers cleanly — the same
 * reason `Segmented` sets no lineHeight at all. Prose (`Note`) keeps the
 * reading leading; this is for single-line row text only.
 *
 * `textAlignVertical` is the Android half of the same fix, and it is needed
 * for a different reason: Android does not centre a `TextView`'s text within
 * its own line box by default — it top-aligns it — so a row whose text has
 * any leading at all sits high. iOS ignores the property, so it cannot
 * disturb the fix above.
 */
const rowText = {
  lineHeight: size.sm * 1.25,
  textAlignVertical: "center",
} as const;

/** A titled group of rows, hairline-separated. */
export function Group({
  title,
  children,
  first = false,
}: {
  title?: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <View style={{ marginTop: first ? 0 : space[8] }}>
      {title && <Label style={{ marginBottom: space[3] }}>{title}</Label>}
      <View
        style={{
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.line,
          backgroundColor: color.surface,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Hairline between rows in a group. Never after the last one. */
export function RowRule() {
  return <Rule style={{ marginLeft: space[4] }} />;
}

/**
 * A row that opens a screen.
 *
 * `router.push` in `onPress`, NOT `Link asChild`. The Link version shipped and
 * rendered every one of these rows as an unstyled column — title, value and
 * chevron stacked, no padding — because `asChild` cloning does not survive a
 * function-form `style` on the child Pressable: the function is dropped rather
 * than invoked, and with it every declared style. `ValueRow` (plain View) and
 * `ActionRow` (plain Pressable) were fine on the same screen, which is what
 * narrowed it. The link role in the accessibility tree is kept by hand.
 *
 * ## Two layouts, one row
 *
 * The two platforms genuinely disagree about how a settings row states its
 * current value, and this is the clearest case in the app of the locked "one
 * visual system, two interaction layers" rule paying for itself.
 *
 * **iOS** puts the value on the right, at the end of the row, with a
 * disclosure chevron after it. That is the `UITableViewCell` `.value1` style,
 * and every settings screen on the platform looks like it.
 *
 * **Android** puts it underneath, as a summary line, and shows no chevron at
 * all — a `Preference` with a `summary`, which is what the system Settings app
 * and every app that follows it does. The chevron is specifically an iOS tell:
 * Material dropped it because the whole row being tappable is already the
 * affordance, and a row that ends in an arrow reads as ported.
 *
 * The data is identical, the palette is identical, the type is identical, the
 * touch target is identical. Only the arrangement differs — and the
 * `accessibilityLabel` is assembled the same way on both, so the screen reader
 * hears one row either way.
 */
export function LinkRow({
  title,
  value,
  href,
  destructive = false,
}: {
  title: string;
  value?: string;
  href: Href;
  /** The sign-out red — for rows that open a screen you should read twice. */
  destructive?: boolean;
}) {
  const router = useRouter();
  const titleColor = destructive ? color.down : color.ink;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      onPress={() => router.push(href)}
      android_ripple={ripple(destructive ? "destructive" : "neutral")}
      style={({ pressed }) => ({
        minHeight: TAP + space[2],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingHorizontal: space[4],
        // The summary needs breathing room the single-line iOS row does not.
        paddingVertical: android && value ? space[3] : 0,
        backgroundColor: pressFillFlat(color.surfaceHi, pressed),
      })}
    >
      {android ? (
        <View style={{ flex: 1 }}>
          <Body style={[rowText, { color: titleColor }]}>{title}</Body>
          {value && (
            <Body
              tone="mute"
              numberOfLines={1}
              // The summary sits on the xs ramp with an xs line box — the same
              // pairing `Note` documents. At `sm` it competes with its own
              // title instead of qualifying it.
              style={{
                fontSize: size.xs,
                lineHeight: size.xs * 1.35,
                marginTop: 2,
              }}
            >
              {value}
            </Body>
          )}
        </View>
      ) : (
        <>
          <Body style={[rowText, { flex: 1, color: titleColor }]}>{title}</Body>
          {value && (
            <Body
              tone="mute"
              numberOfLines={1}
              style={[rowText, { maxWidth: "50%" }]}
            >
              {value}
            </Body>
          )}
          <MaterialIcons name="chevron-right" size={20} color={color.inkMute} />
        </>
      )}
    </Pressable>
  );
}

/** A row carrying a switch. The label is the target; the switch is the control. */
export function SwitchRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (on: boolean) => void;
}) {
  return (
    <View
      style={{
        minHeight: TAP + space[2],
        flexDirection: "row",
        alignItems: "center",
        gap: space[4],
        paddingHorizontal: space[4],
      }}
    >
      <Body tone="ink" style={[rowText, { flex: 1 }]}>
        {title}
      </Body>
      {/* React Native's Switch IS the platform control — a real UISwitch on
          iOS and a Material switch on Android, with the OS owning its gesture,
          animation and accessibility. Only the track and thumb are themed.

          The on-track was `ink` with a `bg` thumb — until a real phone showed
          iOS 26 IGNORES thumbTintColor: the thumb is white, always, so an ink
          track swallowed it whole (owner report, 2026-07-29). With a white
          thumb forced, the track must separate from BOTH the thumb and the
          off state, and `ink-mute` is the only neutral that does: measured
          3.48:1 against the white thumb and 3.74:1 against the `line` off
          track. This palette reserves every bright hue for status, so the
          switch still cannot borrow the usual green. `thumbColor` stays `ink`
          for the platforms that do honour it — same two ratios there. */}
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: color.line, true: color.inkMute }}
        thumbColor={color.ink}
        // iOS draws the off-state track from this rather than trackColor.false.
        ios_backgroundColor={color.line}
        // React Native's Switch injects `alignSelf: 'flex-start'` as a DEFAULT
        // style (Switch.js:267), which beats the row's alignItems and pinned
        // every switch to the top of its row while the label sat centered —
        // "all toggles vertically misaligned" on device, 2026-07-29. Caller
        // style composes after the default, so this wins.
        style={{ alignSelf: "center" }}
      />
    </View>
  );
}

/**
 * A row carrying a time. The control is the platform's own picker.
 *
 * On iOS the compact `UIDatePicker` sits inline where a value would — tapping
 * it opens the system's time popover, themed dark to match the app's only
 * appearance. Android has no inline idiom for this, so the row shows the value
 * and opens the Material time dialog, which is what every Android clock app
 * does. Values are Postgres `time` strings ("HH:MM:SS") end to end; the Date
 * object exists only for the picker's benefit and its calendar day is
 * meaningless.
 */
export function TimeRow({
  title,
  value,
  onChange,
}: {
  title: string;
  /** "HH:MM:SS" */
  value: string;
  onChange: (time: string) => void;
}) {
  // The Date is a carrier of DIGITS, never an instant: built in UTC, shown in
  // UTC (`timeZoneName` below), read back in UTC. It used to be built with
  // local-time rules on a year-2000 base day — and Hermes and the native
  // picker can disagree about a zone's rules on a date that old (Istanbul was
  // UTC+2 in 2000, UTC+3 now), so the instant shifted crossing the bridge and
  // a picked 13:20 was stored as 14:20 while the picker itself, converting
  // back the other way, kept showing 13:20. Owner report, 2026-07-30. Pinning
  // both sides to UTC leaves no rules to disagree about.
  const [h, m] = value.split(":");
  const asDate = new Date(Date.UTC(2000, 0, 1, Number(h) || 0, Number(m) || 0));

  const pick = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed" || !date) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`);
  };

  return (
    <View
      style={{
        minHeight: TAP + space[2],
        flexDirection: "row",
        alignItems: "center",
        gap: space[4],
        paddingHorizontal: space[4],
      }}
    >
      <Body tone="ink" style={[rowText, { flex: 1 }]}>
        {title}
      </Body>
      {Platform.OS === "android" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${value.slice(0, 5)}`}
          onPress={() =>
            DateTimePickerAndroid.open({
              value: asDate,
              mode: "time",
              is24Hour: true,
              timeZoneName: "UTC",
              onChange: pick,
            })
          }
          android_ripple={ripple()}
          style={({ pressed }) => ({
            minHeight: TAP,
            justifyContent: "center",
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            backgroundColor: pressFillFlat(color.surfaceHi, pressed),
          })}
        >
          <Body tone="mute" style={rowText}>
            {value.slice(0, 5)}
          </Body>
        </Pressable>
      ) : (
        <DateTimePicker
          value={asDate}
          mode="time"
          display="compact"
          themeVariant="dark"
          accentColor={color.ink}
          timeZoneName="UTC"
          onChange={pick}
          accessibilityLabel={title}
        />
      )}
    </View>
  );
}

/** A read-only row. */
export function ValueRow({ title, value }: { title: string; value: string }) {
  return (
    <View
      style={{
        minHeight: TAP + space[2],
        flexDirection: "row",
        alignItems: "center",
        gap: space[4],
        paddingHorizontal: space[4],
      }}
    >
      <Body tone="ink" style={[rowText, { flex: 1 }]}>
        {title}
      </Body>
      <Body tone="mute" style={rowText}>
        {value}
      </Body>
    </View>
  );
}

/** A row whose whole point is the action. `destructive` is the sign-out red. */
export function ActionRow({
  title,
  onPress,
  destructive = false,
}: {
  title: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      // Android tints a destructive ripple red — the Material convention, and
      // free here because the ripple is its own layer. iOS keeps the neutral
      // held fill it already shipped rather than gaining a red one.
      android_ripple={ripple(destructive ? "destructive" : "neutral")}
      style={({ pressed }) => ({
        minHeight: TAP + space[2],
        justifyContent: "center",
        paddingHorizontal: space[4],
        backgroundColor: pressFillFlat(color.surfaceHi, pressed),
      })}
    >
      <Body style={[rowText, { color: destructive ? color.down : color.ink }]}>
        {title}
      </Body>
    </Pressable>
  );
}

/**
 * Small print under a group.
 *
 * `Body` bakes in `lineHeight: size.sm * 1.55` = 20.15. Overriding `fontSize`
 * to `xs` without also overriding the line height — which the old Settings did
 * in five places — leaves 12px text sitting on 20pt lines, which was most of
 * why the page felt loose.
 */
export function Note({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return (
    <Body
      tone="mute"
      style={[
        {
          fontSize: size.xs,
          lineHeight: size.xs * 1.5,
          marginTop: space[3],
          paddingHorizontal: space[1],
        },
        style,
      ]}
    >
      {children}
    </Body>
  );
}
