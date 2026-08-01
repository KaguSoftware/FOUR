# Expo HAS CHANGED

**This app targets Expo SDK 54.** Read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code.

**And trust the installed type definitions over the docs.** The prose docs and
any summary of them lag the package, and a doc lookup has already handed back a
confidently wrong API on this project. Every fact below was confirmed by
reading `apps/mobile/node_modules/expo-router/**/*.d.ts`.

## Why 54 and not the newest

The owner's phone runs **Expo Go SDK 54**, and Expo Go ships exactly one SDK at
a time. The app was originally built on SDK 57 and deliberately moved back on
2026-07-28 so it can run on real hardware today.

**Do not bump the SDK without checking what Expo Go the owner has.** If you do
bump it, the notes below all need re-verifying — several of these APIs moved
between 54 and 57.

## ⚠ Expo Go no longer runs this app (2026-07-31)

`@react-native-google-signin/google-signin` is a **native module**, so it is not
in Expo Go's binary and the app cannot open there any more. This was an
explicit owner decision on 2026-07-31 ("full native, dev build required") taken
to get Credential Manager sign-in on Android.

**Testing is now a dev build**, which `eas.json` already has a profile for:

```
cd apps/mobile
npx eas-cli@latest build --profile development --platform android   # APK
npm run android                                                     # opens it
```

`npm run android` / `npm run ios` are still `expo start --<platform>` on
purpose. `expo prebuild` rewrites them to `expo run:*`, which needs a local
Android SDK / Xcode; **change them back** if you ever run a prebuild.

Three things now only exist in a real build and are invisible in any JS-only
check: the notification icon, the Android dialog theme, and edge-to-edge.

## The Android-native pass (2026-07-31)

The app was built iOS-first. This pass moved everything below the structural
line onto Android's own idioms. **Every change is either gated on
`Platform.OS === "android"` or uses a prop iOS ignores** — iOS was not to move,
and did not.

Reusable pieces, so nothing re-invents them:

- **`src/lib/press.ts`** — `ripple()` and `pressFill()`. Android gets a bounded
  ripple, iOS keeps its held-press fill, and **never both** (they stack into a
  smear). `foreground: true` is load-bearing: a background ripple is drawn
  behind the view's own fill and is invisible on every button in this app.
  A foreground ripple clips to the **Pressable's own** `borderRadius`, not its
  child's — a wrapper styled `{ flex: 1 }` around a rounded box paints a
  square ripple over it, which is why `TodayCell` carries an otherwise
  invisible radius. `pressDim()` is the third form, for a control whose fill
  is DATA and so has no resting colour to step to. **The day grid was the one
  surface this pass missed** — both its cells shipped a bare
  `pressed && { opacity: 0.6 }`, the iOS idiom, on Android too; fixed
  2026-08-01. Its ripple is `line-hi`, the fourth tone, because a cell's fill
  runs the whole ramp and `line` disappears against the dim end of it.
- **`src/lib/haptics.ts`** — `committed()` / `pickedUp()` / `nudged()`. Named by
  meaning, because the two platforms' vocabularies do not map 1:1.
  **`Haptics.impactAsync` is wrong on Android** and expo-haptics' own types say
  so — it drives the raw `Vibrator` and needs the `VIBRATE` permission.
  `performAndroidHapticsAsync` does not, which is why `app.json` now blocks
  that permission outright. Do not reintroduce `impactAsync` on an Android path.
- **`src/lib/back.ts`** — `useAndroidBack()`. Only for a screen running multiple
  steps inside ONE route (onboarding, the walkthrough). Everything else is on a
  native stack and needs nothing. **`gestureEnabled: false` does not affect the
  Android Back button** — different mechanism — which is how Back used to
  abandon onboarding mid-setup.
- **`src/lib/reduce-motion.ts`** — `useReduceMotion()`. "Remove animations" on
  Android, "Reduce Motion" on iOS. Owed on both per PRODUCT.md. Subscribes
  rather than reading once, because Android puts the toggle in quick settings.
  Rule: **the cue survives, only the movement goes.**
- **`src/components/snackbar.tsx`** — `useNotify()`. A snackbar on Android, the
  existing `Alert` on iOS. **Statements only.** The four confirmations (archive
  ×2, sign out, delete account) stay `Alert.alert` on both platforms: they ask a
  question and must block, and a snackbar can be missed.
