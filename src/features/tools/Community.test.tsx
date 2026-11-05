import { render, screen, within } from "@testing-library/react"
import type { FC } from "react"
import { beforeAll, beforeEach, expect, it } from "vitest"
import { addCommunityTools } from "@/domain/catalog"
import { useOnboarding } from "@/features/onboarding/store"
import { ACME } from "@/platform/mock-community"
import { useTools } from "./store"

let App: FC

beforeAll(async () => {
  addCommunityTools([ACME])
  ;({ App } = await import("@/app/App"))
})

beforeEach(() => {
  useTools.setState(useTools.getInitialState(), true)
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

it("offers a registered tool on Choose tools with its badge", async () => {
  useOnboarding.setState({ status: "new", open: true, step: "choose", chosen: [] })
  render(<App />)
  const box = await screen.findByRole("checkbox", { name: /Acme Notes/ })
  const cell = box.closest("li") as HTMLElement
  expect(within(cell).getByText("Community")).toBeInTheDocument()
  expect(within(cell).getByText(/Made by example/)).toBeInTheDocument()
})
