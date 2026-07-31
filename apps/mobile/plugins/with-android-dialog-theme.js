const {
  withAndroidStyles,
  withAndroidColors,
  AndroidConfig,
} = require("expo/config-plugins");

/**
 * Put the app's palette on Android's native dialogs.
 *
 * Four confirmations raise a real `Alert.alert` — archive a lever (from the
 * dashboard and from Settings), sign out, delete the account. That is
 * deliberate: RN's `Alert` IS a native `AlertDialog` on Android, and a
 * question that destroys something must block. Statements go to the snackbar
 * instead; see `src/components/snackbar.tsx`.
 *
 * A dialog takes its colours from the **activity theme**, which no JavaScript
 * can reach — `Alert` exposes no styling API, by design, because the point of
 * using it is that it is the platform's. So the theme is the only layer to
 * change, and a config plugin is the only way to reach the theme.
 *
 * ## What was actually wrong
 *
 * Not darkness. `AppTheme` is `Theme.AppCompat.DayNight.NoActionBar` and
 * `userInterfaceStyle: "dark"` makes `expo-system-ui` call
 * `AppCompatDelegate.setDefaultNightMode(MODE_NIGHT_YES)` at launch, so the
 * DayNight theme already resolves to its dark variant and the dialog comes up
 * dark on its own. Verified by reading the generated `styles.xml` and
 * `SystemUI.kt` rather than assumed.
 *
 * What is wrong is the **accent**. AppCompat draws dialog buttons in
 * `?attr/colorAccent`, and nothing in the generated theme sets it — the only
 * colour Expo writes is `colorPrimary`, `#023c69`, a navy left over from the
 * template. So the one control in these dialogs renders in either AppCompat's
 * stock accent or a navy nobody chose, on a palette whose entire thesis is
 * that saturated colour is reserved for status. The surface is also the
 * platform's near-black rather than this product's `surface`, so the dialog
 * does not sit in the app's tonal ladder.
 *
 * ## Why AppCompat attributes and not Material 3
 *
 * This was written against `ThemeOverlay.Material3.MaterialAlertDialog` first,
 * which is wrong on both counts and would have shipped as dead config:
 *
 * - **RN builds the dialog with `androidx.appcompat.app.AlertDialog.Builder`**
 *   (`AlertFragment.kt`, `createAppCompatDialog`), which resolves
 *   `android:alertDialogTheme`. `materialAlertDialogTheme` is read by
 *   `MaterialAlertDialogBuilder`, which RN never constructs.
 * - `AppTheme`'s parent is an **AppCompat** theme, not Material 3, so a
 *   Material 3 overlay would be resolving colour attributes its host does not
 *   define.
 *
 * The title needs its own treatment for a third reason: RN calls
 * `builder.setCustomTitle()` with its own layout so the title can be an
 * accessibility heading, and that layout styles the text with
 * `?android:attr/windowTitleStyle` rather than the dialog's own title style.
 *
 * ## Keeping it honest
 *
 * The colours below are the tokens from `src/theme.ts`, which are themselves
 * the sRGB renderings of `apps/web/app/globals.css`. **This file is a third
 * copy of those hexes and `npm run check:contrast` cannot see it** — if the
 * palette moves, move it here too. Measured on `surface`: ink 13.86:1,
 * ink-dim 8.02:1.
 *
 * Only takes effect through `expo prebuild` / an EAS build. Expo Go runs its
 * own activity with its own theme and is unaffected.
 */

/** From `src/theme.ts`. Keep in sync — see the docblock. */
const PALETTE = {
  /** `surface` — the dialog sits one tonal step above the page. */
  four_dialog_bg: "#15191c",
  /** `ink`. Title and message. 13.86:1 on the above. */
  four_dialog_ink: "#eceff1",
  /** `ink-dim`. Body copy. 8.02:1. */
  four_dialog_ink_dim: "#b4b8bc",
  /**
   * `ink` again, for the buttons — deliberately NOT a hue.
   *
   * Android has no destructive button role; the platform's own convention is
   * that the wording carries it, which is why this app's copy says "Archive"
   * and "Delete" rather than "OK". And DESIGN.md reserves every saturated
   * value in the palette for status, so a dialog — which is not a status —
   * cannot borrow one.
   */
  four_dialog_accent: "#eceff1",
};

const withDialogColors = (config) =>
  withAndroidColors(config, (cfg) => {
    for (const [name, value] of Object.entries(PALETTE)) {
      cfg.modResults = AndroidConfig.Colors.setColorItem(
        AndroidConfig.Resources.buildResourceItem({ name, value }),
        cfg.modResults,
      );
    }
    return cfg;
  });

const withDialogStyles = (config) =>
  withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;

    const dialogStyle = {
      $: {
        name: "FourAlertDialog",
        // The DARK AppCompat alert theme. `Theme.AppCompat.Dialog.Alert` is
        // the dark one; `Theme.AppCompat.Light.Dialog.Alert` is its light
        // twin. Naming it outright rather than inheriting DayNight's choice
        // means this cannot come up light if the night-mode call ever moves.
        parent: "Theme.AppCompat.Dialog.Alert",
      },
      item: [
        { $: { name: "android:background" }, _: "@color/four_dialog_bg" },
        // The buttons. This is the attribute AppCompat actually draws them
        // with, and the reason this plugin exists.
        { $: { name: "colorAccent" }, _: "@color/four_dialog_accent" },
        // The message, and anything else asking the theme for text colour.
        { $: { name: "android:textColorPrimary" }, _: "@color/four_dialog_ink" },
        {
          $: { name: "android:textColorSecondary" },
          _: "@color/four_dialog_ink_dim",
        },
        // RN's custom title view styles itself from this, not from the
        // dialog's own title style. See the docblock.
        {
          $: { name: "android:windowTitleStyle" },
          _: "@style/FourAlertDialogTitle",
        },
      ],
    };

    const titleStyle = {
      $: {
        name: "FourAlertDialogTitle",
        parent: "TextAppearance.AppCompat.Title",
      },
      item: [{ $: { name: "android:textColor" }, _: "@color/four_dialog_ink" }],
    };

    const added = [dialogStyle, titleStyle];
    // Replace rather than append, so re-running prebuild cannot stack
    // duplicate <style> elements with the same name.
    const names = new Set(added.map((s) => s.$.name));
    styles.resources.style = [
      ...(styles.resources.style ?? []).filter((s) => !names.has(s.$.name)),
      ...added,
    ];

    // Point AppTheme at it.
    const appTheme = styles.resources.style.find(
      (s) => s.$.name === "AppTheme",
    );
    if (appTheme) {
      appTheme.item = [
        ...(appTheme.item ?? []).filter(
          (i) => i.$.name !== "android:alertDialogTheme",
        ),
        {
          $: { name: "android:alertDialogTheme" },
          _: "@style/FourAlertDialog",
        },
      ];
    }

    return cfg;
  });

module.exports = (config) => withDialogStyles(withDialogColors(config));
