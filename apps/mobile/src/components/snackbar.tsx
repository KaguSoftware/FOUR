import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Body, Label } from "./ui";
import { ripple } from "@/lib/press";
import { useReduceMotion } from "@/lib/reduce-motion";
import { color, radius, space, TAB_BAR, TAP } from "@/theme";

/**
 * The Android answer to "that didn't save".
 *
 * A dozen failures in this app were reported with `Alert.alert` — "Didn't
 * save", "Couldn't export", "That change didn't reach the server". On iOS a
 * modal alert is the right instrument for that: it is what the platform uses
 * for a message with one thing to say. On Android it is not. A modal dialog
 * there means *a decision is required*, and using one to say "the network
 * blinked" stops the app dead, dims the screen, and demands a tap to
 * acknowledge something the user cannot act on anyway. The Material answer is
 * a Snackbar: it appears at the bottom, states the fact, offers at most one
 * action, and leaves on its own.
 *
 * So this exists, and `notify()` routes to it on Android while iOS keeps the
 * Alert it already shipped. **Confirmations are NOT routed here** — archiving
 * a lever, signing out, deleting an account still raise a real dialog on both
 * platforms, because those genuinely require a decision and must block. See
 * `notify` below for the line.
 *
 * Hand-built rather than `react-native-paper`: the palette, the type ramp and
 * the motion vocabulary already exist here, and Paper would import a second,
 * disagreeing design system to draw one rectangle.
 */

/** How long a message stays. Material's default for a message with no action. */
const DWELL_MS = 4000;
/** With an action, long enough to read it and reach it. */
const DWELL_ACTION_MS = 6000;

type Message = {
  text: string;
  action?: { label: string; onPress: () => void };
};

type SnackbarApi = {
  show: (message: Message) => void;
};

const SnackbarContext = createContext<SnackbarApi | null>(null);

/**
 * Mounted once at the root, above the navigator, so a snackbar raised from a
 * sheet or a pushed screen is not clipped by it and does not leave with it.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: Message) => {
    if (timer.current) clearTimeout(timer.current);
    // A second failure replaces the first rather than queueing behind it.
    // Queueing would show a stale message after the user has already moved on,
    // and these are all variations of "it didn't reach the server" anyway.
    setMessage(next);
    timer.current = setTimeout(
      () => setMessage(null),
      next.action ? DWELL_ACTION_MS : DWELL_MS,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      <Snackbar message={message} onDismiss={() => setMessage(null)} />
    </SnackbarContext.Provider>
  );
}

/**
 * The bar itself.
 *
 * Sits above the tab bar rather than over it — `TAB_BAR + insets.bottom` is
 * the same allowance every screen's scroll padding uses, and a snackbar
 * covering the navigation is the Material spec's own "don't".
 */
function Snackbar({
  message,
  onDismiss,
}: {
  message: Message | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
  // "Remove animations" on Android, "Reduce Motion" on iOS. Material requires
  // honouring it and PRODUCT.md lists it as owed on both platforms. The
  // message still arrives and still leaves — it just cuts rather than slides.
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const to = message ? 1 : 0;
    shown.value = reduceMotion
      ? to
      : withTiming(to, {
          duration: message ? 180 : 140,
          easing: Easing.out(Easing.cubic),
        });
  }, [message, shown, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    // Rises into place rather than fading in position: the direction is the
    // message's origin, and it matches how the trash target on the dashboard
    // arrives. Flattened under Reduce Motion, where `shown` jumps to 1 and
    // this resolves to no offset at all.
    transform: [{ translateY: (1 - shown.value) * 12 }],
  }));

  // Kept mounted while animating out, then removed so it cannot swallow a tap
  // aimed at whatever is underneath.
  if (!message) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          position: "absolute",
          left: space[4],
          right: space[4],
          bottom: insets.bottom + TAB_BAR + space[2],
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          minHeight: TAP,
          paddingLeft: space[4],
          paddingRight: message.action ? space[2] : space[4],
          paddingVertical: space[3],
          borderRadius: radius.md,
          borderWidth: 1,
          // The same bordered-surface treatment `states.tsx` uses for a fault.
          // Emphasis by containment, never by hue — `down` and `degraded`
          // belong to the state of the user's system, not to the app failing
          // to reach a database. See that file's docblock.
          borderColor: color.lineHi,
          // `surface-hi`, not `surface`: this floats over screens that are
          // themselves `bg` and often hold `surface` panels, so it needs to be
          // one tonal step ABOVE anything it can land on. Material would get
          // that separation from elevation — a drop shadow — and DESIGN.md
          // forbids shadows outright ("flat by absolute rule; depth by tonal
          // step only"). The step and the `line-hi` border do the same job,
          // which is exactly how `states.tsx` separates a fault panel.
          //
          // This is the line between the two layers: a snackbar's POSITION,
          // its dwell, its single action and its dismissal are Material's, and
          // they are what make it a snackbar. Its surface treatment is the
          // product's, and the product does not do shadows.
          backgroundColor: color.surfaceHi,
        },
        animated,
      ]}
    >
      <Body tone="ink" style={{ flex: 1 }}>
        {message.text}
      </Body>
      {message.action && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onDismiss();
            message.action?.onPress();
          }}
          android_ripple={ripple("line")}
          style={{
            minHeight: TAP,
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            justifyContent: "center",
          }}
        >
          <Label style={{ color: color.ink }}>{message.action.label}</Label>
        </Pressable>
      )}
    </Animated.View>
  );
}

/**
 * The hook screens call.
 *
 * Returns a `notify` that is a snackbar on Android and `Alert.alert` on iOS,
 * so a call site says what happened once and does not branch.
 *
 * **Use it for statements. Not for questions.** If the user has to choose
 * something, or if the thing being reported is destructive, raise
 * `Alert.alert` directly on both platforms — a snackbar can be missed, and a
 * message that can be missed must not be the only warning before something is
 * lost.
 */
export function useNotify() {
  const api = useContext(SnackbarContext);

  return useCallback(
    (text: string, detail?: string | null, action?: Message["action"]) => {
      if (Platform.OS === "android" && api) {
        // Android gets one line. A snackbar is not a place for two sentences,
        // and the detail is almost always the same "…didn't reach the server"
        // elaboration of the title.
        api.show({ text: detail ? `${text} — ${detail}` : text, action });
        return;
      }
      Alert.alert(text, detail ?? undefined);
    },
    [api],
  );
}
