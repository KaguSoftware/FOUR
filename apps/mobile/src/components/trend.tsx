import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { dailyTrend, trendPath, type SignalSample } from "@uptime/core";
import { Body } from "./ui";
import { color, space } from "@/theme";

const W = 320;
const H = 64;

/**
 * The only chart in the app, and it is here because this is the single place
 * where a trend IS the information.
 *
 * Muted line, no gradient fill, no axis furniture, and **declining renders in
 * the same neutral ink as rising**. The plateau report carries that meaning in
 * words; a red downward line would be the product grading someone, which it
 * does not do.
 *
 * The series and the geometry both come from `@uptime/core`, so this and the
 * web chart cannot disagree about the shape of the same month.
 */
export function Trend({ samples }: { samples: SignalSample[] }) {
  const series = dailyTrend(samples);

  if (series.length < 2) {
    return (
      <Body tone="mute">
        {series.length === 1
          ? "One sample. The trend needs a few days."
          : "No samples yet."}
      </Body>
    );
  }

  const points = trendPath(series, { width: W, height: H });
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Felt-state trend across ${series.length} days, most recent ${series[series.length - 1].avg.toFixed(1)} out of 5.`}
    >
      <Svg width="100%" height={H + 8} viewBox={`0 -4 ${W} ${H + 8}`}>
        <Path
          d={d}
          fill="none"
          stroke={color.inkDim}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* One marker, on the most recent day. Sixty dots is a caterpillar,
            not a chart — the line carries the shape, the dot says "you are
            here". */}
        <Circle cx={last.x} cy={last.y} r={2.5} fill={color.ink} />
      </Svg>
    </View>
  );
}

/**
 * Weight, when the opt-in is on.
 *
 * Its own scale, because 1–5 does not apply. **No goal line, no target, no
 * "X above/below", no interpretation.** It is a number the user chose to keep,
 * never a score the product keeps on them.
 */
export function WeightTrend({
  points,
  unit,
}: {
  points: { observed_on: string; amount: number | null }[];
  unit: "kg" | "lb";
}) {
  const series = points
    .filter((p) => p.amount !== null)
    .map((p) => ({ date: p.observed_on, avg: p.amount as number }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length < 2) {
    return <Body tone="mute">Not enough entries to draw a line yet.</Body>;
  }

  // Scaled to the data's own range with a little air, so a two-kilo drift is
  // visible instead of being flattened by a fixed axis.
  const values = series.map((s) => s.avg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.15;

  const geom = trendPath(series, {
    width: W,
    height: H,
    min: lo - pad,
    max: hi + pad,
  });
  const d = geom.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const last = geom[geom.length - 1];

  return (
    <View>
      <Svg width="100%" height={H + 8} viewBox={`0 -4 ${W} ${H + 8}`}>
        <Path
          d={d}
          fill="none"
          stroke={color.inkDim}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={2.5} fill={color.ink} />
      </Svg>
      <Body tone="mute" style={{ marginTop: space[2] }}>
        {series[series.length - 1].avg} {unit} · latest
      </Body>
    </View>
  );
}
