import { expect, it } from "vitest"
import { ownToolsDocs } from "./own-tools-docs"

it.each([
  ["en", "https://wirecat.dev/en/docs/desktop#add-your-own-tool"],
  ["ru", "https://wirecat.dev/ru/docs/desktop#добавить-свой-инструмент"],
  ["es", "https://wirecat.dev/es/docs/desktop#añadir-tu-propia-herramienta"],
] as const)("opens the %s docs at the heading on adding your own tool", (lang, url) => {
  expect(ownToolsDocs(lang)).toBe(url)
})
