import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Segmented } from "./Segmented"

const OPTIONS = [
  { value: "tg", label: "Telegram", icon: null },
  { value: "wa", label: "WhatsApp", icon: null },
]

describe("Segmented", () => {
  it("shows only icons unless asked for labels, and names each choice once either way", () => {
    const { rerender } = render(<Segmented label="Messenger" value="tg" options={OPTIONS} onChange={() => {}} />)
    expect(screen.getAllByText("Telegram")).toHaveLength(1)
    rerender(<Segmented label="Messenger" value="tg" options={OPTIONS} onChange={() => {}} labelClass="" />)
    expect(screen.getAllByText("Telegram")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: "Telegram" })).toBeChecked()
  })
  it("as a page's view switch, shows every label and anchors the tour", () => {
    render(<Segmented size="md" tour="view" label="View" value="tg" options={OPTIONS} onChange={() => {}} />)
    expect(screen.getAllByText("WhatsApp")).toHaveLength(2)
    expect(screen.getByRole("group", { name: "View" })).toHaveAttribute("data-tour", "view")
  })
})
