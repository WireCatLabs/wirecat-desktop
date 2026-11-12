import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDigestBook, useDigests } from "@/features/digests"
import { editorMessages } from "@/features/digests/messages-editors"
import { useTasks } from "@/features/tasks"
import type { DigestBook, DigestItem } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { agentsFixture } from "@/platform/mock-background-agent"
import { useBackgroundAgents } from "@/shared/background-agent-store"
import { useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { act, render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  useDigestBook.setState({
    book: null,
    error: null,
    busy: {},
    failed: null,
    remembered: null,
    open: null,
    backfill: null,
    query: "",
    page: 1,
    pageSize: 50,
  })
  useDigests.setState({ name: undefined, days: null, error: null, reading: false, shown: {} })
  useBackgroundAgents.setState({ agents: null, error: null, busy: false, chooseError: null })
  vi.spyOn(platform, "listenLinks").mockResolvedValue()
})

afterEach(() => vi.restoreAllMocks())

const morning: DigestItem = {
  name: "morning-digest",
  title: "Morning digest",
  times: ["08:30"],
  weekdays: [],
  sources: [],
  routes: [
    { value: "telegram-bot:personal/user:1001", kind: "telegramBot", profile: "personal", to: "user:1001" },
    { value: "email:work/owner@example.com", kind: "email", profile: "work", to: "owner@example.com" },
  ],
  brief: null,
  scheduled: true,
  maxCostUsd: 0.5,
  maxCostPerDayUsd: 1,
  spentTodayUsd: 0.27,
  last: { at: new Date(Date.now() - 3_600_000).toISOString(), ok: true, costUsd: 0.27 },
  agent: "claude",
  trouble: null,
  nextAt: null,
}
const weekly: DigestItem = {
  ...morning,
  name: "weekly-digest",
  title: "Weekly digest",
  times: ["09:00"],
  weekdays: ["mon"],
  sources: ["mail", "meetings"],
  routes: [],
  scheduled: false,
  last: null,
}
const ready = (digests: DigestItem[], over: Partial<Extract<DigestBook, { state: "ready" }>> = {}): DigestBook => ({
  state: "ready",
  digests,
  others: [],
  harness: true,
  named: true,
  morningRests: false,
  ...over,
})

async function openPage(book?: DigestBook) {
  if (book) vi.spyOn(platform, "digestBook").mockResolvedValue(book)
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /Digests/ }))
  return user
}

async function openMorning(book?: DigestBook) {
  const user = await openPage(book)
  await user.click(await screen.findByRole("button", { name: "Open Morning digest" }, { timeout: 4000 }))
  await screen.findByRole("region", { name: "Settings" })
  return user
}

describe("the other schedules", () => {
  it("links mail triage to where it is set up and says a hand-made one is changed in a terminal", async () => {
    const user = await openPage()
    const others = await screen.findByRole("region", { name: "Other schedules" }, { timeout: 4000 })
    expect(within(others).getByText("In a terminal: memo schedule")).toBeInTheDocument()
    expect(others).toHaveTextContent(/mail-triage.*Every 30 minutes/)
    await user.click(within(others).getByRole("button", { name: "Change in Tools → Email → Mail agent" }))
    expect(useNav.getState().active).toBe("tools")
    expect(useTools.getState().expanded).toBe("email")
  }, 15000)
})

