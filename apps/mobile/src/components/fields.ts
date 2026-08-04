import { Platform } from "react-native";

import { color, radius, space, TAP } from "@/theme";

/**
 * Text input metrics, in one place.
 *
 * These were duplicated across the daily check and the note editor, and the
 * copies disagreed: the daily check's note had `paddingTop` and **no**
 * `paddingBottom`, so the moment text wrapped past the box the last line sat
 * flush against the border. The editor had both and looked correct. Same
 * control, two answers, and only one of them was right.
 *
 * `fontSize: 16` is not a style choice — below 16 iOS zooms the whole view when
 * the field takes focus, which on a sheet reads as the screen jumping.
 *
 * **No `lineHeight` on a single-line field, deliberately.** iOS TextKit pins
 * glyphs to the bottom of an inflated line box, so `lineHeight: 24` pushed the
 * text visibly below the field's vertical centre — reported on device as
 * "padding issues" (2026-07-29). Without it the native control centres the
 * text itself. `paddingVertical: 0` is the Android half of the same fix: its
 * TextInput ships default vertical padding that throws off centring in a
 * min-height box.
 *
 * **`writingDirection` and `textAlign` are pinned LTR, and that is not a
 * styling preference.** Nothing in this app is translated and no string in it
 * is RTL, but a device whose SYSTEM language is Persian or Arabic makes the
 * native field's natural direction RTL — so the caret starts on the right and
 * a password types backwards. Reported on device (2026-08-04) on the sign-in
 * screen, where it is worst: `secureTextEntry` shows dots, so there is no text
 * to read as mirrored and the field just behaves wrongly for no visible
 * reason. The email field above it was accidentally immune, because
 * `keyboardType="email-address"` already pins direction.
 *
 * Set here rather than on the two auth inputs so every field in the app agrees
 * — the log sheet's note, the activity editor and all six settings forms had
 * the same defect and nobody had typed into them on an RTL device yet.
 */
export const field = {
  minHeight: TAP,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.line,
  paddingHorizontal: space[4],
  paddingVertical: 0,
  color: color.ink,
  fontFamily: "Inter_400Regular",
  fontSize: 16,
  includeFontPadding: false,
  writingDirection: "ltr",
  textAlign: "left",
} as const;

/**
 * The caret, the highlight and the drag handles.
 *
 * Spread onto the `TextInput` itself, not into `field` — these are props, not
 * styles, and RN would drop them silently if they went in the style object.
 *
 * Android draws all three from the platform accent, which on this palette is
 * a stock blue caret and two stock blue teardrop handles on a near-black
 * field. Nothing else in the app is that colour, and the app has exactly one
 * appearance, so the accent has to come from the palette instead. `ink` for
 * the caret and handles, `line-hi` for the selection block — the same token
 * the app already uses wherever a stroke has to read against `bg` (3.33:1),
 * so highlighted text stays legible rather than being washed out by its own
 * highlight.
 *
 * **Android only, deliberately.** `cursorColor` and `selectionHandleColor` are
 * Android-only props, but `selectionColor` is NOT — iOS reads it and uses it
 * for the caret as well as the selection. Applying it there would repaint the
 * iOS caret grey, which is both a change to a shipped screen and a worse
 * caret. iOS keeps the system tint it has always had.
 */
export const fieldTint = Platform.select({
  android: {
    selectionColor: color.lineHi,
    cursorColor: color.ink,
    selectionHandleColor: color.ink,
  },
  default: {},
});

/**
 * A multi-line note field.
 *
 * Multiline is where `lineHeight` belongs — wrapped text needs the reading
 * leading, and a top-aligned multiline box has no centring to break.
 *
 * `maxHeight` is load-bearing on the daily check: without it a long entry grows
 * the field without limit and pushes the log — and the save button — off the
 * bottom of the screen while you are still typing into it.
 *
 * Spread this AFTER `field` and set `backgroundColor` at the call site; the two
 * surfaces differ on purpose (`surface` on a page, `surfaceHi` on a sheet,
 * which already sits on a lighter ground).
 */
export const noteField = {
  ...field,
  lineHeight: 24,
  minHeight: 110,
  maxHeight: 260,
  paddingTop: space[3],
  paddingBottom: space[3],
} as const;
