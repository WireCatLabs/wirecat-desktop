import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { MOCK_CALLS } from "@/platform/mock-calls"
import type { PersonProfile } from "@/platform/person-profile-schemas"
import { render, screen, within } from "@/testing/render"
import { PersonContacts } from "./PersonContacts"

const profile = (meetings: PersonProfile["meetings"]): PersonProfile => ({
  phones: [],
  emails: [],
  organizations: [],
  lastContact: null,
  messagesFrom: null,
  tasks: null,
  tasksMore: false,
  deals: 0,
  recent: [
    {
      kind: "message",
      at: "2026-11-10T09:00:00Z",
      text: "Invoice for October attached.",
      outgoing: false,
      provider: "email",
      chat: "Lena Ortiz",
      locator: null,
    },
  ],
  meetings,
})

afterEach(() => vi.restoreAllMocks())

describe("A person's messages and calls", () => {
  it("lists their latest mail and every call memo reads, and a call folds open in place", async () => {
    vi.spyOn(platform, "peopleProfile").mockResolvedValue(profile(MOCK_CALLS))
    const user = userEvent.setup()
    render(<PersonContacts reference="person:7" />)
    expect(await screen.findByText("Invoice for October attached.")).toBeInTheDocument()
    const calls = screen.getByRole("region", { name: "Calls" })
    expect(within(calls).getAllByRole("listitem")).toHaveLength(MOCK_CALLS.length)
    const zoom = within(calls).getByRole("button", { name: /Delivery plan review/ })
    expect(zoom).toHaveAttribute("aria-expanded", "false")
    await user.click(zoom)
    expect(zoom).toHaveAttribute("aria-expanded", "true")
  })

  it("shows no calls from a memo that reads none, and says nothing about it", async () => {
    vi.spyOn(platform, "peopleProfile").mockResolvedValue(profile(null))
    render(<PersonContacts reference="person:7" />)
    expect(await screen.findByText("Invoice for October attached.")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Calls" })).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
