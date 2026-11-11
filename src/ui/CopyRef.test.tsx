import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CopyRef } from "./CopyRef"

describe("CopyRef", () => {
  afterEach(() => vi.restoreAllMocks())

  it("copies the reference and names it in its label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<CopyRef value="task:HRB-14" />)
    fireEvent.click(screen.getByRole("button", { name: "Copy id: task:HRB-14" }))
    expect(writeText).toHaveBeenCalledWith("task:HRB-14")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
  })

  it("draws nothing without a reference", () => {
    const { container } = render(<CopyRef value={null} />)
    expect(container.firstChild).toBeNull()
  })
})
