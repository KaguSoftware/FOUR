import { Pressable } from "react-native";

import { Body, Label } from "./ui";
import { pressFill, ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

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
 *
 * Feedback comes from `lib/press`: the held fill on iOS, a bounded ripple on
 * Android. Never both — see that file for why.
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
      android_ripple={off ? undefined : ripple()}
      style={({ pressed }) => ({
        minHeight: tall ? 56 : TAP,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.lineHi,
        backgroundColor: pressFill(color.surfaceHi, color.line, pressed),
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

/**
 * The quiet one: a tappable line of text with no box around it.
 *
 * "or create an account", "email me a code", "not now — start without alerts",
 * "← back", "sign out", "remove". Eight inline copies of the same
 * `minHeight: TAP, justifyContent: "center"` Pressable wrapping a muted
 * `Body` at `size.xs`, and every one of them offered **no press feedback at
 * all** — the only acknowledgement was whatever the screen did next.
 *
 * On iOS that is defensible: these are text links, and iOS text links do not
 * highlight. On Android it is not — every text button in the system ripples,
 * and eight silent ones read as eight dead labels that happen to work.
 *
 * So iOS renders exactly what these sites already rendered, byte for byte,
 * and Android gains a bounded ripple. The radius is invisible on both (there
 * is no fill and no border); it exists only to give the ripple an outline to
 * clip to instead of spilling into a hard-edged rectangle.
 */
export function TextButton({
  title,
  onPress,
  disabled = false,
  align = "center",
  faded = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** `start` for a row of links; `center` for a full-width one under a CTA. */
  align?: "start" | "center";
  /** Dims the text without disabling — the OTP resend cooldown. */
  faded?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={disabled ? undefined : ripple()}
      style={{
        minHeight: TAP,
        justifyContent: "center",
        alignItems: align === "center" ? "center" : undefined,
        paddingHorizontal: space[3],
        // Cancels the padding above, so the text sits exactly where it did
        // before this component existed. The padding is only there to give the
        // ripple something to fill.
        marginHorizontal: -space[3],
        borderRadius: radius.md,
      }}
    >
      <Body tone="mute" style={{ fontSize: size.xs, opacity: faded ? 0.5 : 1 }}>
        {title}
      </Body>
    </Pressable>
  );
}