- **`src/components/sheet.tsx`** — `<SheetHandle />`. `sheetGrabberVisible` is
  **iOS-only**, so Android sheets get no drag cue from the navigator; this draws
  one. Returns `null` on iOS.

Per-platform layout lives in the component, not the screen: `LinkRow` renders a
Material summary row on Android and a `.value1` cell with a chevron on iOS;
`Segmented` renders a connected M3 button group with a check on Android and
separated pills on iOS.

### Traps this pass hit

- **`expo install @react-native-google-signin/google-signin` adds its config
  plugin with no options**, which takes the plugin's *Firebase* branch and then
  demands `google-services.json` and `GoogleService-Info.plist`. This project
  has neither and does not use Firebase. **The plugin entry is removed from
  `app.json` deliberately** — the native module still autolinks, and Credential
  Manager needs only `webClientId` at runtime. Do not "fix" its absence.
- **`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is the *Web* client ID, never the
  Android one.** Android's client is matched by package name + SHA-1 and is
  never named in code. Confusing the two fails with `DEVELOPER_ERROR`, which
  tells you nothing. Unset, the app falls back to the browser flow and still
  works.
- **RN's `Alert` uses `androidx.appcompat.app.AlertDialog.Builder`**
  (`AlertFragment.kt`), so the dialog theme must be written in **AppCompat**
  attributes — `android:alertDialogTheme`, `colorAccent`,
  `android:windowTitleStyle`. `materialAlertDialogTheme` and the
  `materialAlertDialog*TextStyle` attributes are read only by
  `MaterialAlertDialogBuilder`, which RN never constructs; setting them is dead
  config. `plugins/with-android-dialog-theme.js` was written the wrong way
  first and corrected by reading RN's source.
- Dialogs were **already dark** — `AppTheme` is `DayNight` and `expo-system-ui`
  forces `MODE_NIGHT_YES`. The real defect was the **accent**: dialog buttons
  drew in an unset `colorAccent`, and the only colour in the theme was a navy
  `colorPrimary` (`#023c69`) left over from the template.
- **`includeFontPadding: false` is the Android typography fix** and is on all
  four type primitives in `ui.tsx`. Android reserves extra space from the
  font's own metrics and includes it in the view height; iOS does not. The
  amount depends on the FONT, so it cannot be corrected with one padding value.
- **`selectionColor` is NOT Android-only** — iOS reads it for the caret. That
  is why `fieldTint` in `fields.ts` is wrapped in `Platform.select`; applying
  it everywhere would have repainted the iOS caret grey.
- **`check:contrast` caught three of this pass's own defects.** The sheet drag
  handle and the segmented divider were written with `line` and measured
  **1.35:1** — invisible. Both are `line-hi` now. Add a case for every new pair;
  the palette is unchanged but a token on a new ground is a new measurement.
- **`plugins/with-android-dialog-theme.js` is a third copy of the palette
  hexes** and `check:contrast` cannot see it. Move it when the palette moves.

Regenerate the notification icon with `npm run icon:notification` from the repo
root. Android reads **only the alpha channel** of a small icon and tints it, so
a source with a full-canvas alpha renders as the white square everyone knows.

## Versions are not hand-picked

`package.json` versions are transcribed from `expo@54`'s own
`bundledNativeModules.json`. SDK 54 does **not** use one version number across
all packages the way 57 does — `expo-router` is `~6.0.24`, `expo-constants` is
`~18.0.13`. Guessing produces an unresolvable peer tree.

To change a dependency: `cd apps/mobile && npx expo install --fix`.

## SDK 54 facts

- **`Stack` comes from `expo-router/stack`.** It is the *native* stack, so
  native back buttons, native headers and the edge-swipe / predictive-back
  gesture come free — do not re-implement any of them. `Stack.Protected
  guard={…}` removes a branch from the navigation state entirely, which is the
  auth/onboarding gate.
- **`expo-router` does NOT export `ThemeProvider` / `Theme` in v6.** Native
  chrome is themed through the navigator's `screenOptions` instead, which is
  what `src/app/_layout.tsx` does.
- **Native tabs:** `NativeTabs`, plus `Icon` / `Label` / `Badge` / `VectorIcon`
  as **top-level exports** of `expo-router/unstable-native-tabs` — they are not
  `NativeTabs.Trigger.Icon` sub-components the way they are in 57.
  `minimizeBehavior` and `blurEffect` do exist here, so the iOS 26 glass tab bar
  works.
