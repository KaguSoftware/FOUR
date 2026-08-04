import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  monthMotto,
  monthUptime,
  pixelPaths,
  pixelWall,
  wallCaption,
  wallGrid,
} from "@uptime/core";

import { Body, Label, Mono } from "@/components/ui";
import { Frame } from "@/components/screen";
import { Loading } from "@/components/states";
import { useStatus } from "@/lib/use-status";
import { color, size, space } from "@/theme";

/**
 * Proof — the wall.
 *
 * This screen was a chart. It answered "is this doing anything" with a
 * polyline of self-reported energy ratings, a question you had to already care
 * about to come and look at, and it asked for two ratings and a journal entry
 * in exchange. Nobody read it.
 *
 * It is now a screen full of cells, of which as many are lit as the fraction
 * of this month you have been up. **The message is made of the cells that
 * never light** — a stencil, with the earned ground filling in around it. At
 * nothing it is uniformly dark and says nothing. Half a month in, half of it
 * is readable.
 *
 * That inversion is the whole point, and it is what stops this being a poster.
 * The app never tells you to keep going; it gradually stops hiding the fact
 * that it would.
 *
 * Every number and every coordinate comes from `@uptime/core`, so the browser
 * draws the identical wall from the identical month.
 */
export default function ProofScreen() {
  const { status } = useStatus();
  /**
   * Measured, not guessed. The cell count is an integer that the message
   * layout depends on, so the wall cannot be laid out until the real box is
   * known — and `wallGrid` is in core precisely so this client and the web one
   * cannot round it differently.
   */
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Only on a real change: onLayout fires on every re-render on Android, and
    // rebuilding ~2,500 cells each time is wasted work.
    setBox((prev) =>
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  };

  if (!status) return <Loading />;

  const month = monthUptime(status.entries, status.today);

  return (
    <Frame
      headerRight={
        <Mono style={{ fontSize: size.xs, color: color.inkMute }}>
          {month.up}/{month.total}
        </Mono>
      }
    >
      {/* The one line that says what the screen is.

          Until now nothing on it explained itself: a dark grid with a fraction
          in the corner, and the fact that there is a MESSAGE in there at all
          was only ever stated in the walkthrough you saw once on your first
          launch. Someone opening this early in a month sees a dark rectangle
          and no reason to come back.

          It names the reward, not the mechanic. "One cell lights per day up"
          was the first attempt and it explains the plumbing — true, and no
          reason to look again. What makes this screen work is that the message
          is hiding in the cells that never light, and it surfaces as the rest
          fill in around it.

          **A statement, not an instruction.** "Keep going to reveal it" would
          make the app ask for something, which is the one register DESIGN.md
          rules out — and this screen in particular earns its restraint by
          never telling you to do anything. It says what is happening; the
          wanting is the reader's.

          **On the same ROW as the label, not under it.** This screen is a
          `Frame` and the wall is measured from whatever height is left over, so
          a second line would come straight out of the wall — and the wall's fit
          is already the thing most likely to be wrong here. Sharing the baseline
          costs nothing. `flex: 1` + `numberOfLines` so a long font or a small
          phone truncates the sentence rather than pushing the fraction off. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: space[2],
          marginBottom: space[3],
        }}
      >
        <Label>this month</Label>
        <Body
          tone="mute"
          numberOfLines={1}
          style={{ flex: 1, fontSize: size.xs, lineHeight: size.xs * 1.5 }}
        >
          days up uncover a message
        </Body>
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        {box && (
          <Wall
            width={box.width}
            height={box.height}
            up={month.up}
            total={month.total}
            pct={month.pct}
            // Drawn from the pool, keyed on the calendar month — stable while
            // it is being earned, different the next time one starts.
            message={monthMotto(status.today)}
          />
        )}
      </View>
    </Frame>
  );
}

function Wall({
  width,
  height,
  up,
  total,
  pct,
  message,
}: {
  width: number;
  height: number;
  up: number;
  total: number;
  pct: number;
  message: string;
}) {
  const grid = wallGrid({ width, height });
  const wall = pixelWall({ cols: grid.cols, rows: grid.rows, pct, message });
  const paths = pixelPaths(wall, grid);

  const span = (n: number) => n * (grid.cell + grid.gap) - grid.gap;

  return (
    <View
      accessible
      accessibilityRole="image"
      // The wall is unreadable to anything not looking at it, so this sentence
      // is not a supplement to the visual — it IS the screen. It reads the
      // wall's own `shown`, so it can never announce a word that was truncated
      // off a narrow grid.
      accessibilityLabel={wallCaption(wall, up, total)}
    >
      <Svg width={span(grid.cols)} height={span(grid.rows)}>
        {/*
          A handful of paths for ~2,500 cells rather than 2,500 views. `ground`
          covers the masked cells AND the unearned ones together, and they MUST
          stay the same colour: draw them even one step apart and the message
          is legible at zero, which is the whole idea undone. The lit layer is
          a few opacity bands — the tide fading in behind the reveal front —
          with both the split and the opacities computed in core so the web
          draws the identical fade.
        */}
        <Path d={paths.ground} fill={color.line} />
        {paths.lit.map((band) => (
          <Path
            key={band.opacity}
            d={band.d}
            fill={color.ink}
            fillOpacity={band.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}
