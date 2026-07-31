import { Platform, View } from "react-native";

import { color, radius, space } from "@/theme";

/**
 * The Android bottom sheet's drag handle.
 *
 * The four sheets in this app are presented by the navigator, not drawn by us
 * — `presentation: "formSheet"` is a real `UISheetPresentationController` on
 * iOS and a real Material bottom sheet on Android. But `sheetGrabberVisible`,
 * the option that draws the little pill at the top, is **iOS-only**; the
 * react-native-screens types mark it `@platform ios` outright. So iOS sheets
 * have always had a grabber and Android sheets have had nothing: no visible
 * cue that the surface can be dragged away, on a platform where every bottom
 * sheet has one.
 *
 * There is no Android option to turn on, so the handle is content. Material's
 * spec is a 32×4 rounded bar, centred, in the surface's outline colour, with
 * roughly 16dp of clearance around it. The sheet's own `paddingTop` supplies
 * the space above; the margin below is deliberately small because three of
 * the four sheets set a `gap` on the same container and it composes with this
 * — 8 here lands each of them between 16 and 24.
 *
 * **The colour is `line-hi`, not `line`.** `line` was the obvious pick — it is
 * the divider token — and `npm run check:contrast` measured it at **1.35:1**
 * against the sheet's `surface`, which is a handle you cannot see. This is the
 * only cue that the sheet can be dragged away, so it is an affordance rather
 * than a divider, and affordances take the token that reads: `line-hi`, at
 * 3.09:1. Same class of defect as the `line-hi` ring that once shipped at
 * 2.27:1.
 *
 * It is decoration in the
 * accessibility tree's terms (the sheet is already dismissible by gesture and
 * by back), so it is hidden from screen readers rather than announced as an
 * unlabelled view.
 *
 * Renders nothing at all on iOS, where the real grabber is doing this job.
 */
export function SheetHandle() {
  if (Platform.OS !== "android") return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        alignSelf: "center",
        width: 32,
        height: 4,
        borderRadius: radius.sm,
        backgroundColor: color.lineHi,
        marginBottom: space[2],
      }}
    />
  );
}
