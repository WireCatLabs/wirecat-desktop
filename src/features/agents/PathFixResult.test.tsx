import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PathFix } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { PathFixButton, PathFixResult } from "./PathFixResult"
import { usePathFix } from "./path-fix"

const LINE = 'export PATH="$HOME/.local/bin:$PATH"'

const result = (over: Partial<PathFix> = {}): PathFix => ({
  added: ["~/.local/bin"],
  unreachable: ["zm"],
  file: "~/.zshrc",
  manual: LINE,
  restart: true,
  shells: [
    { name: "zsh", program: "/usr/bin/zsh", files: ["~/.zshrc"], finds: false, primary: true },
    { name: "bash", program: "/usr/bin/bash", files: ["~/.bashrc"], finds: true, primary: false },
  ],
  ...over,
})

const reached = (file: string): PathFix => ({ ...result({ file, unreachable: [], manual: null }), shells: [] })

function renderFix() {
  const user = userEvent.setup()
  render(
    <>
      <PathFixButton tools={["zm"]} />
      <PathFixResult agent="Claude Code" manual={null} />
    </>,
  )
  return user
}

const picker = () => screen.queryByRole("group", { name: "Which shell does your terminal run?" })

describe("PathFixResult", () => {
  beforeEach(() => {
    vi.spyOn(platform, "terminalReach").mockResolvedValue({ zm: false })
    vi.spyOn(platform, "terminalShells").mockResolvedValue({
      shells: ["/bin/sh", "/usr/bin/bash", "/usr/bin/zsh"],
      current: "/usr/bin/zsh",
      chosen: null,
    })
  })

  it("asks for no shell when a new terminal finds the tools after Fix", async () => {
    vi.spyOn(platform, "fixTerminalPath").mockResolvedValue(reached("~/.zshrc"))
    const user = renderFix()
    await user.click(screen.getByRole("button", { name: "Fix" }))
    expect(await screen.findByText(/Added ~\/\.local\/bin to PATH in ~\/\.zshrc/)).toBeInTheDocument()
    expect(picker()).toBeNull()
  })

  it("asks which shell the terminal runs only after the check fails, and checks again with that one", async () => {
    vi.spyOn(platform, "fixTerminalPath").mockResolvedValue(result())
    const use = vi.spyOn(platform, "useTerminalShell").mockResolvedValue(reached("~/.bashrc"))
    const user = renderFix()
    expect(picker()).toBeNull()
    await user.click(screen.getByRole("button", { name: "Fix" }))
    expect(await screen.findByText("A new terminal still does not find Zoom.")).toBeInTheDocument()
    const shells = screen.getByRole("list", { name: "Shells WireCat checked" })
    expect(shells).toHaveTextContent(/zsh · your terminal · does not find them~\/\.zshrc/)
    expect(shells).toHaveTextContent(/bash · finds them~\/\.bashrc/)
    expect(picker()).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^sh / })).toBeNull()

    await user.click(await screen.findByRole("button", { name: "bash (/usr/bin/bash)" }))
    expect(use).toHaveBeenCalledWith("/usr/bin/bash", ["zm"])
    expect(await screen.findByText(/Added ~\/\.local\/bin to PATH in ~\/\.bashrc/)).toBeInTheDocument()
  })

  it("gives the line, its file and how to try it when the chosen shell still misses the tools", async () => {
    vi.spyOn(platform, "fixTerminalPath").mockResolvedValue(result())
    vi.spyOn(platform, "useTerminalShell").mockResolvedValue(result({ file: "~/.bashrc" }))
    const user = renderFix()
    await user.click(screen.getByRole("button", { name: "Fix" }))
    await user.click(await screen.findByRole("button", { name: "bash (/usr/bin/bash)" }))
    expect(await screen.findByText("A new bash terminal still does not find Zoom.")).toBeInTheDocument()
    expect(screen.getByText("Add this line at the end of ~/.bashrc:")).toBeInTheDocument()
    expect(screen.getByText(LINE)).toBeInTheDocument()
    expect(screen.getByText("zm --version")).toBeInTheDocument()
    expect(screen.getByText(/sets PATH again/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Fix/, expanded: false })).toBeInTheDocument()
  })

  it("lets the owner skip the question and add the line themselves", async () => {
    vi.spyOn(platform, "fixTerminalPath").mockResolvedValue(result())
    const user = renderFix()
    await user.click(screen.getByRole("button", { name: "Fix" }))
    await user.click(await screen.findByRole("button", { name: "I will add the line myself" }))
    expect(await screen.findByText("Add this line at the end of ~/.zshrc:")).toBeInTheDocument()
  })

  it("never asks for a shell on Windows", async () => {
    usePathFix.setState({ windows: true })
    const shells = vi.spyOn(platform, "terminalShells")
    vi.spyOn(platform, "fixTerminalPath").mockResolvedValue(
      result({
        shells: [],
        file: "HKEY_CURRENT_USER\\Environment\\Path",
        manual: "C:\\Users\\u\\AppData\\Roaming\\npm",
      }),
    )
    const user = renderFix()
    await user.click(screen.getByRole("button", { name: "Fix" }))
    expect(await screen.findByText(/Add this folder to Path/)).toBeInTheDocument()
    expect(picker()).toBeNull()
    expect(shells).not.toHaveBeenCalled()
  })
})
