/**
 * A subscribable value, shared across every screen that reads it.
 *
 * This exists because a module-level `let` is only half of a shared cache. The
 * status cache started as one, and every screen wrapped it in its own
 * `useState(cached)` — so `refresh()` on Settings updated the module variable
 * and Settings' copy, and the already-mounted Proof screen never heard about it.
 * Toggling "track weight" appeared to do nothing for exactly that reason.
 *
 * The missing half is notification. `set` tells everyone, so there is one value
 * and one answer to "what is on screen right now".
 *
 * Module-level rather than a context, deliberately: it has to survive a screen
 * unmounting, which is precisely what happens every time a native sheet is
 * dismissed. A provider high enough to avoid that would have to sit above the
 * navigator, and the sheets are siblings of the tabs, not children.
 *
 * Read it with React's own `useSyncExternalStore`. `get` returns the same
 * reference until `set` is called, which is the contract that hook requires —
 * returning a fresh object each call renders forever.
 */
export type Store<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return;
      value = next;
      // Copied before iterating: a listener that unsubscribes during its own
      // notification would otherwise mutate the set mid-loop.
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
