import { View } from "react-native";
import { addDays, gridFill, type Entry } from "@uptime/core";
import { color, radius } from "@/theme";

/**
 * The day grid — the signature component, and one of the four things in this
 * app that is deliberately NOT a platform control.
 *
 * The ramp is computed by `@uptime/core`, not here. Two clients generating
 * their own shades would be two answers to "how did that day look", and the
 * whole reason core exists is that there is one. A day with more levers logged
 * is lighter; a down day is a bordered surface with no fill at all.
 *
 * Down cells carry a border that up cells do not, so state never rests on
 * colour alone — which is also what keeps the dimmest up-day from reading as a
 * gap in the row.
 */
export function DayGrid({
  entries,
  today,
  leverCount,
  days = 30,
}: {
  entries: Entry[];
  today: string;
  leverCount: number;
  days?: number;
}) {
  // How many distinct levers fired on each day. Keyed by date because that is
  // what the ramp is a function of — never by lever identity.
  const fired = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = fired.get(e.logged_for) ?? new Set<string>();
    set.add(e.lever);
    fired.set(e.logged_for, set);
  }

  const start = addDays(today, -(days - 1));
  const cells = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Last ${days} days. ${fired.size} logged.`}
    >
      {cells.map((date) => {
        const fill = gridFill(fired.get(date)?.size ?? 0, leverCount);
        const isToday = date === today;

        return (
          <View
            key={date}
            style={{
              width: 21,
              height: 21,
              borderRadius: radius.sm,
              backgroundColor: fill ?? color.surface,
              // A down day is an outline; an up day is a fill. Today gets the
              // brighter ring on top of whichever it is.
              borderWidth: fill && !isToday ? 0 : 1,
              borderColor: isToday ? color.lineHi : color.line,
            }}
          />
        );
      })}
    </View>
  );
}
