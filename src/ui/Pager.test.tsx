import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Pager, pageList } from "./Pager"

describe("Pager", () => {
  it("asks for the page before or after, and offers neither past the ends or while a page loads", async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    const { rerender } = render(<Pager page={1} hasMore onPage={onPage} />)
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveTextContent("Page 1")
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(onPage).toHaveBeenCalledWith(2)
    rerender(<Pager page={3} hasMore={false} onPage={onPage} />)
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Previous page" }))
    expect(onPage).toHaveBeenLastCalledWith(2)
    rerender(<Pager page={3} hasMore busy onPage={onPage} />)
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })

  it("numbers the pages around the one shown, with a gap only where pages are left out", () => {
    expect(pageList(1, 1)).toEqual([1])
    expect(pageList(1, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10])
    expect(pageList(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10])
    expect(pageList(10, 10)).toEqual([1, "gap", 6, 7, 8, 9, 10])
    expect(pageList(3, 6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("says which rows of how many it shows, jumps to a numbered page, and changes the page size", async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    const onSize = vi.fn()
    render(<Pager page={2} total={1234} size={50} sizes={[25, 50, 100]} onPage={onPage} onSize={onSize} />)
    const nav = screen.getByRole("navigation", { name: "Pages" })
    expect(nav).toHaveTextContent("51–100 of 1,234")
    const steps = screen.getAllByRole("button").map((b) => b.textContent)
    expect(steps).toEqual(["", "1", "2", "3", "4", "5", "25", ""])
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "Page 25" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Page 25" }))
    expect(onPage).toHaveBeenCalledWith(25)
    await user.click(screen.getByRole("combobox", { name: "Rows per page" }))
    await user.click(screen.getByRole("option", { name: "100 per page" }))
    expect(onSize).toHaveBeenCalledWith(100)
  })

  it("marks a total that is only a floor", () => {
    render(<Pager page={100} total={5000} totalMore size={50} onPage={() => undefined} />)
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveTextContent("4,951–5,000 of 5,000+")
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled()
  })
})
