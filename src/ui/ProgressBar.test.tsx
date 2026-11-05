import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProgressBar } from "./ProgressBar"

describe("ProgressBar", () => {
  it("reports its name, range and rounded value", () => {
    render(<ProgressBar label="Download" value={41.6} valueText="42 of 100 MB" />)
    const bar = screen.getByRole("progressbar", { name: "Download" })
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    expect(bar).toHaveAttribute("aria-valuenow", "42")
    expect(bar).toHaveAttribute("aria-valuetext", "42 of 100 MB")
  })

  it("counts up to its own maximum and keeps a minimum width", () => {
    render(<ProgressBar label="Tools read" value={0} max={4} minShare={8} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemax", "4")
    expect(bar.firstElementChild).toHaveStyle({ width: "8%" })
  })

  it("has no value while the work does not say how far it is", () => {
    render(<ProgressBar label="Sealing" value={null} />)
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow")
  })

  it("leaves the role out when it only decorates", () => {
    render(<ProgressBar label="Still installing" value={30} decorative />)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })
})