describe("the table of digests", () => {
  it("shows how often each runs, where it takes from and sends to, its last run, and the other schedules", async () => {
    await openPage()
    const table = await screen.findByRole("table", { name: "Digests" }, { timeout: 4000 })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent(/Morning digest.*Every day at 08:30.*All sources.*Telegram bot, Mail.*\$0\.27/)
    expect(rows[1]).toHaveTextContent(/Evening wrap-up.*Weekdays at 13:00 and 19:00.*Telegram, Mail/)
    expect(rows[2]).toHaveTextContent(/Weekly digest.*Mondays at 09:00.*Mail, Meetings, Tasks.*Not yet/)
    expect(screen.getByRole("region", { name: "Other schedules" })).toHaveTextContent(/mail-triage/)
    const presets = screen.getByRole("region", { name: "New digest" })
    for (const name of ["Daily digest", "Weekly digest", "Create your own"]) expect(presets).toHaveTextContent(name)
    expect(presets.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }, 15000)

  it("says the morning digest is off its schedule with its past days kept, and the daily template brings it back", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning, weekly]))
    const user = await openPage(ready([weekly], { morningRests: true }))
    const presets = await screen.findByRole("region", { name: "New digest" }, { timeout: 4000 })
    expect(within(presets).getByRole("button", { name: "Off schedule" })).toHaveAccessibleDescription(
      /morning digest is off its schedule; its past days are kept/,
    )
    await user.click(within(presets).getAllByRole("button", { name: "Set up" })[0] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "morning-digest" }), true))
  }, 15000)

  it("puts a digest on the schedule from its row without opening it", async () => {
    const on = vi
      .spyOn(platform, "digestSetScheduled")
      .mockResolvedValue(ready([morning, { ...weekly, scheduled: true }]))
    const user = await openPage(ready([morning, weekly]))
    const toggle = await screen.findByRole("switch", { name: "Weekly digest on schedule" }, { timeout: 4000 })
    await user.click(toggle)
    expect(on).toHaveBeenCalledWith("weekly-digest", true)
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"))
    expect(screen.queryByRole("region", { name: "Settings" })).not.toBeInTheDocument()
  }, 15000)

  it("opens a digest's settings from its row, and goes back to the table", async () => {
    const user = await openMorning(ready([morning, weekly]))
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Morning digest")
    expect(screen.getByLabelText("Times 1")).toHaveValue("08:30")
    expect(screen.getByRole("region", { name: "What to collect" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "All digests" }))
    expect(await screen.findByRole("table", { name: "Digests" })).toBeInTheDocument()
  }, 15000)
})

describe("finding a digest in the table", () => {
  it("narrows the rows by typed words and by the last run, and keeps the search while a digest is open", async () => {
    const user = await openPage(ready([morning, weekly]))
    const table = await screen.findByRole("table", { name: "Digests" }, { timeout: 4000 })
    await user.type(screen.getByRole("searchbox", { name: "Find a digest" }), "week")
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1)
    expect(table).toHaveTextContent("Weekly digest")
    await user.clear(screen.getByRole("searchbox", { name: "Find a digest" }))
    await user.click(screen.getByRole("button", { name: /Last run/ }))
    await user.click(await screen.findByRole("option", { name: /Not yet/ }))
    await user.keyboard("{Escape}")
    expect(screen.getByRole("searchbox", { name: "Find a digest" })).toHaveValue("last:never")
    await user.click(screen.getByRole("button", { name: "Open Weekly digest" }))
    await user.click(await screen.findByRole("button", { name: "All digests" }))
    expect(await screen.findByRole("searchbox", { name: "Find a digest" })).toHaveValue("last:never")
  }, 15000)

  it("says nothing matches and clears the search", async () => {
    const user = await openPage(ready([morning, weekly]))
    await user.type(await screen.findByRole("searchbox", { name: "Find a digest" }, { timeout: 4000 }), "zzz")
    expect(screen.getByText("No digest matches.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(await screen.findByRole("table", { name: "Digests" })).toBeInTheDocument()
  }, 15000)

  it("pages a long list of digests", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...weekly,
      name: `d-${String(i + 1).padStart(2, "0")}`,
      title: `Digest ${String(i + 1).padStart(2, "0")}`,
    }))
    const user = await openPage(ready(many))
    const table = await screen.findByRole("table", { name: "Digests" }, { timeout: 4000 })
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(50)
    const pager = screen.getByRole("navigation", { name: "Digests" })
    expect(pager).toHaveTextContent("1–50 of 60")
    await user.click(within(pager).getByRole("button", { name: "Next page" }))
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(10)
    expect(table).toHaveTextContent("Digest 60")
  }, 15000)
})

