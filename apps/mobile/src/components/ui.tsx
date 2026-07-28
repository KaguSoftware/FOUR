import { Text, View, type TextProps, type ViewProps } from "react-native";
import { color, size } from "@/theme";

/**
 * The type primitives, so no screen re-invents the ramp.
 *
 * Everything here sets `fontFamily` explicitly. React Native has no cascade —
 * an unstyled `<Text>` falls back to the system face, which on Android is
 * Roboto and instantly stops looking like this product.
 */

export function Wordmark() {
  return (
    <Text
      style={{
        fontFamily: "ArchivoBlack_400Regular",
        fontSize: size.lg,
        color: color.ink,
        letterSpacing: -0.6,
      }}
    >
      uptime
    </Text>
  );
}

/** Micro-label: uppercase, tracked out, quiet. Names a thing, never shouts. */
export function Label({ style, ...rest }: TextProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: "Inter_500Medium",
          fontSize: size["2xs"],
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: color.inkMute,
        },
        style,
      ]}
    />
  );
}

export function Body({
  tone = "dim",
  style,
  ...rest
}: TextProps & { tone?: "ink" | "dim" | "mute" | "down" | "degraded" }) {
  const tones = {
    ink: color.ink,
    dim: color.inkDim,
    mute: color.inkMute,
    down: color.down,
    degraded: color.degraded,
  } as const;

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: "Inter_400Regular",
          fontSize: size.sm,
          lineHeight: size.sm * 1.55,
          color: tones[tone],
        },
        style,
      ]}
    />
  );
}

/**
 * Anything that is a number.
 *
 * Tabular figures, so a run length changing from 9 to 10 does not shift the
 * text beside it. This has already been a real defect once on web, where a run
 * length was set in the label face and jittered.
 */
export function Mono({ style, ...rest }: TextProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: "JetBrainsMono_400Regular",
          fontVariant: ["tabular-nums"],
          color: color.ink,
        },
        style,
      ]}
    />
  );
}

/** A hairline rule. Structural only — it never carries state. */
export function Rule({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[{ height: 1, backgroundColor: color.line }, style]}
    />
  );
}
