import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { MAX_LEVERS } from "@uptime/core";
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
 * has raised the bar this product exists to keep low. Reordering is behind a
 * long press for exactly that reason — a tap must never become ambiguous about
 * whether it logged.
 *
 * **The layout is a fixed two-column grid.** It used to flex, with a lone lever
 * or the third of three stretching to full width to avoid an empty cell. That
 * cannot survive drag-to-reorder: dragging into a slot would resize both the
 * thing being dragged and the thing it displaced, mid-gesture. Slots are
 * uniform and measured, and the odd lever now sits in a half-width cell.
 */

const GAP = 8;
const SPRING = { damping: 20, stiffness: 220 } as const;

/** Haptics off the UI thread. `runOnJS` needs a plain JS function to call. */
const tapFeedback = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const nudgeFeedback = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** Where slot `i` sits, in a two-column grid of `height`-tall cells. */
const slotAt = (i: number, cellW: number, height: number) => ({
  x: (i % 2) * (cellW + GAP),
  y: Math.floor(i / 2) * (height + GAP),
});

export function LeverButtons({
  levers,
  todayLevers,
  onPress,
  onAdd,
  onReorder,
  onArchive,
  compact = false,
}: {
  levers: LeverRow[];
  todayLevers: string[];
  onPress: (lever: LeverRow) => void;
  /** Offered while under the ceiling. Omitted on the takeover. */
  onAdd?: () => void;
  /** New order, first to last. Omitted where dragging makes no sense. */
  onReorder?: (ids: string[]) => void;
  /** Dropping on the trash. Archives — the product never deletes a lever. */
  onArchive?: (lever: LeverRow) => void;
  compact?: boolean;
}) {
  const canAdd = onAdd && levers.length < MAX_LEVERS;
  const draggable = !!onReorder && levers.length > 1;

  const [width, setWidth] = useState(0);
  // The order being shown right now. Non-null only while a drag is in flight
  // or its write is still settling.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // The gesture callbacks must not close over `order` — the parent re-renders
  // on every slot change, and reading a stale copy on drop would persist the
  // order from one nudge ago.
  const orderRef = useRef<string[] | null>(null);
  orderRef.current = order;

  // Clear the optimistic order only when a NEW lever list actually arrives.
  //
  // Clearing it on drop instead — the obvious version — snapped the grid back
  // to the server's order for the length of the round trip, so every successful
  // reorder flashed the old arrangement before showing the new one.
  const synced = useRef(levers);
  useEffect(() => {
    if (levers !== synced.current) {
      synced.current = levers;
      if (dragging === null) setOrder(null);
    }
  }, [levers, dragging]);

  const shown = useMemo(() => {
    if (!order) return levers;
    const byId = new Map(levers.map((l) => [l.id, l]));
    const mapped = order.map((id) => byId.get(id)).filter((l) => !!l);
    // If the list changed under the drag, the local order is no longer a
    // description of anything. Fall back rather than render a partial grid.
    return mapped.length === levers.length ? mapped : levers;
  }, [order, levers]);

  const height = compact ? TAP : LEVER_HEIGHT;
  const cellW = width > 0 ? (width - GAP) / 2 : 0;

  // Includes the add button — it occupies a slot, so it decides how tall the
  // grid is. Getting this wrong puts the trash zone's top edge inside the grid.
  const cells = shown.length + (canAdd ? 1 : 0);
  const rows = Math.max(1, Math.ceil(cells / 2));
  const gridH = rows * height + (rows - 1) * GAP;

  const pickUp = useCallback((id: string, current: LeverRow[]) => {
    setOrder(current.map((l) => l.id));
    setDragging(id);
  }, []);

  const hover = useCallback((id: string, to: number) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const from = prev.indexOf(id);
      if (from === -1 || to === from || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      nudgeFeedback();
      return next;
    });
  }, []);

  const drop = useCallback(
    (lever: LeverRow, overTrash: boolean) => {
      const final = orderRef.current;
      setDragging(null);

      if (overTrash && onArchive) {
        setOrder(null);
        onArchive(lever);
        return;
      }
      if (!final) return;

      // Only write when it actually moved. A long press that goes nowhere
      // should not spend a round trip, and should not clear the local order.
      const unchanged =
        final.length === levers.length &&
        final.every((id, i) => levers[i]?.id === id);
      if (unchanged) {
        setOrder(null);
        return;
      }
      onReorder?.(final);
    },
    [levers, onArchive, onReorder],
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: gridH }}>
        {cellW > 0 &&
          shown.map((lever, i) => (
            <LeverCell
              key={lever.id}
              lever={lever}
              slot={slotAt(i, cellW, height)}
              width={cellW}
              height={height}
              gridH={gridH}
              slotCount={shown.length}
              compact={compact}
              done={todayLevers.includes(lever.key)}
              draggable={draggable}
              isDragging={dragging === lever.id}
              onPress={() => onPress(lever)}
              onPickUp={() => pickUp(lever.id, shown)}
              onHover={(to) => hover(lever.id, to)}
              onDrop={(overTrash) => drop(lever, overTrash)}
            />
          ))}

        {/* Adding is offered where you notice it is missing — while looking at
            the buttons. Settings still has the full manager; this is only the
            one action people want from here. Deliberately quieter than a lever:
            it is not a thing you press to keep the day up. */}
        {canAdd && cellW > 0 && (
          <View
            style={{
              position: "absolute",
              width: cellW,
              height,
              left: slotAt(shown.length, cellW, height).x,
              top: slotAt(shown.length, cellW, height).y,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a lever"
              onPress={onAdd}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: color.line,
                backgroundColor: pressed ? color.surface : "transparent",
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: size.xs,
                  color: color.inkMute,
                }}
              >
                + add a lever
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {onArchive && draggable && <Trash visible={dragging !== null} />}
    </View>
  );
}

