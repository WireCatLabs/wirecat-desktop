import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { storageMessages } from "@/features/storage/messages"
import { ownReviewMessages } from "@/features/tools/messages-own-review"
import { syncScheduleMessages } from "@/features/tools/messages-sync-schedule"
import { LANGS, type Messages, plural, pluralRu, systemLang } from "."

const modules = import.meta.glob<Record<string, Messages<unknown>>>("/src/**/messages*.{ts,tsx}", { eager: true })
const ROOT = join(__dirname, "../..")

/** Words Spanish writes as English does, where Russian does not: a Spanish copy of them is not English left over. */
const SAME_IN_SPANISH = new Set([
  ...["Audio", "App", "Bot", "Bots", "bot", "chat", "Chats", "Lead", "Mentor", "Personal", "personal", "Sticker"],
  ...["Terminal", "Token", "Total", "Google Drive", "Google Calendar", "Yandex", "Beeline Cloud PBX"],
])

/** The object literal that starts at `from`, up to its own closing brace: `${…}` inside it nests. */
function formsAt(text: string, from: number) {
  let depth = 1
  let i = from
  for (; i < text.length && depth > 0; i++) depth += text[i] === "{" ? 1 : text[i] === "}" ? -1 : 0
  return text.slice(from, i - 1)
}

const catalogs = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod).map(([name, messages]) => ({ where: `${file} ${name}`, messages })),
)

/** Every key with its kind: a string, or a function and how many slots it takes. */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [`${path}: string`]
  if (typeof value === "function") return [`${path}: (${value.length})`]
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
  return [`${path}: ${typeof value}`]
}

function leaves(value: unknown, path = ""): [string, unknown][] {
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return [[path, value]]
}

describe("message catalogs", () => {
  it("are found", () => {
    expect(catalogs.length).toBeGreaterThan(2)
  })

  it.each(catalogs)("$where has every key in every language", ({ messages }) => {
    const english = shape(messages.en)
    for (const lang of LANGS) expect(shape(messages[lang])).toEqual(english)
  })

  it.each(catalogs)("$where has Russian written in Cyrillic, not English left over", ({ messages }) => {
    const english = new Map(leaves(messages.en))
    const leftover = leaves(messages.ru).filter(
      ([key, v]) => !/[а-яё]/i.test(String(v)) && String(v) !== String(english.get(key)),
    )
    expect(leftover.map(([key]) => key)).toEqual([])
  })

  it.each(catalogs)("$where has Spanish written for Spanish, not English left over", ({ messages }) => {
    const english = new Map(leaves(messages.en))
    const russian = new Map(leaves(messages.ru))
    // Where Russian has words of its own, a Spanish leaf equal to the English one was not translated.
    const leftover = leaves(messages.es).filter(
      ([key, v]) =>
        typeof v === "string" && v === english.get(key) && russian.get(key) !== v && !SAME_IN_SPANISH.has(v),
    )
    expect(leftover.map(([key]) => key)).toEqual([])
  })

  it("gives every Russian count its one and few forms", () => {
    const calls = Object.keys(modules).flatMap((file) => {
      const text = readFileSync(join(ROOT, file), "utf8")
      return [...text.matchAll(/plural\("ru",[^{)]*\{/g)].map((m) => [
        file,
        formsAt(text, (m.index ?? 0) + m[0].length),
      ])
    })
    expect(calls.length).toBeGreaterThan(20)
    expect(calls.filter(([, forms]) => !/\bone:/.test(forms ?? "") || !/\bfew:/.test(forms ?? ""))).toEqual([])
  })

  it("writes Russian counts in all three forms through pluralRu", () => {
    const versions = ["# версия", "# версии", "# версий"] as const
    expect([1, 3, 5, 21, 1.5].map((n) => pluralRu(n, versions))).toEqual([
      "1 версия",
      "3 версии",
      "5 версий",
      "21 версия",
      "1,5 версии",
    ])
  })

  it("counts in Russian where a bare number used to stand", () => {
    const signals = ownReviewMessages.ru.signals
    expect(signals.fewVersions(5)[0]).toBe("В npm только 5 версий")
    expect(signals.newPackage(5)[0]).toBe("Впервые опубликован в npm 5 дней назад")
    expect(syncScheduleMessages.ru.failingSince("вчера", 2)).toContain("2 раза подряд")
  })

  it("names the Settings page by its name", () => {
    expect(storageMessages.en.entry.config).toContain("the Settings page")
  })

  it("counts in each language's own plural forms", () => {
    const runs = { one: "# запуск", few: "# запуска", many: "# запусков", other: "# запуска" }
    expect([1, 3, 5, 21, 1.5].map((n) => plural("ru", n, runs))).toEqual([
      "1 запуск",
      "3 запуска",
      "5 запусков",
      "21 запуск",
      "1,5 запуска",
    ])
    expect(plural("es", 1_000_000, { one: "# mensaje", many: "# de mensajes", other: "# mensajes" })).toBe(
      "1.000.000 de mensajes",
    )
    expect(plural("en", 2, { one: "# run", other: "# runs" })).toBe("2 runs")
  })

  it("follows the system language when it is Russian or Spanish, else English", () => {
    expect(systemLang(["ru-RU", "en-US"])).toBe("ru")
    expect(systemLang(["es-MX"])).toBe("es")
    expect(systemLang(["de-DE", "es-ES"])).toBe("es")
    expect(systemLang(["en-GB", "ru"])).toBe("en")
    expect(systemLang([])).toBe("en")
  })
})
