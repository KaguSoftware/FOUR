import Constants from "expo-constants";

/**
 * The Google Sign-In native module, loaded lazily — or `null` in Expo Go.
 *
 * `@react-native-google-signin/google-signin` calls
 * `TurboModuleRegistry.getEnforcing("RNGoogleSignin")` the moment its JS is
 * first executed, and that module is not compiled into Expo Go's binary. A
 * static `import` therefore crashes the whole app at bundle-eval time before
 * a single screen renders — which is exactly what happened when the app was
 * opened in Expo Go on 2026-08-03.
 *
 * Metro still bundles the package (a `require` call is followed statically),
 * but its module body only RUNS on the first call, so gating the call is
 * enough. In Expo Go (`executionEnvironment === "storeClient"`) we never make
 * it: Google sign-in falls back to the browser round trip in `oauth.ts`, and
 * the sign-in screen renders its own quiet button instead of Google's.
 *
 * This does NOT walk back the 2026-07-31 "full native, dev build required"
 * decision — a dev build is still the real test vehicle, and Credential
 * Manager still needs one. It only stops the missing module from taking the
 * whole app down with it when someone opens Expo Go anyway.
 */
type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let mod: GoogleSigninModule | null | undefined;

export function googleSignin(): GoogleSigninModule | null {
  if (mod !== undefined) return mod;
  if (Constants.executionEnvironment === "storeClient") {
    mod = null;
  } else {
    try {
      mod = require("@react-native-google-signin/google-signin");
    } catch {
      // A binary that predates the module (an old dev build) throws the
      // same getEnforcing error; degrade the same way Expo Go does.
      mod = null;
    }
  }
  return mod ?? null;
}
