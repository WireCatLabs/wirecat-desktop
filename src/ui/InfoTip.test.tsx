import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { render, screen } from "@/testing/render"
import { InfoTip } from "./InfoTip"

describe("InfoTip", () => {
  it("opens on focus outside every scrolling box, and Escape hides it while focus stays", async () => {
    const user = userEvent.setup()
    render(
      <div style={{ overflow: "auto" }}>
        <InfoTip label="About it">Why it is so</InfoTip>
      </div>,
    )
    await user.tab()
    const button = screen.getByRole("button", { name: "About it" })
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute("aria-expanded", "true")
    expect(button).toHaveAccessibleDescription("Why it is so")
    expect(screen.getByRole("tooltip").parentElement).toBe(document.body)
    await user.keyboard("{Escape}")
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute("aria-expanded", "false")
  })
})
