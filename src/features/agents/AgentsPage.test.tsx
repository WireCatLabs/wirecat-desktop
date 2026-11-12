import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useAgents } from "@/shared/agents-store"
import { render, waitFor } from "@/testing/render"
import { AgentsPage } from "./AgentsPage"
import { useConnect } from "./connect"

afterEach(() => vi.restoreAllMocks())

describe("the Agents page opened again", () => {
  it("within a minute asks no tool again; later it asks with the last answers on screen", async () => {
    const status = vi.spyOn(platform, "skillStatus")
    const first = render(<AgentsPage />)
    await waitFor(() => expect(useConnect.getState().loadedAt).not.toBeNull())
    const asked = status.mock.calls.length
    expect(asked).toBeGreaterThan(0)
    first.unmount()

    render(<AgentsPage />).unmount()
    expect(status.mock.calls.length).toBe(asked)

    useAgents.setState({ answeredAt: Date.now() - 61_000 })
    render(<AgentsPage />)
    await waitFor(() => expect(status.mock.calls.length).toBeGreaterThan(asked))
    expect(Object.keys(useAgents.getState().skills).length).toBeGreaterThan(0)
  })
})