describe("creating a digest", () => {
  it("has a primary Create digest button above the table that starts an own digest", async () => {
    const user = await openPage(ready([morning]))
    const presets = await screen.findByRole("region", { name: "New digest" }, { timeout: 4000 })
    const create = within(presets).getByRole("button", { name: "Create digest" })
    expect(create).toHaveAttribute("data-variant", "primary")
    await user.click(create)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeVisible()
  }, 15000)

  it("offers a daily and a weekly template and an own one when there is none", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning]))
    const user = await openPage(ready([]))
    const starter = await screen.findByRole("region", { name: "No digests yet" }, { timeout: 4000 })
    for (const name of ["Daily digest", "Weekly digest", "Create your own"]) expect(starter).toHaveTextContent(name)
    await user.click(within(starter).getAllByRole("button", { name: "Set up" })[0] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Daily digest")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "morning-digest", times: ["08:30"], weekdays: [], scheduled: true }),
        true,
      ),
    )
    expect(await screen.findByRole("region", { name: "Settings" }, { timeout: 4000 })).toBeInTheDocument()
  }, 15000)

  it("numbers the title of a second digest from the same template, and keeps the owner's own title", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning, weekly]))
    const user = await openPage(ready([morning, weekly]))
    const presets = await screen.findByRole("region", { name: "New digest" }, { timeout: 4000 })
    await user.click(within(presets).getAllByRole("button", { name: "Set up" })[1] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    const title = within(dialog).getByRole("textbox", { name: "Title" })
    expect(title).toHaveValue("Weekly digest 2")
    await user.clear(title)
    await user.type(title, "Team week")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "weekly-digest-2", title: "Team week" }), true),
    )
  }, 15000)

  it("saves a digest that runs twice a day", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning]))
    const user = await openPage(ready([morning]))
    const presets = await screen.findByRole("region", { name: "New digest" }, { timeout: 4000 })
    await user.click(within(presets).getAllByRole("button", { name: "Set up" })[2] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    const create = within(dialog).getByRole("button", { name: "Create" })
    const title = within(dialog).getByRole("textbox", { name: "Title" })
    expect(create).toBeEnabled()
    await user.click(create)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter a title.")
    expect(title).toHaveAttribute("aria-invalid", "true")
    await waitFor(() => expect(title).toHaveFocus())
    expect(save).not.toHaveBeenCalled()
    await user.type(title, "Twice a day")
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Add a time" }))
    expect(within(dialog).getByLabelText("Times 2")).toHaveValue("18:00")
    const instructions = within(dialog).getByRole("textbox", { name: "Instructions" })
    expect(instructions).toHaveValue(editorMessages.en.brief.template.own)
    await user.clear(instructions)
    await user.type(instructions, "Only HRB")
    await user.click(create)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "digest", title: "Twice a day", times: ["08:30", "18:00"], brief: "Only HRB" }),
        true,
      ),
    )
  }, 15000)

  it("asks for a weekday before a weekly digest can be saved", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning]))
    const user = await openPage(ready([]))
    const starter = await screen.findByRole("region", { name: "No digests yet" }, { timeout: 4000 })
    await user.click(within(starter).getAllByRole("button", { name: "Set up" })[1] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    expect(within(dialog).getByRole("radio", { name: "On days" })).toBeChecked()
    const create = within(dialog).getByRole("button", { name: "Create" })
    const monday = within(dialog).getByRole("button", { name: /^mon/i })
    expect(monday).toHaveAttribute("aria-pressed", "true")
    await user.click(monday)
    expect(within(dialog).getByText("Pick at least one day.")).toBeInTheDocument()
    await user.click(create)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Pick at least one day.")
    expect(save).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: /^fri/i }))
    await user.click(create)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "weekly-digest", times: ["09:00"], weekdays: ["fri"] }),
        true,
      ),
    )
  }, 15000)
})

