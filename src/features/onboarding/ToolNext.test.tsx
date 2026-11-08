import { afterEach, describe, expect, it, vi } from "vitest"
import { useLogs } from "@/features/logs"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { endInstalls, m, startOnboarding } from "@/testing/onboarding"
import { screen, waitFor, within } from "@/testing/render"
import { nextMessages } from "./messages-next"

vi.mock("@/platform/mock-delay", () => ({ delay: () => new Promise((r) => setTimeout(r, 0)) }))

afterEach(async () => {
  await endInstalls()
  vi.restoreAllMocks()
})

const n = nextMessages.en
const signedIn = [{ name: "personal", signedIn: true }]

describe("each tool's next steps on Done", () => {
  it("folds every card when there are several, and lists only what the tool can do", async () => {
    const { user } = startOnboarding({
      step: "done",
      chosen: ["tg", "zm"],
      installed: { tg: "0.88.0", zm: "0.40.0" },
      profiles: { tg: signedIn, zm: [] },
    })
    const tg = await screen.findByRole("button", { name: n.can("Telegram") })
    expect(tg).toHaveAttribute("aria-expanded", "false")
    await user.click(tg)
    const items = await screen.findByRole("list", { name: n.can("Telegram") })
    for (const label of [n.addAnother, n.sync, n.skill, n.mcp, n.logs, n.docs])
      expect(within(items).getByRole("button", { name: label })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: n.can("Zoom") }))
    const zoom = await screen.findByRole("list", { name: n.can("Zoom") })
    expect(within(zoom).getByRole("button", { name: n.addAccount })).toBeInTheDocument()
    expect(within(zoom).queryByRole("button", { name: n.mcp })).not.toBeInTheDocument()
  })

  it("finishes the setup and opens the tool's account form with the name field focused", async () => {
    const { user } = startOnboarding({
      step: "done",
      chosen: ["tg"],
      installed: { tg: "0.88.0" },
      profiles: { tg: signedIn },
    })
    const items = await screen.findByRole("list", { name: n.can("Telegram") })
    await user.click(await within(items).findByRole("button", { name: n.addAnother }))
    expect(useOnboarding.getState().open).toBe(false)
    expect(useNav.getState().active).toBe("tools")
    await waitFor(() => expect(document.getElementById("profile-tg")).toHaveFocus(), { timeout: 3000 })
  })

  it("opens Logs filtered to the tool", async () => {
    const { user } = startOnboarding({ step: "done", chosen: ["tg"], installed: { tg: "0.88.0" } })
    const items = await screen.findByRole("list", { name: n.can("Telegram") })
    await user.click(within(items).getByRole("button", { name: n.logs }))
    expect(useNav.getState().active).toBe("logs")
    expect(useLogs.getState().query).toBe("tool:tg")
    expect(screen.queryByRole("navigation", { name: m.flow.stepsNav })).not.toBeInTheDocument()
  })
})
