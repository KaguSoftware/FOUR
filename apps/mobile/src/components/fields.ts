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
} as const;

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
