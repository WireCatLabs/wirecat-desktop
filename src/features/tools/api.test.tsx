import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@/testing/render"
import { useProfiles } from "./api"
import { Health } from "./Health"
import { Permissions } from "./Permissions"

afterEach(() => vi.restoreAllMocks())

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

const held = <T,>() => {
  let settle: { resolve(v: T): void; reject(e: unknown): void } = { resolve: () => {}, reject: () => {} }
  const promise = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject }
  })
  return { promise, ...settle }
}

describe("a tool's profiles", () => {
  it("hold a placeholder while the tool answers, then list the profiles", async () => {
    const answer = held<Awaited<ReturnType<typeof platform.listProfiles>>>()
    vi.spyOn(platform, "listProfiles").mockReturnValue(answer.promise)
    render(<Health tool={tg} />)
    expect(screen.getByText("Loading profiles")).toBeInTheDocument()
    await act(async () => answer.resolve([{ name: "personal", signedIn: true }]))
    expect(await screen.findByText("personal")).toBeInTheDocument()
    expect(screen.queryByText("Loading profiles")).not.toBeInTheDocument()
  })

  it("say why they could not be listed", async () => {
    vi.spyOn(platform, "listProfiles").mockRejectedValue(new Error("tg is not installed"))
    render(<Health tool={tg} />)
    await userEvent.click(await screen.findByRole("button", { name: "Details" }))
    expect(await screen.findByText(/tg is not installed/)).toBeInTheDocument()
  })

  it("are asked again on reload, and the new answer replaces the error", async () => {
    const list = vi.spyOn(platform, "listProfiles").mockRejectedValueOnce(new Error("timed out"))
    list.mockResolvedValueOnce([{ name: "work", signedIn: false }])
    const { result } = renderHook(() => useProfiles("tg"))
    await waitFor(() => expect(result.current.error).toMatch(/timed out/))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.profiles).toEqual([{ name: "work", signedIn: false }]))
    expect(result.current.error).toBeNull()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it("are one answer for every part of the page that lists them", async () => {
    const list = vi.spyOn(platform, "listProfiles")
    render(
      <>
        <Health tool={tg} />
        <Permissions tool={tg} />
      </>,
    )
    expect(await screen.findByText("personal")).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(1)
  })
})

describe("a tool's permissions", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: /^Permissions — what agents may do/ }))

  it("show a row placeholder per group while the tool answers", async () => {
    const answer = held<Awaited<ReturnType<typeof platform.permissionsShow>>>()
    vi.spyOn(platform, "permissionsShow").mockReturnValue(answer.promise)
    render(<Permissions tool={tg} />)
    open()
    expect(screen.getByText("Loading permissions")).toBeInTheDocument()
    await act(async () => answer.reject(new Error("never mind")))
  })

  it("say why they could not be read, and read them again on the reload button", async () => {
    const user = userEvent.setup()
    const show = vi.spyOn(platform, "permissionsShow").mockRejectedValueOnce(new Error("config is broken"))
    render(<Permissions tool={tg} />)
    open()
    expect(await screen.findByText("Could not read permissions.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Read permissions again" }))
    expect(await screen.findByRole("list", { name: "Telegram permissions" })).toBeInTheDocument()
    expect(screen.queryByText(/Could not read permissions/)).not.toBeInTheDocument()
    expect(show).toHaveBeenCalledTimes(2)
  })
})
