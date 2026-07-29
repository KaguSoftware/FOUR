import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";

import { Body, Label, Rule } from "./ui";
import { color, radius, size, space, TAP } from "@/theme";

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
 * `Link` with `asChild` rather than an `onPress` that calls `router.push`: it
 * keeps the platform's own press-and-navigate behaviour, and gives the row a
 * real link role in the accessibility tree.
 */
export function LinkRow({
  title,
  value,
  href,
}: {
  title: string;
  value?: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={value ? `${title}, ${value}` : title}
        style={({ pressed }) => ({
          minHeight: TAP + space[2],
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
          backgroundColor: pressed ? color.surfaceHi : "transparent",
        })}
      >
        <Body tone="ink" style={{ flex: 1 }}>
          {title}
        </Body>
        {value && (
          <Body tone="mute" numberOfLines={1} style={{ maxWidth: "50%" }}>
            {value}
          </Body>
        )}
        <MaterialIcons name="chevron-right" size={20} color={color.inkMute} />
      </Pressable>
    </Link>
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
      <Body tone="ink" style={{ flex: 1 }}>
        {title}
      </Body>
      {/* React Native's Switch IS the platform control — a real UISwitch on
          iOS and a Material switch on Android, with the OS owning its gesture,
          animation and accessibility. Only the track and thumb are themed.

          The track goes all the way to `ink` when on. Tinting it `line-hi`
          measured 2.29:1 against the off state — technically different, and
          the owner could not tell on a real phone. This palette reserves every
          bright hue for status, so a switch cannot borrow the usual green;
          going the other way gives 16.52:1 against the page versus 1.45:1 off. */}
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: color.line, true: color.ink }}
        thumbColor={color.bg}
        // iOS draws the off-state track from this rather than trackColor.false.
        ios_backgroundColor={color.line}
      />
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
      <Body tone="ink" style={{ flex: 1 }}>
        {title}
      </Body>
      <Body tone="mute">{value}</Body>
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
      style={({ pressed }) => ({
        minHeight: TAP + space[2],
        justifyContent: "center",
        paddingHorizontal: space[4],
        backgroundColor: pressed ? color.surfaceHi : "transparent",
      })}
    >
      <Body style={{ color: destructive ? color.down : color.ink }}>
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
