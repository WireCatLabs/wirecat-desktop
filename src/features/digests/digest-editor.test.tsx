import { describe, expect, it } from "vitest"
import { briefKindOf, briefTemplate } from "./brief-template"
import { draftOf } from "./CreateDigest"
import { bookMessages } from "./messages-book"
import { sourceOptions } from "./ScheduleCard"

const names = bookMessages.en.sources

describe("the digest's sources", () => {
  it("offers the sources whose tools are installed, tasks always, and keeps one already picked", () => {
    const installs = { tg: [{}], zm: [{}], email: [] }
    expect(sourceOptions(installs, ["whatsapp"], names, false).map((o) => o.value)).toEqual([
      "telegram",
      "meetings",
      "tasks",
      "whatsapp",
    ])
  })

  it("offers Drive, Calendar and a CRM only from the memo that reads them, and keeps one already picked", () => {
    const installs = { drive: [{}], gcal: [{}], bitrix: [{}] }
    const values = (more: boolean, picked: string[] = []) =>
      sourceOptions(installs, picked, names, more).map((o) => o.value)
    expect(values(false)).toEqual(["tasks"])
    expect(values(true)).toEqual(["tasks", "drive", "calendar", "crm"])
    expect(values(false, ["crm"])).toEqual(["tasks", "crm"])
    expect(sourceOptions(installs, [], names, true).find((o) => o.value === "crm")?.terms).toContain("Bitrix24")
  })

  it("finds a source by the tool behind it", () => {
    const meetings = sourceOptions({ zm: [{}] }, [], names, false).find((o) => o.value === "meetings")
    expect(meetings?.terms).toContain("Zoom")
  })
})

describe("what a digest collects", () => {
  it("starts a new digest from its kind's template", () => {
    expect(draftOf("daily", [], bookMessages.en, "en").brief).toBe(briefTemplate("daily-digest", "en"))
    expect(draftOf("weekly", [], bookMessages.ru, "ru").brief).toContain("Неделя на одной странице")
    expect(draftOf("own", [], bookMessages.en, "en").brief).toBe(briefTemplate("digest", "en"))
  })

  it("reads the kind back from the name the starter gave", () => {
    expect(briefKindOf("morning-digest")).toBe("daily")
    expect(briefKindOf("daily-digest-2")).toBe("daily")
    expect(briefKindOf("weekly-digest")).toBe("weekly")
    expect(briefKindOf("digest-3")).toBe("own")
  })

  it("writes Russian templates without ё, long dashes or semicolons", () => {
    for (const kind of ["daily", "weekly", "own"] as const) {
      expect(briefTemplate(kind === "own" ? "digest" : `${kind}-digest`, "ru")).not.toMatch(/[ё—;]/)
    }
  })
})
