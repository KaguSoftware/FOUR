import { useEffect, useState } from "react";
import { Pressable, View, type ViewProps } from "react-native";

import { Body, Label } from "@/components/ui";
import { color, radius, space, TAP } from "@/theme";

/**
 * Loading, failed, and inline save states.
 *
 * These exist because every screen except the dashboard used to render a bare
 * black rectangle while it loaded and nothing at all when a read failed. A
 * black rectangle is indistinguishable from a crash, and a failed read that
 * falls through to an empty state is worse than either: on `/proof` it told
 * someone with months of journal that they had written nothing.
 *
 * ## Why failure is not red
 *
 * `down` and `degraded` are reserved for the state of the monitored system —
 * the user's own uptime. An app that cannot reach its database is a different
 * axis entirely, and colouring it red would say "you are down" when the truth
 * is "we could not read". That mistake would land hardest in the exact moment
 * this product is designed for: reopening the app after several days away,
 * where a red screen reads as an accusation.
 *
 * So faults are stated at full ink contrast inside a bordered surface —
 * emphasis by containment rather than by hue. Restraint as signal, which is
 * the same reason `UP` has no colour either. See DESIGN.md, The Two-Hue
 * Ceiling and The Quiet-Is-Good Rule.
 */

/**
 * How long a load may take before it is worth mentioning.
 *
 * Matches the web client's pending-navigation dot: a fast read should never
 * flash an indicator, because a flicker reads as instability in a panel whose
 * entire claim is that the readout is steady.
 */
const REVEAL_MS = 120;

/** True once `ms` has passed since mount. Cleans up on unmount. */
function useDelayed(ms: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPast(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return past;
}

/**
 * A screen waiting on its first read.
 *
 * Renders nothing at all for the first {@link REVEAL_MS}, so the common case —
 * a warm cache answering immediately — shows no indicator whatsoever.
 */
export function Loading({ style, ...rest }: ViewProps) {
  const show = useDelayed(REVEAL_MS);

  return (
    <View
      {...rest}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        { flex: 1, backgroundColor: color.bg, padding: space[5] },
        style,
      ]}
    >
      {show && <Label>loading</Label>}
    </View>
  );
}

/**
 * A read that did not come back.
 *
 * Always carries a way out. A dead end here is the same failure as a takeover
 * with nothing tappable on it: the screen that shows up in the worst moment
 * must never be a wall.
 */
export function Failed({
  message,
  onRetry,
  style,
  ...rest
}: ViewProps & { message?: string | null; onRetry?: () => void }) {
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: color.bg, padding: space[5] },
        style,
      ]}
    >
      <Fault message={message} onRetry={onRetry} />
    </View>
  );
}

/**
 * The fault block itself, without a screen wrapper — for placing inside a
 * scroll view that still has other content worth showing.
 */
export function Fault({
  message,
  onRetry,
  label = "couldn't reach the system",
  retryLabel = "retry",
}: {
  message?: string | null;
  onRetry?: () => void;
  label?: string;
  retryLabel?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderWidth: 1,
        borderColor: color.lineHi,
        backgroundColor: color.surface,
        borderRadius: radius.md,
        padding: space[4],
        gap: space[3],
      }}
    >
      <Label style={{ color: color.ink }}>{label}</Label>
      {/* The raw reason, kept rather than swallowed. "Why didn't it work" must
          have an answer here for the same reason `monitor_runs` exists. */}
      {message ? <Body tone="mute">{message}</Body> : null}
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={({ pressed }) => ({
            minHeight: TAP,
            alignSelf: "flex-start",
            paddingHorizontal: space[5],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.lineHi,
            backgroundColor: pressed ? color.line : color.surfaceHi,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Label style={{ color: color.ink }}>{retryLabel}</Label>
        </Pressable>
      )}
    </View>
  );
}
