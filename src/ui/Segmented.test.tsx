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
  it("says each option's count after its label, to the eye and to a screen reader", () => {
    const counted = [
      { value: "review", label: "Waiting for you", count: 10 },
      { value: "all", label: "All", count: "1,200+" },
    ]
    render(<Segmented size="md" label="Show" value="review" options={counted} onChange={() => {}} />)
    expect(screen.getByRole("radio", { name: "Waiting for you 10" })).toBeChecked()
    expect(screen.getByText("1,200+")).toBeInTheDocument()
  })
  it("as a stand-in while loading, shows its choice but takes none", () => {
    render(<Segmented size="md" label="Show" value="tg" options={OPTIONS} onChange={() => {}} disabled />)
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeDisabled()
  })
})
