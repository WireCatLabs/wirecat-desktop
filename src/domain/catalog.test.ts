import { describe, expect, it } from "vitest"
import {
  doctorCommand,
  findTool,
  isValidProfile,
  ownerId,
  removeCommand,
  runTool,
  samePackage,
  setupCommand,
  syncCommand,
  tools,
} from "./catalog"

describe("catalog", () => {
  it("lists the tools with unique ids, and a binary of their own unless part of another", () => {
    expect(tools.map((t) => t.id)).toEqual([
      "tg",
      "max",
      "wa",
      "zm",
      "drive",
      "gcal",
      "memo",
      "email",
      "bitrix",
      "asterisk",
    ])
    const owners = tools.filter((t) => !t.partOf)
    expect(new Set(owners.map((t) => t.bin)).size).toBe(owners.length)
  })

  it("installs a part through the tool that owns its package", () => {
    expect(ownerId("email")).toBe("email")
    expect(ownerId("tg")).toBe("tg")
    expect(samePackage("email").map((t) => t.id)).toEqual(["email"])
    expect(samePackage("tg").map((t) => t.id)).toEqual(["tg"])
    for (const part of tools.filter((t) => t.partOf)) {
      const owner = findTool(ownerId(part.id))
      expect(owner && !owner.partOf).toBe(true)
      expect([part.bin, part.package]).toEqual([owner?.bin, owner?.package])
    }
  })

  it("files each run under the tool that made it", () => {
    expect(runTool("memo", "mail inspect")).toBe("memo")
    expect(runTool("email", "sync")).toBe("email")
    expect(runTool("tg", "mail x")).toBe("tg")
  })

  it("fills the profile into setup and doctor commands", () => {
    const tg = findTool("tg")
    if (!tg) throw new Error("tg missing")
    expect(setupCommand(tg, "work")).toBe("tg work setup")
    expect(doctorCommand(tg, "work")).toBe("tg work doctor --record --json")
  })

  it("accepts plain profile names only", () => {
    expect(isValidProfile("personal")).toBe(true)
    expect(isValidProfile("--json")).toBe(false)
    expect(isValidProfile("..")).toBe(false)
    expect(isValidProfile(".hidden")).toBe(false)
    expect(isValidProfile("a b")).toBe(false)
    expect(isValidProfile("x;rm")).toBe(false)
  })

  it("removes one copy with the program that installed it", () => {
    const pkg = "@wirecat/zoom-cli"
    expect(removeCommand("pnpm", pkg, "~/.local/share/pnpm/bin/zm")).toBe(`pnpm remove --global ${pkg}`)
    expect(removeCommand("npm", pkg, "~/.nvm/versions/node/v24.19.0/bin/zm")).toBe(
      `nvm exec v24.19.0 npm uninstall --global ${pkg}`,
    )
    expect(removeCommand("npm", pkg, "/usr/local/bin/zm")).toBe(`npm uninstall --global ${pkg}`)
  })

  it("names a sync by the command words its runs record, never a flag's value", () => {
    const words = (id: string) => syncCommand(findTool(id) as NonNullable<ReturnType<typeof findTool>>)
    expect(words("tg")).toBe("messages sync")
    expect(words("zm")).toBe("meetings sync")
    expect(words("memo")).toBe("sync")
  })
})
