import userEvent from "@testing-library/user-event"
import * as v from "valibot"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { DamageReportSchema } from "@/domain/store-damage"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor } from "@/testing/render"
import { useStoreDamage } from "./damage-store"
import { Health } from "./Health"
import fixture from "./store-damage.fixture.json"

const wa = findTool("wa") as NonNullable<ReturnType<typeof findTool>>
const report = v.parse(DamageReportSchema, fixture)
const damagedDoctor = {
  command: "wa work doctor --record --json",
  exitCode: 1,
  durationMs: 300,
  stderr: "",
  report: { item: { store: { exists: true, damage: { what_happened: report.what_happened } } } },
}

afterEach(() => {
  vi.restoreAllMocks()
  useStoreDamage.setState({ damaged: [] })
})

async function check() {
  vi.spyOn(platform, "listProfiles").mockResolvedValue([{ name: "work", signedIn: true }])
  vi.spyOn(platform, "diagnose").mockResolvedValue(damagedDoctor)
  const user = userEvent.setup()
  render(<Health tool={wa} />)
  await user.click(await screen.findByRole("button", { name: "More for work" }))
  await user.click(screen.getByRole("menuitem", { name: "Check" }))
  return user
}

describe("a check that finds the message store damaged", () => {
  it("shows the tool's report: safe steps run, destructive ones are only copied", async () => {
    const recover = vi.spyOn(platform, "storeRecover").mockResolvedValue(report)
    const step = vi.spyOn(platform, "storeRecoverStep").mockResolvedValue()
    const user = await check()

    expect(await screen.findByText(report.what_happened)).toBeTruthy()
    expect(recover).toHaveBeenCalledWith("wa")
    expect(screen.getByText(report.external_data_safe)).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Run" })).toHaveLength(2)
    expect(screen.getByText("kill 4242")).toBeTruthy()
    expect(screen.getAllByText(/run it yourself in a terminal/)).toHaveLength(2)
    expect(useStoreDamage.getState().damaged).toEqual(["wa"])

    recover.mockResolvedValue(null)
    await user.click(screen.getAllByRole("button", { name: "Run" })[0] as HTMLElement)
    expect(step).toHaveBeenCalledWith("wa", 0)
    expect(await screen.findByText(/passed the check/)).toBeTruthy()
    await waitFor(() => expect(useStoreDamage.getState().damaged).toEqual([]))
  })

  it("keeps the check as it was when the tool is older than the report", async () => {
    const recover = vi.spyOn(platform, "storeRecover").mockResolvedValue(null)
    await check()
    await waitFor(() => expect(recover).toHaveBeenCalled())
    expect(screen.queryByText("The message store needs recovery")).toBeNull()
    expect(await screen.findByText("Technical details")).toBeTruthy()
  })
})
