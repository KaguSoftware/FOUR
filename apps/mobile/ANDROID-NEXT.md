# Android: what is left, and why it was not done blind

Written 2026-08-02, after a sweep that shipped five fixes (see git log for
`fix(android):`). Everything below is either **not verifiable without a
device** or **would move iOS**, which is the one thing the Android pass is not
allowed to do. Ordered by impact.

There is no Android SDK, emulator or `adb` on the machine this was written on,
so nothing here has been seen. `npm run shoot` drives the **web** app, not this
one — it shares the palette and none of the natives. To look at any of it:

```
cd apps/mobile
npx eas-cli@latest build --profile development --platform android
npm run android
```

---

## 1. The keyboard almost certainly covers the field on Android 15+

**Eight screens** pass `behavior={Platform.OS === "ios" ? "padding" : undefined}`
to `KeyboardAvoidingView` — sign-in, email-otp, change-email, change-password,
delete-account, edit-note, proof, onboarding — and rely on
`softwareKeyboardLayoutMode: "resize"` in `app.json` to do the Android half.
That becomes `android:windowSoftInputMode="adjustResize"`
(`@expo/config-plugins/build/android/WindowSoftInputMode.js`).

**On API 35+ with edge-to-edge enforced, `adjustResize` no longer resizes the
window.** The app is expected to consume IME insets itself. `app.json` sets
`edgeToEdgeEnabled: true`, so this app is squarely in that case.

Worst affected are the two sheets that `autoFocus`: `edit-note` (the field AND
its save button) and `log`'s "something else" branch. A sheet that opens with
the keyboard up and its only button underneath the keyboard is unusable, not
ugly.

**Why not fixed blind:** three viable answers with different costs —
`react-native-keyboard-controller` (a new native dep, needs a build),
`behavior="height"` on Android, or consuming `useSafeAreaInsets`/IME insets by
hand. Picking one without seeing the failure is guessing, and two of the three
touch every one of the eight screens.

**Decision needed:** which approach, and whether the sheets get a different
answer from the full-screen forms.

## 2. The pull-to-refresh spinner may sit behind the scrim

`Screen` paints an opaque `insets.top`-tall scrim over the top of the
ScrollView (`screen.tsx`, the `!underHeader` block). Android's
`SwipeRefreshLayout` animates its circular indicator from the top of the scroll
view's own frame, independent of `contentContainerStyle` padding — so the pull
travel happens behind that scrim. The resting position (~64dp) is probably
below it; the pull is probably not.

`RefreshControl` has `progressViewOffset`, which would fix it — **but it is in
the shared `RefreshControlProps`, not `RefreshControlPropsAndroid`, and RN
forwards it to `PullToRefreshViewNativeComponent` on iOS too** (verified in
`RefreshControl.js`: iOS strips only `enabled`, `colors`,
`progressBackgroundColor`, `size`). So setting it moves the iOS spinner.

**Decision needed:** whether this is worth a `Platform.select`, or whether the
iOS spinner is mispositioned by the same scrim and both should move together.
Only one screen has a `RefreshControl` (Home).

## 3. The tab bar's ripple is still a platform default

`rippleColor` on `NativeTabs` is unset, so react-native-screens falls back to
`?attr/itemRippleColor` resolved from a **Material** theme
(`TabsHostAppearanceApplicator.kt`) — while this app's `AppTheme` is AppCompat,
not Material 3. That is the exact shape of the `indicatorColor` defect already
recorded in `AGENTS.md`: a default picked for a light surface, landing on this
palette.

**Why not fixed blind:** the applicator does
`ColorStateList.valueOf(rippleColor)` with no alpha, and Material's own
`itemRippleColor` values carry alpha (typically 12%). An opaque `ink-mute`
there may read very differently from the same token used via `android_ripple`.
Wants one look on a device.

## 4. The ripple sweep itself is measured but unseen

`fix(android): every ripple in the app was invisible` changed all twenty-eight
ripples from ~1.2:1 tones to one `ink-mute` neutral at 3.02–5.48:1. The
measurements are enforced in `check:contrast`, but a contrast ratio is a proxy
for a translucent radial wash — the honest reading is "this is now
definitely visible", not "this is now correctly weighted".

**Worth doing first when a build is up**, since it touches every control in the
app and is the cheapest thing to judge: press anything.

## 5. Smaller, and cross-platform rather than Android-only

- **`Scale` on Proof announces as buttons, not radios.** It uses
  `accessibilityRole="button"` + `accessibilityState={{ selected }}`;
  `Segmented`, which was derived from it, uses `radiogroup`/`radio`. TalkBack
  and VoiceOver both describe these differently. Same control, two answers —
  the same drift that left `Scale` without a ripple until today.
- **`change-email.tsx` has `autoComplete` but no `textContentType`.** That is
  the *iOS* autofill half missing; every other field in the app sets both.
- **The dialog theme has not been re-verified since the palette was last
  touched.** `plugins/with-android-dialog-theme.js` is a third copy of the
  palette hexes and `check:contrast` cannot see it. The hexes were confirmed
  correct on 2026-08-02 by hand, but the dialog itself only exists in a real
  build.

---

## Checked during this sweep and deliberately NOT changed

Recorded so the next pass does not spend the time again.

- **Dashed borders render dashed on Android.** RN 0.81's `BorderDrawable.kt`
  calls `updatePathEffect()` before `drawRoundedBorders()`, so `DashPathEffect`
  applies with a border radius. The old "dashed silently renders solid"
  limitation is gone. Affects the add-a-lever button, the trash target and
  "something else".
- **A disabled `Pressable` does not ripple.** `Pressability` returns `false`
  from `onStartShouldSetResponder` when disabled, so `onPressIn` — and with it
  `android_rippleConfig.onPressIn` — never fires. The `off ? undefined :
  ripple()` guards through the codebase are defensive, not load-bearing, and
  the takeover's unguarded calls are fine.
- **`Alert` button order is correct on Android.** RN's `Alert.js` does
  `validButtons.pop()` into the positive slot, so `[Cancel, Archive]` puts
  Archive on the right — Android's convention. Writing these iOS-first happens
  to come out right on both.
- **Autofill hints are complete on Android.** Every credential field sets
  `autoComplete` alongside `textContentType`.
- **`includeFontPadding: false` is on every text style**, including the
  `heading` constants local to `onboarding.tsx` and `how-it-works.tsx`. The
  remaining bare `<Text>` elements are all nested inside a parent `Text`, where
  Android renders them as spans in one `TextView` and the parent's metrics
  govern.
- **Both multi-step routes handle the hardware Back button** via
  `useAndroidBack` — onboarding and the walkthrough.
- **All four sheets draw a `SheetHandle`** — log, add-lever, edit-note, day.
