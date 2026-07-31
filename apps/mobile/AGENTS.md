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
2026-07-28 so it can run on real hardware today. Being able to open it on a
phone beats a newer API.

**Do not bump the SDK without checking what Expo Go the owner has.** If you do
bump it, the notes below all need re-verifying — several of these APIs moved
between 54 and 57.

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
