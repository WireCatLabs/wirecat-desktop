import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeepLinkTarget } from "@/domain/links"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

let deliver: (target: DeepLinkTarget | null) => void = () => {}

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  vi.spyOn(platform, "listenLinks").mockImplementation(async (onLink) => {
    deliver = onLink
  })
})

const link = (target: DeepLinkTarget) => act(() => deliver(target))
const messages = () => screen.findByRole("list", { name: "Messages" })

describe("a conversation a link opens", () => {
  it("shows the linked message highlighted among its neighbours, read only, and Back returns", async () => {
    const user = userEvent.setup()
    render(<App />)
    useNav.getState().go("digests")
    link({ type: "message", provider: "telegram", account: "1", chat: "2", message: "30" })
    const list = await messages()
    expect(useNav.getState().active).toBe("conversation")
    expect(screen.getByRole("heading", { level: 1, name: "Lease team" })).toBeInTheDocument()
    expect(screen.getByText("Telegram · personal")).toBeInTheDocument()
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(21)
    const linked = rows.filter((r) => r.getAttribute("aria-current") === "true")
    expect(linked).toHaveLength(1)
    expect(linked[0]).toHaveTextContent("The linked message")
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: /send|reply|mark/i })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(useNav.getState().active).toBe("digests")
  })

  it("opens a chat on its newest messages and reads earlier ones on request, keeping the ones shown", async () => {
    const user = userEvent.setup()
    const read = vi.spyOn(platform, "conversationRead")
    render(<App />)
    link({ type: "chat", provider: "telegram", account: "1001", chat: "4004" })
    const list = await messages()
    expect(screen.getByRole("heading", { level: 1, name: "Book club" })).toBeInTheDocument()
    expect(screen.getByText("Telegram · personal, work")).toBeInTheDocument()
    expect(within(list).getAllByRole("listitem")).toHaveLength(30)
    await user.click(screen.getByRole("button", { name: "Show earlier messages" }))
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(60))
    expect(read).toHaveBeenLastCalledWith(
      { provider: "telegram", account: "1001", chat: "4004", message: null },
      { kind: "older", message: "35" },
    )
    await user.click(screen.getByRole("button", { name: "Show earlier messages" }))
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(64))
    expect(screen.getByText("This is where the conversation starts on this computer.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show earlier messages" })).toBeNull()
  })

  it("reads a picture of the chat with the owner's agent, or says picture reading is never", async () => {
    const user = userEvent.setup()
    render(<App />)
    link({ type: "chat", provider: "telegram", account: "1001", chat: "4004" })
    const list = await messages()
    const row = within(list).getByText("parking-sign.jpg").closest("li") as HTMLElement
    expect(within(row).getByRole("button", { name: "Open the file" })).toBeInTheDocument()

    await user.click(within(row).getByRole("button", { name: "Read the picture" }))
    expect(await within(row).findByText(/Reading pictures is set to never/)).toBeInTheDocument()

    const read = vi
      .spyOn(platform, "pictureRead")
      .mockResolvedValue({ state: "read", text: "TENANTS ONLY", extractor: "agent:claude", replaced: null })
    await user.click(within(row).getByRole("button", { name: "Read the picture" }))
    expect(await within(row).findByText("TENANTS ONLY")).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith("msg:telegram/1001/4004/57", 1)
  })

  it("reads later messages after a linked one", async () => {
    const user = userEvent.setup()
    render(<App />)
    link({ type: "message", provider: "telegram", account: "1", chat: "2", message: "3" })
    const list = await messages()
    expect(within(list).getAllByRole("listitem")).toHaveLength(13)
    expect(screen.getByText("This is where the conversation starts on this computer.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show later messages" }))
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(43))
  })

  it("lays a mail thread out as emails, each with its subject and sender, quoted mail folded", async () => {
    const user = userEvent.setup()
    render(<App />)
    link({ type: "chat", provider: "email", account: "owner@example.com", chat: "5005" })
    const list = await screen.findByRole("list", { name: "Emails of the thread" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(4)
    expect(within(list).getAllByRole("heading", { name: /Warehouse lease/ })).toHaveLength(4)
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    expect(within(list).getAllByText(/From Anna Kotova/)).toHaveLength(2)
    expect(within(list).getAllByText("From you")).toHaveLength(2)
    const folds = within(list).getAllByRole("button", { name: "Show the quoted earlier mail" })
    expect(folds).toHaveLength(3)
    expect(folds[0]).toHaveAttribute("aria-expanded", "false")
    await user.click(folds[0] as HTMLElement)
    expect(folds[0]).toHaveAttribute("aria-expanded", "true")
  })

  it("shows a message's text as text: no script, no image, links only for https and opened by the system", async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const { container } = render(<App />)
    link({ type: "chat", provider: "telegram", account: "1", chat: "2" })
    const list = await messages()
    expect(within(list).getByText(/<script>alert\('stolen'\)<\/script>/)).toBeInTheDocument()
    expect(list).toHaveTextContent(
      '<img src="https://tracker.example/pixel.png" onerror="alert(1)"> no image loads here',
    )
    expect(container.querySelector("script, img, iframe, a[href^='javascript']")).toBeNull()
    expect(within(list).queryByRole("button", { name: /javascript|file:/ })).toBeNull()
    expect(within(list).queryByRole("link")).toBeNull()
    await user.click(within(list).getByRole("button", { name: "https://docs.example.com/agenda?week=45" }))
    expect(open).toHaveBeenCalledWith("https://docs.example.com/agenda?week=45")
    expect(open).toHaveBeenCalledTimes(1)
  })

  it("says calmly what is missing, with the reference to copy", async () => {
    render(<App />)
    link({ type: "message", provider: "telegram", account: "9", chat: "2", message: "3" })
    expect(await screen.findByRole("heading", { name: "This account is not on this computer" })).toBeInTheDocument()
    expect(screen.getByText("msg:telegram/9/2/3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Tools" })).toBeInTheDocument()

    link({ type: "message", provider: "telegram", account: "1", chat: "2", message: "404" })
    expect(await screen.findByRole("heading", { name: "This message is not on this computer" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open its sync" })).toBeInTheDocument()

    vi.spyOn(platform, "conversationRead").mockResolvedValueOnce({ state: "missing", what: "thread" })
    link({ type: "chat", provider: "email", account: "owner@example.com", chat: "5005" })
    expect(await screen.findByRole("heading", { name: "WireCat can't list this mail thread yet" })).toBeInTheDocument()

    vi.spyOn(platform, "conversationRead").mockResolvedValueOnce({ state: "noMemo" })
    link({ type: "chat", provider: "telegram", account: "1", chat: "2" })
    expect(await screen.findByText("This page reads Memo, which is not installed.", undefined)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Install Memo" })).toBeInTheDocument()
  })

  it("offers to try again after a failed read", async () => {
    const user = userEvent.setup()
    vi.spyOn(platform, "conversationRead").mockRejectedValueOnce(new Error("memo stopped after 60 s"))
    render(<App />)
    link({ type: "chat", provider: "telegram", account: "1", chat: "2" })
    expect(await screen.findByRole("heading", { name: "WireCat could not read this conversation" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Details" }))
    expect(await screen.findByText("memo stopped after 60 s")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await messages()).toBeInTheDocument()
  })

  it("is never the page the next launch reopens", () => {
    useNav.getState().go("logs")
    useNav.getState().go("conversation")
    expect(localStorage.getItem("wirecat.page")).toBe("logs")
  })
})
