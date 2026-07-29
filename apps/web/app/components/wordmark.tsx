/**
 * The wordmark. One per screen, never anywhere else.
 *
 * Archivo Black, tightened and set lowercase: heavy enough to read as a label
 * stamped on a panel, plain enough that it never tips into decoration. The
 * page name rides alongside it in the quiet label style, so the hierarchy is
 * "this app / this screen" rather than two competing titles.
 */
export function Wordmark({ page }: { page?: string }) {
  return (
    <h1 className="flex items-baseline gap-2.5">
      <span
        className="text-ink text-lg leading-none lowercase"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.035em",
        }}
      >
        four
      </span>
      {page && <span className="label">{page}</span>}
    </h1>
  );
}
