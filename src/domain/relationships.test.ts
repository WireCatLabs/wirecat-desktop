import { describe, expect, it } from "vitest"
import { roleLabel, standingOf, standingTone } from "./relationships"

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
