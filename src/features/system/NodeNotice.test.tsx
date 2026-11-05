import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { NodeEvent } from "@/platform/schemas"
import { ComputerFacts } from "./ComputerFacts"
import { NodeNotice } from "./NodeNotice"
import { useNode } from "./node-store"
import { useSystem } from "./store"

const absent = { path: null, version: null, ok: false, problem: "not found" }

beforeEach(() => {
  vi.spyOn(platform, "nodeOffer").mockResolvedValue({ version: "24.19.0", bytes: null, dir: "~/.local/share/wirecat" })
  useSystem.setState({
    readiness: {
      os: "Linux",
      arch: "x86_64",
      node: absent,
      npm: absent,
      pnpm: absent,
      npmPrefix: null,
      npmPrefixWritable: null,
      managed: null,
    },
  })
})

afterEach(() => vi.restoreAllMocks())

describe("a computer without Node.js, in Russian", () => {
  it("asks for Node.js and says what is missing in the readiness strip", async () => {
    useLanguage.setState({ choice: "ru" })
    render(
      <>
        <ComputerFacts />
        <NodeNotice />
      </>,
    )
    expect(screen.getByText("Для установки инструментов WireCat нужен Node.js")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Установить Node.js за меня" })).toBeInTheDocument()
    expect(
      await screen.findByText(/с nodejs\.org, сверяется с опубликованными контрольными суммами/),
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Ваш компьютер" })).toHaveTextContent("Node.js не найден")
  })
})

describe("setting Node.js up", () => {
  it("shows how far through the archive unpacking is, then the PATH step's two parts", async () => {
    let send: (e: NodeEvent) => void = () => {}
    vi.spyOn(platform, "setupNode").mockImplementation(async (onEvent) => {
      send = onEvent
      await new Promise(() => {})
    })
    render(<NodeNotice />)
    act(() => {
      void useNode.getState().setup()
    })
    act(() => {
      send({ event: "step", step: "unpack" })
      send({ event: "progress", received: 15, total: 30 })
    })
    const bar = screen.getByRole("progressbar", { name: "Unpacking Node.js" })
    expect(bar).toHaveAttribute("aria-valuenow", "50")
    expect(screen.getByText("50% of the archive")).toBeInTheDocument()

    act(() => send({ event: "step", step: "path" }))
    const path = screen.getByRole("progressbar", { name: "Add to PATH" })
    expect(path).toHaveAttribute("aria-valuetext", "Step 1 of 2")
    expect(Number(path.getAttribute("aria-valuenow"))).toBeLessThan(50)
    expect(screen.getByText(/Adding Node.js to your PATH/)).toBeInTheDocument()

    const pathFix = { added: ["~/x/bin"], unreachable: [], file: "~/.zshrc", manual: null, restart: true, shells: [] }
    act(() => send({ event: "done", version: "24.11.0", path: "~/x", pathFix }))
    expect(screen.getByRole("progressbar", { name: "Add to PATH" })).toHaveAttribute("aria-valuetext", "Step 2 of 2")
    expect(screen.getByText("Added to ~/.zshrc. Checking Node.js and npm again…")).toBeInTheDocument()
  })
})
