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
})
