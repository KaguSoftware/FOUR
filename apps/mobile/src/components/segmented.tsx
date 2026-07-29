import { Pressable, Text, View } from "react-native";
import { color, radius, size, space, TAP } from "@/theme";

/**
 * A compact multiple-choice control.
 *
 * This exists because Settings was drowning. Posture is a two-value boolean and
 * it was rendered as two stacked `ChoiceCard`s with full explanatory copy —
 * about 300pt, close to half the viewport, sitting above everything else on the
 * screen. Onboarding still uses the cards, and should: first run is where the
 * difference has to be taught. Settings is for someone who already knows which
 * one they picked and wants to change it.
 *
 * **Selection rests on three signals, not one.** `choice-card.tsx` documents why
 * and the same reasoning applies here: fill alone measured 1.10:1 on the web
 * version and was effectively invisible. The treatment is lifted from the
 * `Scale` control on the Proof screen, which is already measured — `line` fill,
 * a 2px `line-hi` border, and `ink` text at 11.37:1 — so this matches something
 * the app already ships rather than inventing a fourth selected-state idiom.
 *
 * No colour: every bright hue in this palette is reserved for status.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; title: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Names the group for screen readers — the visible label is separate. */
  label: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: space[2] }}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.title}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: TAP,
              borderRadius: radius.md,
              borderWidth: on ? 2 : 1,
              borderColor: on ? color.lineHi : color.line,
              backgroundColor: on ? color.line : color.surface,
              alignItems: "center",
              justifyContent: "center",
              // Keeps the label from shifting by a pixel as the border thickens.
              paddingHorizontal: on ? space[3] - 1 : space[3],
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: on ? "Inter_500Medium" : "Inter_400Regular",
                fontSize: size.sm,
                color: on ? color.ink : color.inkMute,
              }}
            >
              {option.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
