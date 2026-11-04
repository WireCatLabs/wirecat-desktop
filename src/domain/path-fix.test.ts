import { describe, expect, it } from "vitest"
import { type PathFix, pathFixPhase, pathFixProblem, shellOptions } from "./path-fix"

const fix = (over: Partial<PathFix> = {}): PathFix => ({
  unreachable: ["zm"],
  file: "~/.zshrc",
  manual: 'export PATH="$HOME/.local/bin:$PATH"',
  shells: [
    { name: "zsh", program: "/usr/bin/zsh", files: ["~/.zshrc"], finds: false, primary: true },
    { name: "bash", program: "/usr/bin/bash", files: ["~/.bashrc"], finds: true, primary: false },
  ],
  ...over,
})

describe("pathFixPhase", () => {
  it("asks for the shell once a check fails, then gives the line", () => {
    expect(pathFixPhase(fix({ unreachable: [] }), null, false)).toBe("reached")
    expect(pathFixPhase(fix(), null, false)).toBe("pick")
    expect(pathFixPhase(fix(), "/usr/bin/fish", false)).toBe("hand")
    expect(pathFixPhase(fix(), "hand", false)).toBe("hand")
  })

  it("never asks for a shell on Windows", () => {
    expect(pathFixPhase(fix({ shells: [] }), null, true)).toBe("hand")
  })
})

describe("shellOptions", () => {
  it("leaves out plain sh unless it is the only one", () => {
    expect(shellOptions(["/bin/sh", "/usr/bin/bash", "/usr/bin/zsh"])).toEqual(["/usr/bin/bash", "/usr/bin/zsh"])
    expect(shellOptions(["/bin/sh"])).toEqual(["/bin/sh"])
  })
})

describe("pathFixProblem", () => {
  it("names each file, what each shell found, and the line to add", () => {
    const p = pathFixProblem(fix(), ["zm"])
    expect(p.error).toContain("does not find: zm")
    expect(p.error).toContain("/usr/bin/zsh, the terminal's shell: ~/.zshrc; a new terminal does not find them")
    expect(p.error).toContain("/usr/bin/bash: ~/.bashrc; a new terminal finds them")
    expect(p.hint).toBe('Add this line to ~/.zshrc: export PATH="$HOME/.local/bin:$PATH"')
  })
})
