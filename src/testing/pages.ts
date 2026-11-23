/**
 * Imports every page chunk. The first `render(<App />)` in a test file otherwise loads them inside the test, about a
 * second here and over `asyncUtilTimeout` on a busy CI runner (issue #465); `beforeAll(loadPages)` has its own limit.
 */
export const loadPages = () =>
  Promise.all(Object.values(import.meta.glob("/src/features/*/page.{ts,tsx}")).map((load) => load()))
