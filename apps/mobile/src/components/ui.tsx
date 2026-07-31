import { Text, View, type TextProps, type ViewProps } from "react-native";
import { color, size } from "@/theme";

/**
 * The type primitives, so no screen re-invents the ramp.
 *
 * Everything here sets `fontFamily` explicitly. React Native has no cascade —
 * an unstyled `<Text>` falls back to the system face, which on Android is
 * Roboto and instantly stops looking like this product.
 */

/**
 * The one property that makes Android set type the way iOS does.
 *
 * Android's `TextView` reserves extra space above the ascender and below the
 * descender, taken from the font file's own metrics, and includes it in the
 * view's height. iOS does not. So identical `fontSize` and `lineHeight` give
 * a taller box on Android with the glyphs sitting off-centre inside it — the
 * amount depends on the FONT, which is why it lands differently on Archivo
 * Black, Inter and JetBrains Mono and cannot be corrected with one padding
 * value.
 *
 * It compounds wherever type is centred or baseline-aligned against something
 * else: the hero readout beside its `/30`, every uppercase micro-label in a
 * row with a Switch, the run length on the dashboard. This project has
 * already fixed the iOS half of that problem twice (see `fields.ts` and the
 * `rowText` note in `settings-ui.tsx`); this is the Android half.
 *
 * **Android-only — iOS ignores it entirely**, so setting it unconditionally
 * costs nothing and cannot move an iOS pixel.
 */
export const androidMetrics = { includeFontPadding: false } as const;

export function Wordmark() {
  return (
    <Text
      style={{
        ...androidMetrics,
        fontFamily: "ArchivoBlack_400Regular",
        fontSize: size.lg,
        color: color.ink,
        letterSpacing: -0.6,
      }}
    >
      four
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
          ...androidMetrics,
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
          ...androidMetrics,
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
          ...androidMetrics,
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
