import { describe, expect, it } from "vitest"
import { relationParts, roleIdOf, roleLabel, roleListFor, standingOf, standingTone } from "./relationships"

describe("relationships", () => {
  it("knows memo's four standings and nothing else", () => {
    expect(standingOf("reported")).toBe("reported")
    expect(standingOf("rejected")).toBeNull()
    expect(standingOf(null)).toBeNull()
  })

  it("warns only for what waits for the owner", () => {
    expect(standingTone("proposed")).toBe("warn")
    expect(standingTone("confirmed")).toBe("brand")
    expect(standingTone("reported")).toBe("neutral")
    expect(standingTone("ended")).toBe("neutral")
  })

  it("names a built-in role in the app's words and the owner's own role by its label", () => {
    const roles = [
      { list: "organization", id: "employee", label: null, builtIn: true },
      { list: "organization", id: "board-member", label: "Board member", builtIn: false },
    ]
    const words = { employee: "Сотрудник" }
    expect(roleLabel("employee", roles, words)).toBe("Сотрудник")
    expect(roleLabel("board-member", roles, words)).toBe("Board member")
    expect(roleLabel("chief-of-staff", [], words)).toBe("chief of staff")
  })
})

describe("relationParts", () => {
  const link = (subject: string, target: string, role: string | null = "owner") => ({
    kind: "related-to",
    subject,
    subjectName: subject === "document:31" ? "Sales plan" : "Kai",
    target,
    targetName: target === "person:7" ? "Kai" : "Harbour",
    role,
  })

  it("gives the role to the person, whichever end memo stored first", () => {
    const drive = relationParts(link("document:31", "person:7"))
    expect([drive.holder.name, drive.other.kind]).toEqual(["Kai", "document"])
    const member = relationParts(link("person:7", "project:1"))
    expect([member.holder.name, member.other.name, roleListFor(member)]).toEqual(["Kai", "Harbour", "project"])
    expect(roleListFor(drive)).toBeNull()
  })
})

describe("roleIdOf", () => {
  it("makes memo's id from the owner's name for a role", () => {
    expect(roleIdOf("Board member")).toBe("board-member")
    expect(roleIdOf("  Café — owner! ")).toBe("cafe-owner")
    expect(roleIdOf("Совет директоров", 1_000_000)).toBe("own-lfls")
    expect(roleIdOf("3D designer")).toBe("r-3d-designer")
  })
})
