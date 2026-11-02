import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { Calendar } from "./Calendar"

afterEach(() => useLanguage.setState({ choice: "en" }))

const focused = () => document.activeElement?.getAttribute("data-day")

describe("Calendar", () => {
  it("moves by day, week, month and year from the keyboard and picks with Enter", async () => {
    const user = userEvent.setup()
    const pick = vi.fn()
    useLanguage.setState({ choice: "en" })
    render(<Calendar selected={null} today="2026-01-31" onPick={pick} autoFocus label="Due" />)
    await vi.waitFor(() => expect(focused()).toBe("2026-01-31"))
    await user.keyboard("{PageDown}")
    expect(focused()).toBe("2026-02-28")
    expect(screen.getByRole("heading")).toHaveTextContent("February 2026")
    await user.keyboard("{ArrowRight}{ArrowDown}")
    expect(focused()).toBe("2026-03-08")
    await user.keyboard("{Home}")
    expect(focused()).toBe("2026-03-08")
    await user.keyboard("{End}")
    expect(focused()).toBe("2026-03-14")
    await user.keyboard("{ArrowLeft}{ArrowUp}{Shift>}{PageUp}{/Shift}")
    expect(focused()).toBe("2025-03-06")
    await user.keyboard("{Enter}")
    expect(pick).toHaveBeenCalledWith("2025-03-06")
  })

  it("starts the week on Sunday in English and on Monday in Russian, with the month in that language", () => {
    useLanguage.setState({ choice: "en" })
    const { unmount } = render(<Calendar selected={null} today="2026-11-02" onPick={() => {}} label="Due" />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("abbr", "Sunday")
    unmount()
    useLanguage.setState({ choice: "ru" })
    render(<Calendar selected={null} today="2026-11-02" onPick={() => {}} label="Срок" />)
    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute("abbr", "понедельник")
    expect(screen.getByRole("heading")).toHaveTextContent("Ноябрь 2026")
  })

  it("marks both ends of a range and the days between as chosen", () => {
    useLanguage.setState({ choice: "en" })
    render(
      <Calendar selected={{ from: "2026-11-10", to: "2026-11-12" }} today="2026-11-02" onPick={() => {}} label="Due" />,
    )
    const chosen = screen.getAllByRole("button", { pressed: true }).map((b) => b.getAttribute("data-day"))
    expect(chosen).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"])
  })
})