/** How far below the grid the trash sits, and how tall it is. */
const TRASH_TOP = 16;
const TRASH_H = 64;

function LeverCell({
  lever,
  slot,
  width,
  height,
  gridH,
  slotCount,
  compact,
  done,
  draggable,
  isDragging,
  onPress,
  onPickUp,
  onHover,
  onDrop,
}: {
  lever: LeverRow;
  slot: { x: number; y: number };
  width: number;
  height: number;
  gridH: number;
  slotCount: number;
  compact: boolean;
  done: boolean;
  draggable: boolean;
  isDragging: boolean;
  onPress: () => void;
  onPickUp: () => void;
  onHover: (to: number) => void;
  onDrop: (overTrash: boolean) => void;
}) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const held = useSharedValue(0);
  const lastSlot = useSharedValue(-1);
  const [lifted, setLifted] = useState(false);

  // Where this cell rests. Animated so a neighbour displaced by a drag slides
  // into the gap instead of teleporting.
  const baseX = useSharedValue(slot.x);
  const baseY = useSharedValue(slot.y);

  // **The cell being dragged does not follow the reordering.** Its slot index
  // changes as it passes its neighbours, and springing to that new slot while
  // ALSO carrying the finger's translation double-counts the movement — the
  // button leaps out from under the finger on every swap. It stays frozen at
  // the slot it was picked up from; only the others move.
  useEffect(() => {
    if (isDragging) return;
    baseX.value = withSpring(slot.x, SPRING);
    baseY.value = withSpring(slot.y, SPRING);
  }, [isDragging, slot.x, slot.y, baseX, baseY]);

  // Callbacks change identity on every parent render, which happens on every
  // slot swap. Reading them through a ref keeps the gesture below stable, so
  // it is never rebuilt mid-drag.
  const handlers = useRef({ onPickUp, onHover, onDrop });
  handlers.current = { onPickUp, onHover, onDrop };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // A tap logs; only a deliberate hold picks the button up. 250ms is the
        // platform's own long-press threshold, so this is not a new gesture to
        // learn — and it is why a mis-hold can never silently log a day.
        .activateAfterLongPress(250)
        .enabled(draggable)
        .onStart(() => {
          held.value = withTiming(1, { duration: 120 });
          lastSlot.value = -1;
          runOnJS(setLifted)(true);
          runOnJS(tapFeedback)();
          runOnJS(handlers.current.onPickUp)();
        })
        .onUpdate((e) => {
          dx.value = e.translationX;
          dy.value = e.translationY;

          // Measured from the frozen pickup position, not the current slot.
          const cx = baseX.value + e.translationX + width / 2;
          const cy = baseY.value + e.translationY + height / 2;
          const col = cx < width + GAP / 2 ? 0 : 1;
          const row = Math.max(0, Math.floor(cy / (height + GAP)));
          const to = Math.min(slotCount - 1, Math.max(0, row * 2 + col));

          // Only cross back to JS when the slot actually changes. `onUpdate`
          // fires every frame, and a `runOnJS` per frame is exactly the traffic
          // running this on the UI thread is meant to avoid.
          if (to !== lastSlot.value) {
            lastSlot.value = to;
            runOnJS(handlers.current.onHover)(to);
          }
        })
        .onEnd(() => {
          const overTrash =
            baseY.value + dy.value + height / 2 > gridH + TRASH_TOP;
          held.value = withTiming(0, { duration: 120 });
          dx.value = withSpring(0, SPRING);
          dy.value = withSpring(0, SPRING);
          runOnJS(setLifted)(false);
          runOnJS(handlers.current.onDrop)(overTrash);
        }),
    [
      draggable,
      width,
      height,
      gridH,
      slotCount,
      dx,
      dy,
      held,
      lastSlot,
      baseX,
      baseY,
    ],
  );

  const animated = useAnimatedStyle(() => ({
    left: baseX.value,
    top: baseY.value,
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { scale: 1 + held.value * 0.04 },
    ],
    // The dragged cell has to sit over its neighbours, and over the trash.
    zIndex: held.value > 0 ? 10 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ position: "absolute", width, height }, animated]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: done, disabled: done }}
          accessibilityLabel={
            done ? `${lever.label}, logged today` : `Log ${lever.label}`
          }
          accessibilityHint={
            draggable ? "Touch and hold to reorder or archive" : undefined
          }
          // Only the lever's OWN state disables it. A global "busy" flag used
          // to lock every button while any write was in flight, so logging two
          // levers meant waiting out a round trip between taps. The write is
          // idempotent, so overlapping taps are safe.
          disabled={done || lifted}
          onPress={() => {
            // One crisp impact. Confirmation that the tap landed, not a
            // celebration — the register forbids that.
            tapFeedback();
            onPress();
          }}
          style={({ pressed }) => ({
            flex: 1,
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
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The drop target, visible only while something is being dragged.
 *
 * Labelled "archive", not "delete", because that is what it does — the entries
 * keep pointing at the lever's key and every past day stays exactly as it was.
 * `entries_lever_fk` is `on delete no action` specifically so the database
 * refuses to orphan history, so a real delete is not on offer here or anywhere.
 *
 * `color.down` is borrowed here rather than decorating with it: this is the one
 * control in the app that removes something, and the palette reserves red for
 * exactly that weight of statement.
 */
function Trash({ visible }: { visible: boolean }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: 140 });
  }, [visible, shown]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    height: shown.value * TRASH_H,
    marginTop: shown.value * TRASH_TOP,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          borderRadius: radius.md,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: color.down,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        animated,
      ]}
    >
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: size.xs,
          color: color.down,
        }}
      >
        drag here to archive
      </Text>
    </Animated.View>
  );
}
