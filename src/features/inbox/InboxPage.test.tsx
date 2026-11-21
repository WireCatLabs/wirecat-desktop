import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiModel } from "@/platform/ai-model-schemas"
import type { InboxPage as Answer } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { InboxPage } from "./InboxPage"

const model = (provider: string | null): AiModel => ({
  provider,
  model: provider ? "claude-haiku-4-5" : null,
  baseUrl: null,
  origin: null,
  beta: false,
  images: false,
  key: { stored: provider !== null, source: null },
})

const thread = (
  profile: string,
  bucket: string,
  title: string,
  reason: string,
  sender: { name: string | null; address: string } | null = null,
) => ({
  profile,
  ref: `chat:email/${profile}%40example.com/${title.replaceAll(" ", "-")}`,
  title,
  bucket,
  reason,
  lastEmailAt: "2026-11-19T08:00:00.000Z",
  sortedAt: "2026-11-19T08:30:00.000Z",
  by: "anthropic/claude-haiku-4-5",
  sender,
})

const answer = (over: Partial<Answer> = {}): Answer => ({
  threads: [
    thread("work", "answer", "Contract draft", "Marta asks you to sign by Friday", {
      name: "Marta Silva",
      address: "marta@acme.example",
    }),
    thread("personal", "read", "Your flight", "Boarding pass and the gate change"),
    thread("personal", "later", "Invoice 118", "A receipt, already paid"),
  ],
  total: 3,
  buckets: { answer: 1, read: 1, later: 1 },
  accounts: [
    { result: "listed", profile: "personal", matching: 2 },
    { result: "listed", profile: "work", matching: 1 },
  ],
  ...over,
})

beforeEach(() => {
  useTools.setState({
    checked: true,
    installs: { email: [{ path: "/mail", version: "0.35.0", manager: "npm", problem: null }] },
  })
  vi.spyOn(platform, "listProfiles").mockImplementation(async (id) =>
    id === "email"
      ? [
          { name: "personal", signedIn: true },
          { name: "work", signedIn: true },
        ]
      : null,
  )
  vi.spyOn(platform, "aiModelShow").mockResolvedValue(model("anthropic"))
})

