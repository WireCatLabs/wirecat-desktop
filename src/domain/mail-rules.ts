/** Who made a mail rule, from mail-cli's `source`; a word WireCat does not know is shown as mail-cli wrote it. */
export type RuleMaker = { by: "you" | "preset" | "agent" | "gmail" } | { by: "other"; source: string }

export function ruleMaker(source: string | null): RuleMaker {
  // `rules add` records a source only with --kind, so a rule without one was added by hand.
  if (source === null || source === "owner") return { by: "you" }
  if (source.startsWith("preset:")) return { by: "preset" }
  if (source === "probe" || source === "agent") return { by: "agent" }
  if (source === "gmail-filter") return { by: "gmail" }
  return { by: "other", source }
}

/** One condition's words, by mail-cli's key; `value` is the CLI's value as text. */
export type ConditionWords = Record<string, (value: string) => string>

/** What a rule matches, in words: every condition must hold, so they are joined as one phrase. */
export function matchWords(
  conditions: readonly { key: string; value: string }[],
  words: ConditionWords,
  join: (parts: string[]) => string,
): string {
  return join(conditions.map(({ key, value }) => words[key]?.(value) ?? `${key.replace(/_/g, " ")} ${value}`))
}
