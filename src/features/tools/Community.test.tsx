import type { FC } from "react"
import { beforeAll, expect, it, vi } from "vitest"
import { addCommunityTools } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { ACME, OWN } from "@/platform/mock-community"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { useTools } from "@/shared/tools-store"
import { render, screen, within } from "@/testing/render"

let App: FC

beforeAll(async () => {
  addCommunityTools([
    { source: "community", entry: ACME },
    { source: "own", entry: OWN },
  ])
  ;({ App } = await import("@/app/App"))
})

it("lists a registered tool on the Tools page with its badge and trust note", async () => {
  useOnboarding.setState({ status: "done", open: false })
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const row = within(list)
    .getByRole("button", { name: /^Acme Notes/ })
    .closest("li") as HTMLElement
  expect(within(row).getByText("Community")).toBeInTheDocument()
  expect(await within(row).findByText(/Made by example, not by WireCat/)).toBeInTheDocument()
})

it("marks an own tool Not checked, never Community", async () => {
  useOnboarding.setState({ status: "done", open: false })
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const row = within(list)
    .getByRole("button", { name: /^Acme CRM/ })
    .closest("li") as HTMLElement
  expect(within(row).getByText("Not checked")).toBeInTheDocument()
  expect(within(row).queryByText("Community")).not.toBeInTheDocument()
})

it("offers a registered tool on Choose tools with its badge", async () => {
  useOnboarding.setState({ status: "new", open: true, step: "choose", chosen: [] })
  render(<App />)
  const box = await screen.findByRole("checkbox", { name: /Acme Notes/ })
  const cell = box.closest("li") as HTMLElement
  expect(within(cell).getByText("Community")).toBeInTheDocument()
  expect(within(cell).getByText(/Made by example/)).toBeInTheDocument()
})

it("leaves own tools out of Choose tools: they install only from their review", async () => {
  useOnboarding.setState({ status: "new", open: true, step: "choose", chosen: [] })
  render(<App />)
  await screen.findByRole("checkbox", { name: /Acme Notes/ })
  expect(screen.queryByRole("checkbox", { name: /Acme CRM/ })).not.toBeInTheDocument()
})

it("opens an own tool's review on the Tools page instead of installing it", async () => {
  const install = vi.spyOn(platform, "install")
  useNav.setState({ active: "storage" })
  await useTools.getState().install(OWN.id, { check: true })
  expect(useOwnDialog.getState()).toMatchObject({ open: true, update: { pkg: OWN.package, name: OWN.name } })
  expect(useNav.getState().active).toBe("tools")
  expect(useTools.getState().sessions[OWN.id]).toBeUndefined()
  expect(install).not.toHaveBeenCalled()
  install.mockRestore()
})
