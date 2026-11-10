const ids = new Set<string>()

/** `app/sections.tsx` owns the list; pages cannot import `app/`, so it hands the beta ids down here once. */
export function registerBeta(sections: readonly { id: string; beta?: true }[]) {
  ids.clear()
  for (const s of sections) if (s.beta) ids.add(s.id)
}

export const isBeta = (id: string) => ids.has(id)
