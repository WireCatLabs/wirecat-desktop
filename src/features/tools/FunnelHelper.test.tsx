import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import type { FunnelHelperStatus, TailscaleStatus } from "@/platform/tailscale-schemas"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor } from "@/testing/render"
import { McpServer } from "./McpServer"

const tg = findTool("tg")
if (!tg) throw new Error("tg is in the catalog")

const OFF: McpServerStatus = {
  available: true,
  running: false,
  listening: false,
  startedHere: false,
  startedAt: null,
  port: null,
  connectorUrl: null,
  loginCode: null,
  outdated: false,
  clients: [],
}

const NO_TAILSCALE: TailscaleStatus = {
  os: "macos",
  installed: false,
  package: "pkg",
  linux: null,
  operator: null,
  user: "alex",
  daemon: false,
  backend: "unknown",
  https: false,
  funnel: false,
  host: null,
  freePorts: [],
}

const helper = (over: Partial<FunnelHelperStatus>): FunnelHelperStatus => ({
  installed: true,
  state: "stopped",
  url: null,
  actionUrl: null,
  error: null,
  ...over,
})

beforeEach(() => {
  vi.spyOn(platform, "mcpServerStatus").mockResolvedValue(OFF)
  vi.spyOn(platform, "tailscaleFunnels").mockResolvedValue([])
  vi.spyOn(platform, "mcpServerPublic").mockResolvedValue({ host: "x.ts.net", dns: "live", answer: { kind: "ok" } })
})

afterEach(() => {
  vi.restoreAllMocks()
  useTools.setState({ sessions: {} })
})

async function guideAtAddress(user: ReturnType<typeof userEvent.setup>) {
  render(<McpServer tool={tg as NonNullable<typeof tg>} />)
  await user.click(screen.getByRole("button", { name: /^MCP server \(or connect web\)/ }))
  await user.click(await screen.findByRole("button", { name: /^ChatGPT/ }))
}

describe("WireCat's own Tailscale connection in the connect guide", () => {
  it("is offered when Tailscale is missing, installs, signs in, and publishes the server on its address", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(NO_TAILSCALE)
    const status = vi.spyOn(platform, "funnelHelperStatus").mockResolvedValue(helper({ installed: false }))
    const install = vi.spyOn(platform, "install").mockImplementation(async (_id, onEvent) => {
      status.mockResolvedValue(helper({}))
      onEvent({
        event: "done",
        version: "0.1.1",
        path: "/bin/wirecat-funnel",
        shadowedBy: null,
        skills: { refreshed: [], failed: null },
        pathFix: null,
      })
    })
    const start = vi
      .spyOn(platform, "funnelHelperStart")
      .mockResolvedValue(helper({ state: "running", url: "https://wirecat.tail1.ts.net" }))
    const open = vi.spyOn(platform, "funnelHelperOpen").mockResolvedValue("https://wirecat.tail1.ts.net/tg")
    const serverStart = vi.spyOn(platform, "mcpServerStart").mockResolvedValue(OFF)
    await guideAtAddress(user)

    expect(await screen.findByText(/WireCat can join your Tailscale network by itself/)).toBeVisible()
    expect(screen.getByText(/turns off Tailscale's logs and support data/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Install" }))
    expect(install).toHaveBeenCalledWith("funnel", expect.any(Function))

    await user.click(await screen.findByRole("button", { name: "Connect to Tailscale" }))
    expect(start).toHaveBeenCalledOnce()
    expect(await screen.findByText(/The address will be/)).toHaveTextContent("https://wirecat.tail1.ts.net/tg/mcp")

    await user.click(screen.getByRole("button", { name: "Start the server" }))
    await waitFor(() =>
      expect(serverStart).toHaveBeenCalledExactlyOnceWith("tg", 8765, "https://wirecat.tail1.ts.net/tg"),
    )
    expect(open).toHaveBeenCalledExactlyOnceWith("tg", 8765)
  })

  it("offers the Tailscale page it still waits on, from its status", async () => {
    const user = userEvent.setup()
    const login = "https://login.tailscale.com/a/1f2e3d4c"
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(NO_TAILSCALE)
    vi.spyOn(platform, "funnelHelperStatus").mockResolvedValue(helper({ state: "needs-login", actionUrl: login }))
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    await guideAtAddress(user)

    expect(await screen.findByText(/Sign in to Tailscale in the page that opened/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Open the page again" }))
    expect(open).toHaveBeenCalledExactlyOnceWith(login)
  })

  it("goes back to installing the Tailscale app when the owner prefers it", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue(NO_TAILSCALE)
    vi.spyOn(platform, "funnelHelperStatus").mockResolvedValue(helper({ installed: false }))
    await guideAtAddress(user)

    await user.click(await screen.findByRole("button", { name: "Install the Tailscale app instead" }))
    expect(await screen.findByRole("button", { name: "Download and open the installer" })).toBeVisible()
    expect(screen.getByRole("button", { name: /let WireCat connect to Tailscale by itself/ })).toBeVisible()
  })

  it("keeps the Tailscale app's path when Tailscale is installed", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "tailscaleStatus").mockResolvedValue({
      ...NO_TAILSCALE,
      installed: true,
      daemon: true,
      backend: "running",
      https: true,
      funnel: true,
      host: "laptop.tail1.ts.net",
      freePorts: [443],
    })
    vi.spyOn(platform, "funnelHelperStatus").mockResolvedValue(helper({ installed: false }))
    await guideAtAddress(user)

    expect(await screen.findByText(/The address will be/)).toHaveTextContent("https://laptop.tail1.ts.net/tg/mcp")
    expect(screen.queryByText(/WireCat can join your Tailscale network by itself/)).toBeNull()
  })
})