- **Tab icons are per-platform.** `Icon` takes `sf` (SF Symbol by name) for iOS.
  For Android it offers `drawable` — a native resource, which needs a prebuild
  and therefore does **not** work in Expo Go — so we use `VectorIcon` with
  `MaterialIcons` from `@expo/vector-icons`. There is no Material-Symbol-by-name
  prop in 54; that (`md`) arrived in 57.
- **`NativeTabs` `iconColor` and `labelStyle` MUST use the
  `{ default, selected }` form.** Given a flat value, they apply to the selected
  state too and **silently override `tintColor`** — the type docs say so
  outright — so the selected tab renders identically to the others. On iOS 26
  the glass selection pill hides the bug entirely; on any device without Liquid
  Glass there is then no selection indicator at all. Shipped that way in build 7
  and was reported from a device. Android additionally needs `indicatorColor`:
  its Material 3 pill defaults to a colour chosen for a light surface and is
  invisible on this palette. The four tab-bar pairs are now in
  `scripts/check-contrast.mjs` so it cannot regress quietly.
- **`Icon` takes `sf={{ default, selected }}`** for a filled-when-active symbol.
  Not used, because only `house` and `gearshape` have filled twins —
  `clock.arrow.circlepath` and `chart.xyaxis.line` do not, and two tabs changing
  shape while two stay flat reads as the other two being broken. `SFSymbol` is a
  typed union, so a wrong symbol name fails `tsc` rather than shipping a blank
  tab.
- **`@expo/ui` on SDK 54 is `0.2.0-beta.9`** and has no universal components.
  We do not use it. React Native's own `Switch` **is** the platform control —
  a real `UISwitch` / Material switch — so nothing is lost.
- **`expo-glass-effect` does not exist in SDK 54.**
- **Sheets are navigator-presented, not hand-drawn.** A route with
  `presentation: "formSheet"` + `sheetAllowedDetents: "fitToContents"` is a real
  `UISheetPresentationController`. See `src/app/log.tsx`.
- Routes live in **`src/app/`**, not `app/`.

## This app's own rules

- **Never `logicalDate()` — always `logicalDateLocal()`.** Hermes delegates
  `Intl` to platform ICU and it varies by Android version. See HANDOFF gotchas.
- **`@uptime/core` is the only place a number is derived.** If you find yourself
  writing date maths or a colour ramp in this app, import it instead.
- **Metro needs no monorepo config** — Expo detects workspaces since SDK 52.
- **A stale hoisted package will silently break the bundler.** After any SDK
  change, delete `node_modules` and `package-lock.json` at the repo root and
  reinstall; a leftover `react-native` at the root gets resolved in preference
  to the workspace's own and fails with an unrelated-looking syntax error.
- **Never run `supabase` from `apps/mobile` — it belongs at the REPO ROOT.**
  `supabase/` (config, migrations, `.temp`) lives at the root. Run `db push`
  from here and the CLI finds no local migrations directory, sees zero local
  against four remote, and reports *"Remote migration versions not found in
  local migrations directory"* — then helpfully suggests
  `supabase migration repair --status reverted <every applied version>`.
  **Do not run that.** It marks applied migrations as un-applied, and the next
  push tries to re-create tables that already exist. The fix is always `cd` to
  the repo root. Happened on 2026-07-29; it also left a stray
  `apps/mobile/supabase/.temp/` linking this directory to the project, which
  had to be deleted so the next command would fail loudly instead of quietly
  repeating the same thing.
- **Never run `expo` or `eas` from the repo root — `cd apps/mobile` first.**
  Neither finds a config up there, so both invent one instead of failing:
  `expo` drops a stray root `tsconfig.json`, and `eas` writes a root `app.json`
  **and registers a brand-new empty EAS project against it**. After that every
  `eas` command run from the root silently targets the wrong project — no env
  vars, no credentials — and the errors point nowhere near the cause. Happened
  on 2026-07-29 with `eas device:create`; the stray `app.json` and the orphan
  project both had to be deleted by hand.
- Verify with `npm run typecheck` and then, from `apps/mobile`,
  `npx expo export --platform ios --platform android`. That export is the only
  proof the module graph actually resolves.
