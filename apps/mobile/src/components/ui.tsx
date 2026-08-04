import { Image, Text, View, type TextProps, type ViewProps } from "react-native";
import Svg, { Path } from "react-native-svg";
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

/**
 * The FOUR logo — the 2x2 "FO/UR" mark, white on transparency. THE brand
 * mark, everywhere the app says its own name: hero surfaces at 72–96, tab
 * headers small at 40. It replaced a text wordmark ("four" in ArchivoBlack)
 * on 2026-08-03. An Image has no text baseline, so any row pairing it with
 * text must `alignItems: "center"`, never `"baseline"`.
 */
export function Logo({ width = 96 }: { width?: number }) {
  return (
    <Image
      source={require("../../assets/images/FOUR LOGO White Alpha.png")}
      accessibilityLabel="four"
      style={{ width, height: width * (2148 / 2048) }}
      resizeMode="contain"
    />
  );
}

/**
 * Google's "G", for the sign-in button.
 *
 * The one mark in this app that is not ours and therefore cannot be restyled:
 * Google's identity guidelines fix the four hues and the geometry, and a
 * monochrome or recoloured G is a rejection at review. It is the reason the
 * Google button is white rather than `surface-hi` — these hues need a light
 * ground, which is also what Apple's own WHITE button gives us to match.
 *
 * Drawn rather than shipped as a PNG for the same reason `pixelPaths` is path
 * data: one file, every density, no `@2x`/`@3x` set to keep in step.
 * `react-native-svg` was already a dependency.
 */
export function GoogleMark({ size: s = 18 }: { size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
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
