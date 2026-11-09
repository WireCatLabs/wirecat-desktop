import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Pager } from "./Pager"

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
})
