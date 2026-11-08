import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { MemoryEntry, SourceReview } from "@/platform/memory-schemas"
import { render, screen, waitFor, within } from "@/testing/render"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

const entry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  ref: "memory:3",
  type: "memory",
  kind: "summary",
  text: "The clinics confirmed the February pilot.",
  summary: null,
  verb: null,
  targetName: null,
  chatName: null,
  counts: null,
  status: "confirmed",
  subject: null,
  subjectName: null,
  subjectIsOwner: false,
  author: { type: "bot", name: "claude-code" },
  scope: "work",
  project: null,
  projectName: null,
  supersedes: null,
  links: 1,
  reason: null,
  account: null,
  target: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: null,
  findings: null,
  task: null,
  model: null,
  confidence: null,
  sourceReview: { id: "17090", cause: "changed" },
  ...over,
})

const REVIEW: SourceReview = {
  id: "17090",
  cause: "changed",
  raisedAt: null,
  sources: [
    {
      ref: "msg:telegram/1/77/42",
      kind: "message",
      cause: "changed",
      replacement: null,
      quote: "confirmed the February pilot",
      cited: "The clinics confirmed the February pilot.",
      now: "The clinics moved the pilot to March.",
    },
  ],
  challenges: [],
  suggestions: [{ author: "claude-code", body: "The pilot is in March.", at: null }],
}

const read = (entries: MemoryEntry[]) =>
  vi.spyOn(platform, "memoryRead").mockResolvedValue({
    kind: "ready",
    entries,
    more: false,
    activity: [],
    activityError: null,
    revoke: true,
  })

const opened = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<MemoryPage />)
  const head = await screen.findByRole(
    "button",
    { name: /The clinics confirmed the February pilot/ },
    { timeout: 4000 },
  )
  expect(within(head).getByText("Source changed")).toBeInTheDocument()
  await user.click(head)
  return head.closest("[data-row]") as HTMLElement
}

describe("A memory whose source changed", () => {
  beforeEach(() => {
    useMemory.setState(useMemory.getInitialState(), true)
    vi.spyOn(platform, "memoryReviewShow").mockResolvedValue(REVIEW)
    vi.spyOn(platform, "memorySources").mockResolvedValue([])
  })

  it("waits under Review although it is in use, and shows the source then and now", async () => {
    read([entry({})])
    const user = userEvent.setup()
    const row = await opened(user)
    expect(screen.getByRole("radio", { name: /Review/ })).toBeChecked()
    const review = await within(row).findByRole("region", { name: "A source it rests on has changed" })
    expect(within(review).getByText("The clinics moved the pilot to March.", { selector: "p" })).toBeInTheDocument()
    expect(platform.memoryReviewShow).toHaveBeenCalledWith("memory:3", "17090")
  })

  it("keeps it as still true, and the row says so with the marker gone", async () => {
    read([entry({})])
    const decide = vi.spyOn(platform, "memoryReviewDecide").mockResolvedValue(entry({ sourceReview: null }))
    const user = userEvent.setup()
    const row = await opened(user)
    await user.click(await within(row).findByRole("button", { name: "Still true" }))
    expect(decide).toHaveBeenCalledWith("memory:3", "17090", "stillTrue", undefined)
    expect(await within(row).findByRole("status")).toHaveTextContent(/still true/i)
    expect(within(row).queryByText("Source changed")).not.toBeInTheDocument()
  })

  it("dismisses only with the owner's reason", async () => {
    read([entry({})])
    const decide = vi.spyOn(platform, "memoryReviewDecide").mockResolvedValue(entry({ sourceReview: null }))
    const user = userEvent.setup()
    const row = await opened(user)
    await user.click(await within(row).findByRole("button", { name: "Dismiss…" }))
    const why = within(row).getByRole("textbox", { name: "Why does the change not matter?" })
    expect(why).toHaveFocus()
    expect(within(row).getByRole("button", { name: "Dismiss" })).toBeDisabled()
    await user.type(why, "a typo fix{Enter}")
    expect(decide).toHaveBeenCalledWith("memory:3", "17090", "dismiss", "a typo fix")
  })

  it("withdraws a memory, and starts an edit from the agent's wording", async () => {
    read([entry({})])
    const decide = vi
      .spyOn(platform, "memoryReviewDecide")
      .mockResolvedValue(entry({ status: "stale", sourceReview: null }))
    const user = userEvent.setup()
    const row = await opened(user)
    await user.click(await within(row).findByRole("button", { name: "Edit with this wording" }))
    expect(within(row).getByRole("textbox")).toHaveValue("The pilot is in March.")
    await user.keyboard("{Escape}")
    await user.click(await within(row).findByRole("button", { name: "No longer true" }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith("memory:3", "17090", "withdraw", undefined))
  })

  it("offers no Withdraw for a fact memo cannot take back", async () => {
    read([entry({ ref: "fact:4", type: "fact", kind: "promise", status: "accepted" })])
    const user = userEvent.setup()
    const row = await opened(user)
    await within(row).findByRole("button", { name: "Still true" })
    expect(within(row).queryByRole("button", { name: "No longer true" })).not.toBeInTheDocument()
  })
})
