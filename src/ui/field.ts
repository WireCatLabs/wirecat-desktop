/**
 * How a bordered text field shows focus: its own border turns brand. The app's ring sits 2px outside it and would read
 * as a second box, so `inner-field` drops it (index.css).
 */
export const fieldFocus = "inner-field outline-none focus-visible:border-brand"

/** A one-line text field's look, until `ui/` has a Field component. */
export const fieldClass = `h-8 w-full min-w-0 rounded-control border border-line-strong bg-app px-2.5 text-[0.95rem] text-ink placeholder:text-ink-dim disabled:opacity-45 ${fieldFocus}`

/** The larger field of a sign-in or setup step, in mono for addresses, codes and keys. */
export const wideFieldClass =
  "selectable h-10 w-full rounded-control border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"
