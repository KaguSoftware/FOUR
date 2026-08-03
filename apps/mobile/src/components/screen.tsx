import type { ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "./ui";
import { color, space, TAB_BAR } from "@/theme";

/**
 * Every tab screen's frame, and the one place the system chrome is accounted
 * for.
 *
 * All four tabs used to carry their own copy of this and all four were wrong in
 * the same two ways, because the padding was written by looking at the top of
 * the screen and guessing at the bottom.
 *
 * **The bottom.** `paddingBottom` was a flat `space[12]` — 48pt against a bar
 * that occupies `TAB_BAR` (49 on iOS) plus the home indicator. The last element
 * of every screen sat under translucent glass: visible, and not tappable.
 *
 * **The top.** `contentInsetAdjustmentBehavior` defaults to `"automatic"`, so
 * UIKit computes its own safe-area inset for a scroll view inside a tab
 * controller and applies it AFTER first layout — on top of the `insets.top` this
 * code was already adding. Two sources of truth for one number, one of them
 * arriving a frame late, which is the twitch you see on every tab switch.
 * `"never"` hands the whole question to JS, where it is written down.
 *
 * The scrim is the other half of the top: with `headerShown: false` on every
 * route there is no navigation bar behind the status bar, so scrolled content
 * ran under the clock. It is a solid fill rather than a fade — `DESIGN.md`
 * rules out shadows, `expo-linear-gradient` is not a dependency, and a hard
 * edge is the more honest read for an instrument panel anyway.
 */
export function Screen({
  children,
  headerRight,
  refreshControl,
  wordmark = true,
  underHeader = false,
}: {
  children: ReactNode;
  /** Sits on the wordmark's baseline — the up/degraded label on Status. */
  headerRight?: ReactNode;
  refreshControl?: ScrollViewProps["refreshControl"];
  /** Off for surfaces that own their whole header, like the takeover. */
  wordmark?: boolean;
  /**
   * For a screen pushed onto a native stack that shows a header.
   *
   * The header is opaque, so react-native-screens already lays the content out
   * below it — the top inset is spoken for, and adding it again would leave a
   * band of empty page. The scrim goes too: there is real chrome up there now,
   * which is what the scrim was standing in for.
   */
  underHeader?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: underHeader ? space[5] : insets.top + space[4],
          paddingHorizontal: space[5],
          // The indicator AND the bar. `insets.bottom` alone clears the
          // indicator and leaves everything under the tab bar.
          paddingBottom: insets.bottom + TAB_BAR + space[8],
        }}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
      >
        {wordmark && !underHeader && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: space[8],
            }}
          >
            <Wordmark />
            {headerRight}
          </View>
        )}
        {children}
      </ScrollView>

      {/* Painted after the ScrollView so it sits above it. Exactly the inset —
          the wordmark's own top padding provides the breathing room below.
          Omitted under a native header, which is real chrome doing the same
          job properly. */}
      {!underHeader && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: color.bg,
          }}
        />
      )}
    </View>
  );
}

/**
 * The same frame, for a screen that must NOT scroll.
 *
 * `Screen` is a `ScrollView`, which is right for every surface that is a list
 * of things. The pixel wall is the opposite: it is sized to the space it is
 * given and has to fit it exactly, because a wall you can scroll is a wall
 * whose message is cropped, and one that is 20pt taller than the viewport
 * bounces on every touch for no reason.
 *
 * It carries the identical insets — including `TAB_BAR`, which is the trap.
 * `insets.bottom` alone clears the home indicator and leaves the content under
 * translucent glass: visible and unreachable. That has been a real bug on this
 * project four times.
 *
 * Children get a `flex: 1` box, so measuring with `onLayout` gives the real
 * space available rather than the screen's full height.
 */
export function Frame({
  children,
  headerRight,
  wordmark = true,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  wordmark?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg,
        paddingTop: insets.top + space[4],
        paddingHorizontal: space[5],
        paddingBottom: insets.bottom + TAB_BAR + space[4],
      }}
    >
      {wordmark && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: space[5],
          }}
        >
          <Wordmark />
          {headerRight}
        </View>
      )}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * The same bottom allowance, for a surface that owns its own ScrollView.
 *
 * The takeover needs its own layout — no wordmark, its own top padding — but it
 * is still a tab-hosted screen and still has a bar over its last element.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR;
}
