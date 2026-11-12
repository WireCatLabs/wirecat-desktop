/**
 * A tool's reason as one the page words itself, or null: the page then says its generic sentence, with the tool's own
 * text under Details (`ErrorNotice raw`).
 */
export const knownReason = <R extends string>(known: readonly R[], reason: string): R | null =>
  (known as readonly string[]).includes(reason) ? (reason as R) : null
