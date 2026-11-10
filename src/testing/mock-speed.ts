let atOnce = false

/** Makes every mock answer come at once for the rest of the test; `setup.ts` turns it off after each test. */
export const answerAtOnce = (on = true) => {
  atOnce = on
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, atOnce ? 0 : ms))