describe("editing a digest", () => {
  it("saves the days and sources picked, and a route from the suggested bot and own chat", async () => {
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([morning]))
    const user = await openMorning(ready([morning]))
    const settings = screen.getByRole("region", { name: "Settings" })
    await user.click(within(settings).getByRole("button", { name: "Save" }))
    expect(within(settings).getByRole("alert")).toHaveTextContent("Nothing is changed yet.")
    expect(save).not.toHaveBeenCalled()
    await user.click(within(settings).getByRole("button", { name: "Add" }))
    expect(screen.getByRole("combobox", { name: "Bot account" })).toHaveFocus()
    expect(screen.getByRole("combobox", { name: "Bot account" })).toHaveAccessibleDescription(
      /Choose an account and type a chat id first\./,
    )
    await user.click(within(settings).getByRole("radio", { name: "On days" }))
    await user.click(within(settings).getByRole("button", { name: /^tue/i }))
    expect(within(settings).getByRole("button", { name: "Save" })).not.toHaveAccessibleDescription()
    await waitFor(() => expect(within(settings).queryByText("Nothing is changed yet.")).toBeNull())
    await user.click(within(settings).getByRole("button", { name: "Sources: All connected sources" }))
    await user.click(await screen.findByRole("option", { name: "Tasks" }))

    await user.click(screen.getByRole("combobox", { name: "Bot account" }))
    await user.click(await screen.findByRole("option", { name: "alerts" }))
    await user.click(screen.getByRole("combobox", { name: "Chat or person" }))
    await user.click(await screen.findByRole("option", { name: /user:1001.*you, in personal/ }))
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByText(/alerts → user:1001/)).toBeInTheDocument()

    await user.click(within(settings).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          weekdays: ["tue"],
          sources: ["tasks"],
          routes: expect.arrayContaining(["telegram-bot:alerts/user:1001"]),
        }),
        false,
      ),
    )
  }, 20000)

  it("suggests the mailboxes for an email route, the account's own address first, and keeps a typed one", async () => {
    const user = await openMorning(ready([morning]))
    const settings = screen.getByRole("region", { name: "Settings" })
    await user.click(within(settings).getByRole("combobox", { name: "Where" }))
    await user.click(await screen.findByRole("option", { name: "Mail" }))
    await user.click(within(settings).getByRole("combobox", { name: "Mail account" }))
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["work", "personal"])
    await user.click(screen.getByRole("option", { name: "personal" }))
    const to = within(settings).getByRole("combobox", { name: "Address" })
    await user.click(to)
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(/me@example\.org/)
    await user.type(to, "boss@example.com")
    await user.click(within(settings).getByRole("button", { name: "Add" }))
    expect(within(settings).getByText(/personal → boss@example\.com/)).toBeInTheDocument()
  }, 20000)
})

describe("templates", () => {
  it("explains what a template is, what it can use and shows an example", async () => {
    const user = await openMorning(ready([morning]))
    await user.click(await screen.findByRole("button", { name: "How templates work" }, { timeout: 4000 }))
    const help = await screen.findByRole("dialog", { name: "Digest templates" })
    expect(within(help).getByText(/written in Liquid/)).toBeInTheDocument()
    expect(within(help).getByText("section.items")).toBeInTheDocument()
    expect(within(help).getByText(/for section in sections/)).toBeInTheDocument()
  }, 15000)
})

describe("getting a digest now", () => {
  it("names the price and where it goes before the run, and only then runs", async () => {
    const run = vi.spyOn(platform, "digestRun").mockResolvedValue(ready([morning]))
    const user = await openMorning(ready([morning]))
    await user.click(screen.getByRole("button", { name: "Get now" }))
    const dialog = await screen.findByRole("dialog", { name: "Get the digest now?" })
    expect(dialog).toHaveTextContent("It costs about $0.27, as the last run did.")
    expect(dialog).toHaveTextContent(
      "It is sent to Telegram bot (personal → user:1001), Mail (work → owner@example.com), as a scheduled run is",
    )
    expect(run).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Get it for about $0.27" }))
    expect(run).toHaveBeenCalledWith("morning-digest", { kind: "all" })
  }, 15000)

  it("keeps it here, or sends it to one route, from the menu", async () => {
    const run = vi.spyOn(platform, "digestRun").mockResolvedValue(ready([morning]))
    const user = await openMorning(ready([morning]))
    await user.click(screen.getByRole("button", { name: "Other ways to get it now" }))
    await user.click(await screen.findByRole("menuitem", { name: "Only show here" }))
    let dialog = await screen.findByRole("dialog", { name: "Get the digest now?" })
    expect(dialog).toHaveTextContent("It only shows here; nothing is sent.")
    await user.click(within(dialog).getByRole("button", { name: /^Get it/ }))
    expect(run).toHaveBeenLastCalledWith("morning-digest", { kind: "here" })

    await user.click(screen.getByRole("button", { name: "Other ways to get it now" }))
    await user.click(await screen.findByRole("menuitem", { name: "Send only to Mail (work → owner@example.com)" }))
    dialog = await screen.findByRole("dialog", { name: "Get the digest now?" })
    await user.click(within(dialog).getByRole("button", { name: /^Get it/ }))
    expect(run).toHaveBeenLastCalledWith("morning-digest", { kind: "only", routes: ["email:work/owner@example.com"] })
  }, 15000)

  it("takes it off the schedule and puts it back from its page", async () => {
    const set = vi
      .spyOn(platform, "digestSetScheduled")
      .mockResolvedValueOnce(ready([{ ...morning, scheduled: false }]))
      .mockResolvedValueOnce(ready([morning]))
    const user = await openMorning(ready([morning]))
    await user.click(screen.getByRole("button", { name: "Take off schedule" }))
    expect(set).toHaveBeenLastCalledWith("morning-digest", false)
    await user.click(await screen.findByRole("button", { name: "Put on schedule" }, { timeout: 4000 }))
    expect(set).toHaveBeenLastCalledWith("morning-digest", true)
  }, 15000)
})

