import { describe, expect, it } from "vitest"
import { toolsMessages } from "@/features/tools/messages"
import { toolText } from "@/features/tools/tool-text"
import { OFFICIAL } from "@/platform/mock-community"
import { addCommunityTools, findTool, isCommunity, replaceAddedTools, screenOf, tools } from "./catalog"

describe("official tools from the signed list", () => {
  it("adds a tool the app does not have, with every key it leaves out as null", () => {
    const before = tools.length
    expect(addCommunityTools([{ source: "official", entry: OFFICIAL }])).toEqual([])
    const beeline = findTool("beeline")
    expect(tools).toHaveLength(before + 1)
    expect(beeline?.source).toBe("official")
    expect(beeline && isCommunity(beeline)).toBe(false)
    expect(beeline?.tasks).toBeNull()
    expect(replaceAddedTools([{ source: "official", entry: OFFICIAL }])).toEqual([])
    expect(tools).toHaveLength(before + 1)
  })

  it("puts the list's words first, then the app's, then the site's summary, then English", () => {
    const beeline = findTool("beeline")
    if (!beeline) throw new Error("beeline was not added")
    const ru = toolText(toolsMessages.ru, beeline, "ru")
    expect(ru.tagline).toBe("Звонки Билайна, расшифрованные на вашем компьютере")
    expect(ru.summary).toMatch(/^Записи звонков Билайна/)
    expect(toolText(toolsMessages.es, beeline, "es").summary).toBe(OFFICIAL.summary)
    expect(toolText(toolsMessages.en, beeline, "en").tagline).toBe(OFFICIAL.tagline)
  })

  it("gives a built-in tool only the list's texts, icon and sign-in screen", () => {
    const doctor = findTool("linear")?.doctor
    const entry = { id: "linear", i18n: { ru: { tagline: "Из реестра" } }, icon: "M0 0h24v24H0z", screen: "pbx" }
    expect(addCommunityTools([{ source: "official", entry }])).toEqual([])
    const linear = findTool("linear")
    expect(linear?.doctor).toEqual(doctor)
    expect(linear && toolText(toolsMessages.ru, linear, "ru").tagline).toBe("Из реестра")
    expect(screenOf("linear")).toBe("pbx")
    expect(screenOf("tg")).toBe("tg")
  })

  it("leaves out an icon that could load something, and a tool of another scope", () => {
    const rejected = addCommunityTools([
      { source: "official", entry: { id: "linear", icon: '<image href="x"/>' } },
      { source: "official", entry: { ...OFFICIAL, id: "other", package: "@example/other" } },
    ]).map((r) => r.text)
    expect(rejected).toHaveLength(2)
    expect(findTool("other")).toBeUndefined()
  })
})
