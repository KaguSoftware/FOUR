# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

**And trust the installed type definitions over the docs.** The prose docs and
any summary of them lag the package. Every API below was confirmed by reading
`node_modules/expo-router/**/*.d.ts` after a doc answer turned out to be wrong.

## SDK 57 facts that contradict older knowledge

- **`Stack` is not exported from `expo-router`.** It is `import { Stack } from
  "expo-router/stack"`. It is the *native* stack, so native back buttons,
  native headers and the edge-swipe / predictive-back gesture come free —
  do not re-implement any of them.
- **`Tabs` from `expo-router` is deprecated** in favour of
  `expo-router/js-tabs`. We use neither: the tab bar is
  `NativeTabs` from `expo-router/unstable-native-tabs`, which renders a real
  `UITabBar` (the iOS 26 glass bar, via `minimizeBehavior`) and a real Material 3
  navigation bar.
- **Icons are per-platform by design.** `<NativeTabs.Trigger.Icon sf="…" md="…" />`
  takes an SF Symbol and a Material Symbol. Valid `md` names are the keys of
  `expo-symbols/build/android/symbols.json` (4055 of them) — check before
  guessing.
- **Sheets are navigator-presented, not hand-drawn.** A route with
  `presentation: "formSheet"` + `sheetAllowedDetents: "fitToContents"` is a real
  `UISheetPresentationController`. See `src/app/log.tsx`.
- **`Stack.Protected guard={…}`** removes a branch from the navigation state
  entirely. That is the auth/onboarding gate — there is no redirect flash and no
  deep link that bypasses it.
- **`@expo/ui` components must live inside a `<Host>`.** Their children are
  SwiftUI / Compose views, not RN views; to put RN content back inside one you
  need `RNHostView`. Prefer navigator-presented native chrome over hosting
  SwiftUI by hand.
- Routes live in **`src/app/`**, not `app/`.

## This app's own rules

- **Never `logicalDate()` — always `logicalDateLocal()`.** Hermes delegates
  `Intl` to platform ICU and it varies by Android version. See HANDOFF gotchas.
- **`@uptime/core` is the only place a number is derived.** If you find
  yourself writing date maths or a colour ramp in this app, import it instead.
- **Metro needs no monorepo config** — Expo detects workspaces since SDK 52.
- Verify with `npx tsc --noEmit -p apps/mobile` and then
  `npx expo export --platform ios` / `--platform android`, which is the only
  proof the module graph actually resolves.
