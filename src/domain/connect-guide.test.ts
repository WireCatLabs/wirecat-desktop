import { describe, expect, it } from "vitest"
import {
  choiceOf,
  errorMessage,
  funnelOff,
  isFunnelHost,
  isLocalAddress,
  otherServerTools,
  portInUse,
  publishWait,
  quietDelay,
  reachLamp,
  startProgress,
  tunnelOff,
  viaTailscale,
  wasStopped,
} from "./connect-guide"

describe("tunnel choice", () => {
  it("treats wirecat as Tailscale for the card and the Funnel", () => {
    expect(choiceOf("wirecat")).toBe("tailscale")
    expect(choiceOf("own")).toBe("own")
    expect(viaTailscale("wirecat")).toBe(true)
    expect(viaTailscale("tailscale")).toBe(true)
    expect(viaTailscale("cloudflare")).toBe(false)
    expect(viaTailscale("own")).toBe(false)
  })
})

describe("errors", () => {
  it("reads a message from an Error or a string", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom")
    expect(errorMessage("plain")).toBe("plain")
  })

  it("knows a stopped approval from a failure", () => {
    expect(wasStopped("Stopped.")).toBe(true)
    expect(wasStopped(new Error("Stopped."))).toBe(true)
    expect(wasStopped(new Error("Stopped by"))).toBe(false)
  })

  it("spots a port already taken", () => {
    expect(portInUse("port 8765 is in use")).toBe(true)
    expect(portInUse("listen EADDRINUSE")).toBe(true)
    expect(portInUse("no route")).toBe(false)
  })
})

describe("an address that went off", () => {
  it("is local only on http", () => {
    expect(isLocalAddress({ connectorUrl: "http://127.0.0.1:8765/tg/mcp" })).toBe(true)
    expect(isLocalAddress({ connectorUrl: "https://a.ts.net/tg/mcp" })).toBe(false)
    expect(isLocalAddress({ connectorUrl: null })).toBe(false)
    expect(isLocalAddress(null)).toBe(false)
  })

  it("flags a stopped Funnel only for a Tailscale choice with a running server", () => {
    expect(funnelOff("tailscale", true, { live: false })).toBe(true)
    expect(funnelOff("wirecat", true, { live: false })).toBe(true)
    expect(funnelOff("tailscale", true, { live: true })).toBe(false)
    expect(funnelOff("tailscale", true, null)).toBe(false)
    expect(funnelOff("tailscale", false, { live: false })).toBe(false)
    expect(funnelOff("cloudflare", true, { live: false })).toBe(false)
  })

  it("flags a stopped tunnel only when the server's address is on its route", () => {
    const route = { live: false, url: "https://wc.example.com/tg" }
    expect(tunnelOff({ connectorUrl: "https://wc.example.com/tg/mcp" }, true, route)).toBe(true)
    expect(tunnelOff({ connectorUrl: "https://other.example.com/tg/mcp" }, true, route)).toBe(false)
    expect(tunnelOff({ connectorUrl: "https://wc.example.com/tg/mcp" }, true, { ...route, live: true })).toBe(false)
    expect(tunnelOff({ connectorUrl: "https://wc.example.com/tg/mcp" }, false, route)).toBe(false)
    expect(tunnelOff({ connectorUrl: "https://wc.example.com/tg/mcp" }, true, null)).toBe(false)
  })
})

describe("start progress", () => {
  it("opens the address, then starts the server", () => {
    expect(startProgress("idle", null)).toEqual({ open: "todo", server: "todo" })
    expect(startProgress("tunnel", null)).toEqual({ open: "busy", server: "todo" })
    expect(startProgress("server", null)).toEqual({ open: "done", server: "busy" })
  })

  it("marks the step that failed", () => {
    expect(startProgress("failed", { at: "tunnel", message: "x" })).toEqual({ open: "failed", server: "todo" })
    expect(startProgress("failed", { at: "server", message: "x" })).toEqual({ open: "done", server: "failed" })
  })
})

describe("address check", () => {
  it("shows the lamp for each state", () => {
    expect(reachLamp({ state: "checking" }, false)).toBe("busy")
    expect(reachLamp({ state: "publishing" }, false)).toBe("busy")
    expect(reachLamp({ state: "publishing" }, true)).toBe("busy")
    expect(reachLamp({ state: "live" }, true)).toBe("busy")
    expect(reachLamp({ state: "live" }, false)).toBe("done")
    expect(reachLamp({ state: "wrong" }, false)).toBe("done")
    expect(reachLamp({ state: "unknown" }, false)).toBe("failed")
  })

  it("counts the wait against Tailscale's ten minutes and stops at full", () => {
    expect(publishWait(0)).toEqual({ share: 0, minutes: 0 })
    expect(publishWait(150_000)).toEqual({ share: 0.25, minutes: 2 })
    expect(publishWait(20 * 60_000)).toEqual({ share: 1, minutes: 20 })
  })

  it("tells a Funnel name from a name of the owner's", () => {
    expect(isFunnelHost("laptop.tail1234.ts.net")).toBe(true)
    expect(isFunnelHost("mcp.example.com")).toBe(false)
  })
})

describe("the test step", () => {
  it("waits out the rest of the quiet minute, never less than zero", () => {
    expect(quietDelay(1000, 21_000)).toBe(40_000)
    expect(quietDelay(0, 90_000)).toBe(0)
  })

  it("offers other installed tools that have a server", () => {
    const all = [{ id: "tg", mcpServer: {} }, { id: "wa", mcpServer: {} }, { id: "zm" }, { id: "max", mcpServer: {} }]
    const installs = { tg: [{}], wa: [{}], zm: [{}], max: [] }
    expect(otherServerTools(all, "tg", installs).map((t) => t.id)).toEqual(["wa"])
  })
})