describe("the agent that writes it", () => {
  it("names the agent with no credit, keeps its words under Details and moves the digest only on a click", async () => {
    vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agentsFixture(["claude", "gemini"], "gemini"))
    const failed: DigestItem = {
      ...morning,
      last: { ...(morning.last as NonNullable<DigestItem["last"]>), ok: false },
      trouble: { agent: "claude", kind: "noCredit", line: "Credit balance is too low" },
    }
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(ready([{ ...failed, agent: "gemini" }]))
    const user = await openMorning(ready([failed]))

    expect(await screen.findByText("Claude Code has no credit left, so the run failed.")).toBeInTheDocument()
    expect(screen.getByText(/Written by Claude Code\./)).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Switch to Gemini CLI" }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "morning-digest", agent: "gemini" }), false)
    // The failed run was Claude Code's: once Gemini CLI writes it, that refusal is history, and Gemini CLI reports no cost.
    expect(await screen.findByText(/Written by Gemini CLI\. Gemini CLI does not report/)).toBeInTheDocument()
    expect(screen.queryByText(/has no credit left/)).not.toBeInTheDocument()
  }, 15000)

  it("never offers Codex for a digest, even confirmed: memo cannot write digests in it yet", async () => {
    vi.spyOn(platform, "backgroundAgents").mockResolvedValue(agentsFixture(["claude", "codex"], "codex", true, true))
    const failed: DigestItem = {
      ...morning,
      last: { ...(morning.last as NonNullable<DigestItem["last"]>), ok: false },
      trouble: { agent: "claude", kind: "limit", line: "You've hit your session limit" },
    }
    await openMorning(ready([failed]))

    expect(await screen.findByText("Claude Code reached its usage limit, so the run failed.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Switch to/ })).not.toBeInTheDocument()
  }, 15000)
})

describe("what the page cannot do", () => {
  it("says no agent is ready or chosen, links to Settings and keeps Create off", async () => {
    const user = await openPage(ready([], { harness: false }))
    const go = await screen.findByRole("button", { name: "Choose it in Settings" }, { timeout: 4000 })
    expect(screen.getByText(/No agent for background jobs is ready or chosen/)).toBeInTheDocument()
    const starter = screen.getByRole("region", { name: "No digests yet" })
    await user.click(within(starter).getAllByRole("button", { name: "Set up" })[0] as HTMLElement)
    const dialog = await screen.findByRole("dialog", { name: "Create digest" })
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await user.click(go)
    expect(useNav.getState().active).toBe("settings")
  }, 15000)

  it("prints why a digest's own actions are off beside them when no agent is ready", async () => {
    await openMorning(ready([{ ...morning, scheduled: false }], { harness: false }))
    const getNow = screen.getByRole("button", { name: "Get now" })
    expect(getNow).toBeDisabled()
    expect(screen.getByRole("button", { name: "Put on schedule" })).toBeDisabled()
    const settings = screen.getByRole("heading", { name: "Settings" })
    const between = screen
      .getAllByText(/No agent for background jobs is ready or chosen/)
      .filter(
        (n) =>
          getNow.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING &&
          settings.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING,
      )
    expect(between).toHaveLength(1)
  }, 15000)

  it("shows an older memo's morning digest as one row and keeps to what that memo can do", async () => {
    const old = ready([{ ...morning, title: null }], { named: false })
    const save = vi.spyOn(platform, "digestSave").mockResolvedValue(old)
    const set = vi
      .spyOn(platform, "digestSetScheduled")
      .mockResolvedValue(ready([{ ...morning, title: null, scheduled: false }], { named: false }))
    const user = await openPage(old)
    const table = await screen.findByRole("table", { name: "Digests" }, { timeout: 4000 })
    expect(within(table).getAllByRole("row")).toHaveLength(2)
    expect(screen.queryByRole("region", { name: "New digest" })).not.toBeInTheDocument()
    expect(screen.getByText(/needs Memo 0\.131\.75 or newer/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update Memo" })).toBeInTheDocument()

    await user.click(within(table).getByRole("switch", { name: "Morning digest on schedule" }))
    expect(set).toHaveBeenCalledWith("morning-digest", false)
    await user.click(await screen.findByRole("switch", { name: "Morning digest on schedule", checked: false }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "morning-digest", times: ["08:30"], scheduled: true }),
        false,
      ),
    )

    await user.click(screen.getByRole("button", { name: "Open Morning digest" }))
    await screen.findByRole("region", { name: "Settings" })
    expect(screen.getByRole("radio", { name: "On days" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add a time" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Other ways to get it now" })).not.toBeInTheDocument()
  }, 20000)
})

describe("the digest history", () => {
  it("marks a day built later and builds past days only after showing the price", async () => {
    const backfill = vi.spyOn(platform, "digestBackfill")
    const user = await openMorning()
    const days = await screen.findByRole("navigation", { name: "Days" }, { timeout: 4000 })
    expect(days).toHaveTextContent("built later")

    const fill = screen.getByRole("button", { name: "Build past days" })
    await waitFor(() => expect(fill).toBeEnabled(), { timeout: 8000 })
    await user.click(fill)
    const dialog = await screen.findByRole("dialog", { name: "Build the digests of past days" })
    expect(await within(dialog).findByText(/to build/, {}, { timeout: 4000 })).toHaveTextContent(
      /4 days to build \(3 already have one\), about \$1\.08/,
    )
    expect(backfill.mock.calls.every(([, , yes]) => yes === false)).toBe(true)

    await user.click(within(dialog).getByRole("radio", { name: "14 days" }))
    expect(await within(dialog).findByText(/11 days to build/, {}, { timeout: 4000 })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: /^Build for about/ }))
    expect(backfill).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), true, "morning-digest")
    expect(await within(dialog).findByText(/Built 11 days/, {}, { timeout: 8000 })).toBeInTheDocument()
  }, 20000)

  it("shows Build past days off when this memo has no digest backfill", async () => {
    vi.spyOn(platform, "digestBackfill").mockResolvedValue({ state: "unsupported" })
    await openMorning()
    expect(await screen.findByText("Needs a Memo update")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Build past days" })).toBeDisabled()
  }, 15000)
})

