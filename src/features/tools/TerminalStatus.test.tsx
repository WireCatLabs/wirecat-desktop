import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import { render, screen } from "@/testing/render"
import { NewProfile, TerminalStatus } from "./Health"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
const realKind = platform.kind

const page = (onCheck: () => void, profiles: Profile[]): ReactElement => (
  <>
    <NewProfile tool={tg} onCheck={onCheck} />
    <TerminalStatus tool={tg} profiles={profiles} onCheck={onCheck} checking={false} />
  </>
)

function form(onCheck = vi.fn()) {
  const view = render(page(onCheck, [{ name: "personal", signedIn: true }]))
  return Object.assign(onCheck, { rerender: (profiles: Profile[]) => view.rerender(page(onCheck, profiles)) })
}

async function openTerminalFor(name: string) {
  await userEvent.type(screen.getByRole("textbox", { name: "Account name, Telegram" }), name)
  await userEvent.click(screen.getByRole("button", { name: "Open terminal" }))
}
afterEach(() => {
  vi.restoreAllMocks()
  Object.assign(platform, { kind: realKind })
})

describe("signing in from a terminal window", () => {
  it("heads the form Add new account and names the field Account name", () => {
    form()
    expect(screen.getByRole("heading", { name: "Add new account, Telegram" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Account name, Telegram" })).toBeInTheDocument()
  })

  it("in the app, says the terminal runs the sign-in and to come back for Check sign-in", async () => {
    Object.assign(platform, { kind: "tauri" })
    const openSetup = vi.spyOn(platform, "openSetup").mockResolvedValue()
    const onCheck = form()
    await openTerminalFor("work")
    expect(openSetup).toHaveBeenCalledWith("tg", "work")
    expect(await screen.findByText(/A terminal window opened and runs/)).toHaveTextContent(
      "A terminal window opened and runs tg work setup. Answer its questions there",
    )
    await userEvent.click(screen.getByRole("button", { name: "Check sign-in" }))
    expect(onCheck).toHaveBeenCalled()
    onCheck.rerender([
      { name: "personal", signedIn: true },
      { name: "work", signedIn: true },
    ])
    expect(screen.getByRole("status")).toHaveTextContent(
      "work is signed in to Telegram. Your agents can use this account now",
    )
    expect(screen.queryByRole("button", { name: "Check sign-in" })).toBeNull()
  })

  it("in the browser preview, explains what the app would open instead of claiming a terminal opened", async () => {
    form()
    await openTerminalFor("work")
    expect(await screen.findByText(/This is the browser preview, so no terminal opens/)).toHaveTextContent(
      "a terminal window that runs tg work setup",
    )
    expect(screen.queryByText(/A terminal window opened/)).toBeNull()
  })

  it("with no terminal program, says so and offers the command to copy", async () => {
    vi.spyOn(platform, "openSetup").mockRejectedValue(
      new Error("Could not open a terminal. Run this yourself: tg work setup"),
    )
    form()
    await openTerminalFor("work")
    expect(await screen.findByText(/WireCat found no terminal program to open/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy the setup command" })).toBeInTheDocument()
    expect(screen.getAllByText("tg work setup").length).toBeGreaterThan(0)
  })
})
