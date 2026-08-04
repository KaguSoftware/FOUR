import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { Body, Label } from "./ui";
import { pressFill, ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * The three weights a button can carry.
 *
 * `default` is the app's own button and the only one that existed until
 * 2026-08-04. The other two exist because the sign-in screen has to say three
 * different things at once and a single shape could only say one:
 *
 * - `subtle` — a real control that is deliberately NOT the main one. Same
 *   border and radius, one step quieter in text, and the shorter `TAP` height
 *   rather than `tall`'s 56. It replaced the two `TextButton`s on sign-in,
 *   which were 12px grey text with no box and read as a caption.
 * - `provider` — a third party's button, on their terms. White fill and dark
 *   text, because that is what Apple's own `WHITE` button gives us to match
 *   and what Google's four-colour mark needs under it. It is the one variant
 *   whose colours are NOT from `theme.ts`: a vendor fixes them, not us.
 */
export type ButtonVariant = "default" | "subtle" | "provider";

/** The two vendor colours. Google's guidelines fix both; see `GoogleMark`. */
const PROVIDER_BG = "#ffffff";
const PROVIDER_BG_PRESSED = "#dadce0";
const PROVIDER_INK = "#1f1f1f";

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
  variant = "default",
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  /** The 56pt CTA height onboarding and the auth screens use. */
  tall?: boolean;
  /** See `ButtonVariant`. Omitted is the app's own button, unchanged. */
  variant?: ButtonVariant;
  /**
   * Drawn before the label, in a row. For a vendor mark — this app draws no
   * decorative icons on its own buttons, and `Label` is the whole content
   * everywhere else.
   */
  icon?: ReactNode;
}) {
  const off = disabled || busy;
  const provider = variant === "provider";

  // A provider's button is theirs, so its fill and its pressed step are the
  // vendor's light pair rather than this app's dark one.
  const rest = provider ? PROVIDER_BG : color.surfaceHi;
  const held = provider ? PROVIDER_BG_PRESSED : color.line;

  const ink = destructive
    ? color.down
    : provider
      ? PROVIDER_INK
      : variant === "subtle"
        ? color.inkDim
        : color.ink;

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
        // The white button needs no stroke to separate it from the page — its
        // own fill already does, at 16:1. A `line-hi` edge on it would read as
        // a grey halo rather than a border.
        borderColor: provider ? PROVIDER_BG : color.lineHi,
        backgroundColor: pressFill(rest, held, pressed),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space[3],
        paddingHorizontal: space[4],
        opacity: off ? 0.4 : 1,
      })}
    >
      {/* The mark goes with the label, not with the button: when `busy`
          replaces the title with "…", the icon leaves too, so the row does not
          hold a vendor logo next to an ellipsis. */}
      {icon && !busy ? icon : null}
      <Label style={{ color: ink }}>{busy ? "…" : title}</Label>
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
