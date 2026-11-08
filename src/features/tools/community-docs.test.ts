import { expect, it } from "vitest"
import { communityToolsDocs } from "./community-docs"

it.each([
  ["en", "https://wirecat.dev/en/docs/desktop#community-tools"],
  ["ru", "https://wirecat.dev/ru/docs/desktop#инструменты-сообщества"],
  ["es", "https://wirecat.dev/es/docs/desktop#herramientas-de-la-comunidad"],
] as const)("opens the %s docs at the community tools heading", (lang, url) => {
  expect(communityToolsDocs(lang)).toBe(url)
})
