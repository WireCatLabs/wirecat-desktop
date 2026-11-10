import { fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { OpenLink } from "@/shared/OpenLink"
import { render, screen } from "@/testing/render"
import { LinkMenu } from "./LinkMenu"

describe("right-click on a web link", () => {
  it("offers the address of a button that opens a page, and copies it", async () => {
    const user = userEvent.setup()
    render(
      <>
        <LinkMenu />
        <OpenLink url="https://accounts.google.com/o/oauth2/v2/auth?x=1" />
      </>,
    )

    fireEvent.contextMenu(screen.getByRole("button", { name: "Open accounts.google.com" }), {
      clientX: 40,
      clientY: 40,
    })
    await user.click(await screen.findByRole("menuitem", { name: "Copy link address" }))

    expect(await navigator.clipboard.readText()).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1")
    expect(screen.getByRole("menuitem", { name: "Link address copied" })).toBeInTheDocument()
  })

  it("covers plain links too, and leaves the system menu on everything else", async () => {
    render(
      <>
        <LinkMenu />
        <a href="https://wirecat.dev/en/docs">Docs</a>
        <p>Plain text</p>
      </>,
    )

    expect(fireEvent.contextMenu(screen.getByText("Plain text"))).toBe(true)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    expect(fireEvent.contextMenu(screen.getByRole("link", { name: "Docs" }))).toBe(false)
    expect(await screen.findByRole("menu", { name: "Link" })).toBeInTheDocument()
    await userEvent.setup().keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
