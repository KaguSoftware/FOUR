import { Platform, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { androidMetrics } from "./ui";
import { ripple } from "@/lib/press";
import { color, radius, size, space, TAP } from "@/theme";

const android = Platform.OS === "android";

/**
 * A compact multiple-choice control.
 *
 * This exists because Settings was drowning: a two-value choice rendered as
 * stacked cards with full explanatory copy ate close to half the viewport.
 * Settings is for someone who already knows which value they want.
 *
 * **Selection rests on three signals, not one.** Fill alone measured 1.10:1 on
 * the web version and was effectively invisible. The treatment is lifted from
 * the `Scale` control on the Proof screen, which is already measured — `line`
 * fill, a 2px `line-hi` border, and `ink` text at 11.37:1 — so this matches
 * something the app already ships rather than inventing a fourth
 * selected-state idiom.
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
      // Android's group is CONNECTED — the segments share edges and the whole
      // thing reads as one control. iOS keeps the separated pills it shipped.
      style={{ flexDirection: "row", gap: android ? 0 : space[2] }}
    >
      {options.map((option, i) => {
        const on = option.value === value;
        const first = i === 0;
        const last = i === options.length - 1;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.title}
            onPress={() => onChange(option.value)}
            // This control had NO press feedback on either platform — the only
            // answer to a tap was the selection moving. Android gets its
            // ripple; iOS keeps the unchanged behaviour, where the selection
            // change is immediate enough to serve as the acknowledgement.
            android_ripple={ripple()}
            style={{
              flex: 1,
              minHeight: TAP,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: android && on ? space[2] : 0,
              backgroundColor: on ? color.line : color.surface,
              // Material's group is a pill: fully round on the outer ends,
              // square where two segments meet. Sharing a single 1px edge
              // rather than doubling it is what makes it read as one control
              // instead of two touching ones.
              ...(android
                ? {
                    borderWidth: 1,
                    borderLeftWidth: first ? 1 : 0,
                    // `line-hi` on BOTH states, unlike iOS below.
                    //
                    // In a connected group the border is not decoration — it
                    // is the outline of the whole control against the page AND
                    // the divider between two segments. `line` measured
                    // **1.35:1** against the unselected `surface` fill
                    // (`check:contrast`, 2026-07-31), which is a group that
                    // looks like one undivided button. `line-hi` is 3.09:1
                    // against `surface` and 3.33:1 against `bg`, so the
                    // outline reads on the page and the divider reads between
                    // segments. Selection is still carried by fill, text
                    // weight and the check — not by this.
                    borderColor: color.lineHi,
                    borderTopLeftRadius: first ? TAP / 2 : 0,
                    borderBottomLeftRadius: first ? TAP / 2 : 0,
                    borderTopRightRadius: last ? TAP / 2 : 0,
                    borderBottomRightRadius: last ? TAP / 2 : 0,
                    paddingHorizontal: space[3],
                  }
                : {
                    borderRadius: radius.md,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? color.lineHi : color.line,
                    // Keeps the label from shifting by a pixel as the border
                    // thickens.
                    paddingHorizontal: on ? space[3] - 1 : space[3],
                  }),
            }}
          >
            {/* The Material selection check. A FOURTH signal — fill, border
                and weight all still apply — and the only one that is a change
                of shape rather than of value, which is what survives a
                colour-blind viewer and a dimmed screen at 6am.

                Android only: iOS's segmented idiom has never carried a check,
                and adding one there would be inventing a control rather than
                using the platform's. */}
            {android && on && (
              <MaterialIcons name="check" size={16} color={color.ink} />
            )}
            <Text
              numberOfLines={1}
              style={{
                ...androidMetrics,
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
