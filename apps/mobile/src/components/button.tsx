import { Pressable } from "react-native";

import { Label } from "./ui";
import { color, radius, space, TAP } from "@/theme";

/**
 * The button. One shape, everywhere.
 *
 * This exact Pressable — hairline `line-hi` border, `surface-hi` fill stepping
 * to `line` under the finger, an uppercase Label inside — existed as five
 * separate inline copies (sign-in, onboarding, add-lever, the lever manager,
 * proof) before it was a component, and the copies had already drifted on
 * disabled opacity. The register's button is quiet on purpose: no fill colour,
 * no accent — every bright hue in this palette is reserved for status.
 *
 * `busy` renders the "…" the app uses instead of spinners, and disables.
 * `destructive` is the sign-out red, on the text only — the platform's own
 * destructive idiom is red text, not a red box.
 */
export function Button({
  title,
  onPress,
  disabled = false,
  busy = false,
  destructive = false,
  tall = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  /** The 56pt CTA height onboarding and the auth screens use. */
  tall?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: tall ? 56 : TAP,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.lineHi,
        backgroundColor: pressed ? color.line : color.surfaceHi,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space[4],
        opacity: off ? 0.4 : 1,
      })}
    >
      <Label style={{ color: destructive ? color.down : color.ink }}>
        {busy ? "…" : title}
      </Label>
    </Pressable>
  );
}
