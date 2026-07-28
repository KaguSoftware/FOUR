import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { color, radius, size, LEVER_HEIGHT, TAP } from "@/theme";
import type { LeverRow } from "@/lib/status";

/**
 * The levers. The thing you open the app to press.
 *
 * Custom rather than a platform control, on purpose: no OS ships a 64pt
 * two-state commit button, and this is the product. Everything *around* it is
 * native.
 *
 * **One tap logs the day.** No confirmation, no toast, no extra screen. The
 * detail sheet is optional and always has been. Any pattern that adds a step
 * has raised the bar this product exists to keep low.
 */
export function LeverButtons({
  levers,
  todayLevers,
  busy,
  onPress,
  onUndo,
  compact = false,
}: {
  levers: LeverRow[];
  todayLevers: string[];
  busy: boolean;
  onPress: (lever: LeverRow) => void;
  onUndo?: (lever: LeverRow) => void;
  compact?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {levers.map((lever, i) => {
        const done = todayLevers.includes(lever.key);
        // One lever spans the row; the third of three goes full-width rather
        // than leaving a hole, because an empty cell reads as a missing lever.
        const full = levers.length === 1 || (levers.length === 3 && i === 2);

        return (
          <View
            key={lever.key}
            style={{ flexBasis: full ? "100%" : "47%", flexGrow: 1 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: done, disabled: done || busy }}
              accessibilityLabel={
                done ? `${lever.label}, logged today` : `Log ${lever.label}`
              }
              disabled={done || busy}
              onPress={() => {
                // One crisp impact. Confirmation that the tap landed, not a
                // celebration — the register forbids that.
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onPress(lever);
              }}
              style={({ pressed }) => ({
                minHeight: compact ? TAP : LEVER_HEIGHT,
                borderRadius: radius.md,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                borderColor: done ? color.line : color.lineHi,
                backgroundColor: done
                  ? color.surface
                  : pressed
                    ? color.line
                    : color.surfaceHi,
              })}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: compact ? size.xs : size.sm,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: done ? color.inkMute : color.ink,
                }}
              >
                {done ? `${lever.label} ✓` : lever.label}
              </Text>
            </Pressable>

            {/* Sits below rather than over the button it undoes, and is a
                full-width target — it is used one-handed, mid-mistake. */}
            {done && onUndo && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Undo ${lever.label}`}
                disabled={busy}
                onPress={() => onUndo(lever)}
                style={{
                  minHeight: TAP,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: size.xs,
                    color: color.inkMute,
                  }}
                >
                  undo
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
