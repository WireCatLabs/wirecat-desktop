type Resettable = { getInitialState(): unknown; setState(state: never, replace: true): void }

export const created = new Set<Resettable>()

/** Called by the `zustand` mock in setup.ts for every store the app code creates. */
export const track = <T extends Resettable>(store: T): T => {
  created.add(store)
  return store
}