describe("the Inbox tab", () => {
  it("lists every account's sorted mail under needs an answer, to read and can wait", async () => {
    const list = vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    render(<InboxPage />)
    const answerGroup = await screen.findByRole("region", { name: /^Needs an answer/ })
    expect(within(answerGroup).getByRole("button", { name: "Open Contract draft" })).toBeInTheDocument()
    expect(within(answerGroup).getByText("Marta asks you to sign by Friday")).toBeInTheDocument()
    expect(within(answerGroup).getByText("Marta Silva")).toHaveAttribute("title", "marta@acme.example")
    expect(screen.getByRole("region", { name: /^To read/ })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: /^Can wait/ })).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith("email", ["personal", "work"], { accounts: [], words: [] }, 1, 25)
  })

  it("narrows the list to one account and to the words typed, through the tool", async () => {
    const list = vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    const user = userEvent.setup()
    render(<InboxPage />)
    await screen.findByRole("region", { name: /^Needs an answer/ })
    await user.click(screen.getByRole("button", { name: /^Account/ }))
    await user.click(await screen.findByRole("option", { name: /work/ }))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith("email", ["personal", "work"], { accounts: ["work"], words: [] }, 1, 25),
    )
    await user.type(screen.getByRole("searchbox", { name: "Search the sorted mail" }), " friday")
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "email",
        ["personal", "work"],
        { accounts: ["work"], words: ["friday"] },
        1,
        25,
      ),
    )
  })

  it("opens a row's thread on the conversation page", async () => {
    vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    const user = userEvent.setup()
    render(<InboxPage />)
    await user.click(await screen.findByRole("button", { name: "Open Contract draft" }))
    expect(useNav.getState().active).toBe("conversation")
  })

  it("explains that no AI model is chosen and leads to the setting, with no Sort now", async () => {
    vi.spyOn(platform, "aiModelShow").mockResolvedValue(model(null))
    vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    const user = userEvent.setup()
    render(<InboxPage />)
    expect(await screen.findByText("Choose an AI model to sort mail")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sort now" })).toBeNull()
    expect(await screen.findByRole("region", { name: /^Needs an answer/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open AI model settings" }))
    expect(useNav.getState().active).toBe("settings")
  })

  it("sorts every account one after another, each named, and reads the list again", async () => {
    const list = vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    const run = vi
      .spyOn(platform, "mailInboxRun")
      .mockResolvedValueOnce({
        result: "sorted",
        listed: 4,
        notes: [],
        complete: true,
        model: "anthropic/claude-haiku-4-5",
        costUsd: 0.0031,
      })
      .mockResolvedValueOnce({
        result: "failed",
        code: "not_found",
        reason: "item.not-found",
        message: "no mail is stored yet; run `mail work sync` first",
        ask: null,
      })
    const user = userEvent.setup()
    render(<InboxPage />)
    await screen.findByRole("region", { name: /^Needs an answer/ })
    const reads = list.mock.calls.length
    await user.click(screen.getByRole("button", { name: "Sort now" }))
    const progress = await screen.findByRole("region", { name: "Sorting each account" })
    expect(
      await within(progress).findByText("done, 4 threads in the list · anthropic/claude-haiku-4-5 · < $0.01"),
    ).toBeInTheDocument()
    expect(
      await within(progress).findByText("Nothing is synced in this account yet. Sync it on the Tools page first."),
    ).toBeInTheDocument()
    expect(run.mock.calls).toEqual([
      ["email", "personal", false],
      ["email", "work", false],
    ])
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(reads))
  })

  it("asks before sending to a model outside this computer and sends only that account again with yes", async () => {
    vi.spyOn(platform, "mailInboxList").mockResolvedValue(answer())
    const run = vi.spyOn(platform, "mailInboxRun").mockImplementation(async (_id, profile, yes) =>
      profile === "work" && !yes
        ? {
            result: "failed",
            code: "permission_error",
            reason: "chat-sending.ask",
            message: "8 emails of 5 threads (about 3100 tokens) go to anthropic at api.anthropic.com",
            ask: {
              emails: 8,
              threads: 5,
              tokens: 3100,
              host: "api.anthropic.com",
              model: "anthropic/claude-haiku-4-5",
              estimatedCostUsd: 0.02,
            },
          }
        : { result: "sorted", listed: 2, notes: [], complete: true, model: null, costUsd: null },
    )
    const user = userEvent.setup()
    render(<InboxPage />)
    await screen.findByRole("region", { name: /^Needs an answer/ })
    await user.click(screen.getByRole("button", { name: "Sort now" }))
    const progress = await screen.findByRole("region", { name: "Sorting each account" })
    expect(
      await within(progress).findByText(
        "anthropic/claude-haiku-4-5 runs outside this computer, at api.anthropic.com. Send 8 emails of 5 threads, about 3,100 tokens, about $0.02?",
      ),
    ).toBeInTheDocument()
    await user.click(within(progress).getByRole("button", { name: "Send and sort" }))
    await waitFor(() => expect(run).toHaveBeenLastCalledWith("email", "work", true))
    expect(run).toHaveBeenCalledTimes(3)
  })

  it("says nothing is sorted yet, and asks for the update when Email cannot sort mail", async () => {
    vi.spyOn(platform, "mailInboxList").mockResolvedValue(
      answer({ threads: [], total: 0, buckets: { answer: 0, read: 0, later: 0 } }),
    )
    const { unmount } = render(<InboxPage />)
    expect(await screen.findByText("Nothing sorted yet")).toBeInTheDocument()
    unmount()
    useTools.setState({ installs: { email: [{ path: "/mail", version: "0.34.0", manager: "npm", problem: null }] } })
    render(<InboxPage />)
    expect(await screen.findByRole("button", { name: /Update/ })).toBeInTheDocument()
  })
})
