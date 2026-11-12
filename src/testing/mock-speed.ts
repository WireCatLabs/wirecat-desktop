let atOnce = true
let pending = 0

/**
 * Every mock answer comes at once in tests. A test of a loading state calls `answerAtOnce(false)` to get the mock's
 * real delays back for the rest of the test; `setup.ts` turns answering at once on again after each test.
 */
export const answerAtOnce = (on = true) => {
  atOnce = on
}

export const delay = (ms: number) => {
  pending++
  return new Promise<void>((r) =>
    setTimeout(
      () => {
        pending--
        r()
      },
      atOnce ? 0 : ms,
    ),
  )
}

/**
 * Lets the mock answers a finished test left running land before the stores are reset; otherwise they land in the
 * next test and overwrite what it set up (BUG-5). Bounded, so a mock that keeps asking cannot hang the suite.
 */
export async function settleMock() {
  for (let round = 0; round < 50 && pending > 0; round++) await new Promise((r) => setTimeout(r, 0))
}