describe("a digest item", () => {
  it("opens its details in place: quote, where from, and every reference as a link", async () => {
    const user = await openMorning()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getByRole("button", { name: "Details: warehouse lease" }))
    const details = within(today).getByRole("button", { name: "Details: warehouse lease" })
    expect(details).toHaveAttribute("aria-expanded", "true")
    const shown = await within(today).findByText("Where from")
    const list = shown.closest("dl") as HTMLElement
    expect(list).toHaveTextContent("«Can we sign on Friday?»")
    expect(list).toHaveTextContent(/mail · /)
    for (const name of ["Open: the message", "Open: Anna Kotova", "Open: project khimki-warehouse"])
      expect(within(list).getByRole("button", { name })).toBeInTheDocument()
  }, 15000)

  it("links who and the project; a person opens the calm not-yet page", async () => {
    const user = await openMorning()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getAllByRole("button", { name: "Open: Anna Kotova" })[0] as HTMLElement)
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
    expect(screen.getByText(/no page for this person yet/)).toBeInTheDocument()
    expect(useNav.getState().active).toBe("open")
  }, 15000)

  it("opens a known project's tasks, and an unknown one on the calm not-yet page", async () => {
    const user = await openMorning()
    const today = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(today).getByRole("button", { name: "Open: project HRB" }))
    await waitFor(() => expect(useNav.getState().active).toBe("tasks"), { timeout: 4000 })
    expect(useTasks.getState().query).toBe("project:HRB")

    act(() => useNav.getState().go("digests"))
    const again = await screen.findByRole("region", { name: "Today" }, { timeout: 4000 })
    await user.click(within(again).getByRole("button", { name: "Open: project khimki-warehouse" }))
    expect(await screen.findByRole("heading", { name: "This can't open in WireCat yet" })).toBeInTheDocument()
    expect(screen.getByText(/no page for this project yet/)).toBeInTheDocument()
  }, 20000)
})
