import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { ValueItem } from "@/platform/search-schemas"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, waitFor } from "@/testing/render"
import { SearchPage } from "./SearchPage"

afterEach(() => vi.restoreAllMocks())

const CHATS: ValueItem[] = [{ value: "-1001001", label: "Design crit", detail: null }]

async function open(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(useTools.getState().checked).toBe(true), { timeout: 4000 })
  for (const [box, option] of [
    ["Tool", "Telegram"],
    ["Profile", "personal"],
  ] as const) {
    const select = await screen.findByRole("combobox", { name: box })
    await waitFor(() => expect(select).toBeEnabled())
    await user.click(select)
    await user.click(await screen.findByRole("option", { name: option }))
  }
}

async function typeField(user: ReturnType<typeof userEvent.setup>) {
  const bar = screen.getByRole("combobox", { name: "Search messages" })
  await user.clear(bar)
  await user.type(bar, "chat:des")
}

describe("the tool's own values in the search bar", () => {
  it("are not offered while the tool lists them, then appear once it answers", async () => {
    const user = userEvent.setup()
    let answer: (v: ValueItem[]) => void = () => {}
    vi.spyOn(platform, "searchValues").mockImplementation(
      (_id, _profile, source) =>
        new Promise((resolve) => {
          if (source === "chats") answer = resolve
        }),
    )
    render(<SearchPage />)
    await open(user)
    await typeField(user)
    expect(screen.queryByRole("option", { name: /Design crit/ })).not.toBeInTheDocument()
    await act(async () => answer(CHATS))
    await typeField(user)
    expect(await screen.findByRole("option", { name: /Design crit/ })).toBeInTheDocument()
  }, 15000)

  it("leave the bar working when the tool cannot list them, and are asked again when the page opens again", async () => {
    const user = userEvent.setup()
    const values = vi.spyOn(platform, "searchValues").mockRejectedValue(new Error("tg is too old"))
    const { unmount } = render(<SearchPage />)
    await open(user)
    await waitFor(() => expect(values).toHaveBeenCalledWith("tg", "personal", "chats"))
    await typeField(user)
    expect(screen.queryByRole("option", { name: /Design crit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    unmount()

    values.mockResolvedValue(CHATS)
    render(<SearchPage />)
    await typeField(user)
    expect(await screen.findByRole("option", { name: /Design crit/ })).toBeInTheDocument()
  }, 15000)
})
