import { Pressable, View } from "react-native";
import { Body } from "./ui";
import { color, radius, size, space } from "@/theme";

/**
 * A one-of-N choice, used for posture in onboarding and in Settings.
 *
 * **Selection is carried by three signals, none of them fill.** The first
 * version leaned on the background stepping `surface` → `surface-hi`, which
 * measures **1.10:1** — technically different, functionally invisible, and the
 * owner said so the first time they used it. Fill was never going to work here:
 * even the next step up, `line`, is only 1.35:1 against `surface`.
 *
 * What actually reads, at the measured ratios:
 *   1. A **filled radio dot** — the conventional affordance, 11.37:1 against
 *      its own card. This is the one doing most of the work.
 *   2. **Border weight**, 1px → 2px, in `line-hi` (3.33:1 against the page)
 *      rather than `line` (1.45:1).
 *   3. **Text weight and colour** — the selected title is ink at full weight,
 *      the unselected one is muted.
 *
 * Note the detail text moves `ink-mute` → `ink-dim` when selected. On the
 * `line` fill, `ink-mute` measures 3.77:1 and fails AA; `ink-dim` is 6.58:1.
 * Do not "simplify" that back to one colour.
 */
export function ChoiceCard({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space[3],
        padding: space[4],
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? color.lineHi : color.line,
        backgroundColor: selected
          ? color.line
          : pressed
            ? color.surfaceHi
            : color.surface,
        // Keeps the text from shifting by a pixel when the border thickens.
        paddingVertical: selected ? space[4] - 1 : space[4],
        paddingHorizontal: selected ? space[4] - 1 : space[4],
      })}
    >
      <Radio on={selected} />
      <View style={{ flex: 1 }}>
        <Body
          tone={selected ? "ink" : "mute"}
          style={{
            fontFamily: selected ? "Inter_500Medium" : "Inter_400Regular",
          }}
        >
          {title}
        </Body>
        <Body
          tone={selected ? "dim" : "mute"}
          style={{ marginTop: space[1], fontSize: size.xs }}
        >
          {detail}
        </Body>
      </View>
    </Pressable>
  );
}

/** The signal that does most of the work. Deliberately not a tick glyph. */
function Radio({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: on ? color.ink : color.lineHi,
        alignItems: "center",
        justifyContent: "center",
        // Optical alignment with the title's cap height rather than its box.
        marginTop: 1,
      }}
    >
      {on && (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: color.ink,
          }}
        />
      )}
    </View>
  );
}
