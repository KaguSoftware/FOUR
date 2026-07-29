/**
 * Clamp a user-supplied redirect target to a same-origin path.
 *
 * `next` rides through the login URL and the magic-link email, so by the time
 * it comes back it is attacker-controllable: `?next=https://evil.com`, the
 * protocol-relative `//evil.com`, or the sneakier `@evil.com` — which parses as
 * `credentials@host` once concatenated onto the origin. Anything that is not a
 * plain absolute path collapses to "/". Backslash is rejected because browsers
 * normalise it to "/" before parsing, which re-opens the `//` form.
 */
export function safePath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}
