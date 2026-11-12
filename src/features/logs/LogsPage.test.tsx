import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { CommandError, TOO_OLD } from "@/platform/command-error"
import { fireEvent, render, screen, waitFor, within } from "@/testing/render"
import { LogsPage } from "./LogsPage"
import { timing } from "./store"

afterEach(() => vi.restoreAllMocks())

const loaded = () =>
  waitFor(() => expect(screen.getByRole("button", { name: "Read again" })).toHaveAttribute("aria-busy", "false"))

const openSettings = async (user: ReturnType<typeof userEvent.setup>, name = "Log settings") => {
  await user.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }))
  return screen.getByRole("list", { name: /Where the runs come from|Откуда взяты запуски/ })
}

const runsOf = (list: HTMLElement, tool: string) => within(list).getByText(tool).closest("li") as HTMLElement

describe("Logs", () => {
  it("reads every tool's runs, filters by a facet and opens a run's record", async () => {
    const user = userEvent.setup()
    const listRuns = platform.listRuns.bind(platform)
    let release = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    vi.spyOn(platform, "listRuns").mockImplementation(async (...args) => {
      await held
      return listRuns(...args)
    })
    render(<LogsPage />)

    expect(screen.getByText(/successful ones for 7 days, failed ones for 30/)).toBeInTheDocument()
    expect(await screen.findByRole("progressbar", { name: "Tools read" })).toBeInTheDocument()
    release()
    await loaded()

    const agents = within(screen.getByRole("region", { name: "Agent" }))
    expect(agents.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(0)
    expect(agents.queryByText("none")).not.toBeInTheDocument()

    const tools = screen.getByRole("region", { name: "Tool" })
    await user.click(within(tools).getByRole("button", { name: /^Tool: All \d+$/ }))
    await user.type(screen.getByRole("combobox", { name: "Find tool" }), "whats")
    await user.click(screen.getByRole("option", { name: /WhatsApp/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true tool:wa")
    const rows = screen.getAllByRole("button", { name: /^Show run wa / })
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.queryByRole("cell", { name: /Telegram/ })).not.toBeInTheDocument()

    await user.click(rows[0] as HTMLElement)
    const record = await screen.findByRole("group", { name: "Run record" })
    await waitFor(() => expect(record).toHaveTextContent("event_count"))
    const text = record.textContent ?? ""
    const at = (key: string) => text.indexOf(key)
    expect(at("run_id")).toBe(0)
    expect(at("run_id")).toBeLessThan(at("command"))
    expect(at("started_at")).toBeLessThan(at("status"))
    expect(at("status")).toBeLessThan(at("cli_version"))
    expect(screen.getByRole("region", { name: "Steps" })).toHaveTextContent(/request the tool sent to WhatsApp/)
  })

  it("keeps failed runs only after the owner confirms, and goes back to every run by removing the setting", async () => {
    const user = userEvent.setup()
    const set = vi.spyOn(platform, "settingsSet")
    const unset = vi.spyOn(platform, "settingsUnset")
    render(<LogsPage />)
    await loaded()

    const keeping = await openSettings(user)
    const telegram = await within(keeping).findByRole("combobox", { name: "Which Telegram runs to keep" })
    const every = "Keeps successful runs for 7 days, failed runs for 30 days"
    expect(within(keeping).getAllByText(every)).toHaveLength(3)
    expect(telegram).toHaveTextContent("Every run")

    await user.click(telegram)
    await user.click(screen.getByRole("option", { name: "Failed runs only" }))
    const dialog = screen.getByRole("dialog", { name: "Stop keeping successful Telegram runs?" })
    expect(dialog).toHaveTextContent("tg config set --defaults record false")
    expect(set).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Keep failed runs only" }))
    expect(set).toHaveBeenCalledWith("tg", null, true, "record", "false")
    expect(await within(runsOf(keeping, "Telegram")).findByText("Keeps failed runs only for 30 days")).toBeVisible()
    expect(telegram).toHaveTextContent("Failed runs only")

    await user.click(telegram)
    await user.click(screen.getByRole("option", { name: "Every run" }))
    const back = screen.getByRole("dialog", { name: "Keep every Telegram run?" })
    expect(back).toHaveTextContent(/successful runs for 7 days, failed runs for 30 days/)
    await user.click(within(back).getByRole("button", { name: "Keep every run" }))
    expect(unset).toHaveBeenCalledWith("tg", null, true, "record")
    await waitFor(() => expect(within(keeping).getAllByText(every)).toHaveLength(3))
  })

  it("on a tool from before every run was kept, turns it on with record true and off by removing it", async () => {
    const user = userEvent.setup()
    const show = platform.settingsShow.bind(platform)
    vi.spyOn(platform, "settingsShow").mockImplementation(async (id, profile) => {
      const s = await show(id, profile)
      const rows = s.rows
        .filter((r) => r.key !== "keep_successful_runs_for_days")
        .map((r) => (r.key === "record" && r.origin === "default" ? { ...r, value: false } : r))
      return { ...s, rows }
    })
    const set = vi.spyOn(platform, "settingsSet")
    render(<LogsPage />)
    await loaded()

    const keeping = await openSettings(user)
    const max = await within(keeping).findByRole("combobox", { name: "Which MAX runs to keep" })
    expect(max).toHaveTextContent("Failed runs only")
    await user.click(max)
    await user.click(screen.getByRole("option", { name: "Every run" }))
    const dialog = screen.getByRole("dialog", { name: "Keep every MAX run?" })
    expect(dialog).toHaveTextContent(/keeps every run for 30 days/)
    await user.click(within(dialog).getByRole("button", { name: "Keep every run" }))
    expect(set).toHaveBeenCalledWith("max", null, true, "record", "true")
    await waitFor(() => expect(max).toHaveTextContent("Every run"))
    await platform.settingsUnset("max", null, true, "record")
  })

  it("says an older tool gets its logs with the next update instead of failing", async () => {
    const listRuns = platform.listRuns.bind(platform)
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "zm")
        throw new CommandError(
          TOO_OLD,
          `unknown command 'list' — "runs" is not a command, so it was read as a profile name`,
        )
      if (id === "memo")
        throw new CommandError(
          TOO_OLD,
          '{"error":{"code":"validation_error","message":"unknown command \'runs\'","retry":{"safe":false}}}',
        )
      if (id === "drive") throw new Error("drive runs list: the program did not finish in time")
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)
    await loaded()

    const sources = await openSettings(userEvent.setup())
    expect(within(sources).getByText("arrives with the next update of Zoom")).toBeInTheDocument()
    expect(within(sources).getByText("arrives with the next update of Memo")).toBeInTheDocument()
    const drive = within(sources)
      .getByText(/did not finish in time/)
      .closest("li") as HTMLElement
    expect(within(drive).getByRole("button", { name: "Report this" })).toBeInTheDocument()
    expect(within(runsOf(sources, "Zoom")).queryByRole("button", { name: "Report this" })).not.toBeInTheDocument()
  })

  it("shows a tool without a keep setting as a plain fact, not a failure", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    expect(screen.queryByRole("img", { name: /could not be read/ })).not.toBeInTheDocument()
    const email = runsOf(await openSettings(user), "Email")
    expect(await within(email).findByText("Has no setting for which runs to keep")).toBeInTheDocument()
    expect(within(email).queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(email).queryByRole("button", { name: /Report/ })).not.toBeInTheDocument()
  })

  it("groups by a field from a facet header", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    await user.click(screen.getByRole("button", { name: "Group by Profile" }))
    expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent("Profile")
    expect(screen.getByRole("columnheader", { name: "Profile" })).toBeInTheDocument()
  })

  it("shows what went wrong in a failed run, its masked command line, and filters by the agent's session", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    const status = screen.getByRole("region", { name: "HTTP status" })
    await user.click(within(status).getByRole("button", { name: /^429/ }))
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true error.http.status:429")

    const [first] = screen.getAllByRole("button", { name: /^Show run / })
    await user.click(first as HTMLElement)
    const failure = screen.getByRole("region", { name: "What went wrong" })
    expect(failure).toHaveTextContent("CliError")
    expect(failure).toHaveTextContent(/(GET|POST) \S+\s*429/)
    await user.click(within(failure).getByRole("button", { name: /Where in the tool/ }))
    expect(failure).toHaveTextContent("transport.js")
    expect(screen.getByRole("region", { name: "Command line" })).toHaveTextContent(/^Command line(max|wa) \w+ \w+/)

    const [session] = screen.getAllByTitle(/^Only runs of session /)
    await user.click(session as HTMLElement)
    expect((screen.getByRole("combobox", { name: "Search runs" }) as HTMLInputElement).value).toMatch(
      /^-no_command:true error\.http\.status:429 session_id:[0-9a-f-]+$/,
    )
  })

  it("groups runs by conversation, each under a header with who held it, and its runs in time order", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    await user.click(screen.getByRole("combobox", { name: "Group by" }))
    await user.click(screen.getByRole("option", { name: "Conversation" }))
    expect(screen.getByText(/runs match, in \d+ conversations/)).toBeInTheDocument()

    const session = screen.getByRole("rowgroup", { name: "Claude Code, session 5c0e9d41" })
    const header = within(session).getAllByRole("row")[0] as HTMLElement
    expect(header).toHaveTextContent(/Claude Code\s*MCP on this computer · session 5c0e9d41/)
    expect(header).toHaveTextContent(/3 runs\s*1 failed/)
    const order = within(session)
      .getAllByRole("button", { name: /^Show run / })
      .map((b) => b.getAttribute("aria-label")?.split(" at ")[0])
    expect(order).toEqual(["Show run tg chats list", "Show run tg messages read", "Show run tg messages search"])

    const browser = screen.getByRole("rowgroup", { name: "claude-ai" })
    expect(within(browser).getAllByRole("row")[0]).toHaveTextContent(/MCP over the internet\s*from .+3 runs\s*1 failed/)
    expect(screen.getByRole("rowgroup", { name: "WireCat Desktop" })).toHaveTextContent(/1 run\s*1 failed/)
  })

  it("speaks Russian: conversation headers count runs in Russian plural forms", async () => {
    useLanguage.setState({ choice: "ru" })
    const user = userEvent.setup()
    render(<LogsPage />)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Прочитать заново" })).toHaveAttribute("aria-busy", "false"),
    )

    expect(screen.getByRole("heading", { name: "Журнал" })).toBeInTheDocument()
    const keeping = await openSettings(user, "Настройки журнала")
    expect(
      await within(runsOf(keeping, "Telegram")).findByText("Хранит успешные запуски 7 дней, неудачные 30 дней"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Группировка" }))
    await user.click(screen.getByRole("option", { name: "Разговор" }))
    const session = screen.getByRole("rowgroup", { name: "Claude Code, сеанс 5c0e9d41" })
    expect(within(session).getAllByRole("row")[0]).toHaveTextContent(/MCP на этом компьютере · сеанс 5c0e9d41/)
    expect(within(session).getAllByRole("row")[0]).toHaveTextContent(/3 запуска\s*с ошибкой: 1/)
    expect(screen.getByRole("rowgroup", { name: "WireCat Desktop" })).toHaveTextContent(/1 запуск\s*с ошибкой: 1/)
  })

  it("shows a run's requests as lines, with the retry, the wait and the steps not kept marked", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()
    await user.type(
      screen.getByRole("combobox", { name: "Search runs" }),
      ' cli_command:"tg messages read" via:mcp-stdio',
    )
    await user.click(await screen.findByRole("button", { name: /^Show run tg messages read / }))

    const steps = screen.getByRole("region", { name: "Steps" })
    await waitFor(() => expect(within(steps).getAllByRole("row").length).toBeGreaterThan(5))
    expect(steps).toHaveTextContent(/Steps · 7, 412 more not kept/)
    const lines = within(steps)
      .getAllByRole("row")
      .map((r) => r.textContent ?? "")
    expect(lines.some((l) => /→messages\.getHistorymtprotoretry 1waited 3\.0 s/.test(l))).toBe(true)
    expect(lines.some((l) => /←messages\.getHistorymtprotoretry 13 messagesok118 ms/.test(l))).toBe(true)
    expect(lines.some((l) => /412 more steps not kept/.test(l))).toBe(true)
    expect(screen.getByRole("region", { name: "Command line" })).toHaveTextContent(
      /Started by Claude Code through claude-code \(MCP on this computer\) in session 5c0e9d41/,
    )
  })

  it("lets the owner select a run's session id without filtering, and filters on Enter", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()
    await user.type(
      screen.getByRole("combobox", { name: "Search runs" }),
      ' cli_command:"tg messages read" via:mcp-stdio',
    )
    await user.click(await screen.findByRole("button", { name: /^Show run tg messages read / }))
    const search = screen.getByRole("combobox", { name: "Search runs" }) as HTMLInputElement
    const before = search.value
    const id = screen.getByTitle("Show only this session's runs")

    const text = id.firstChild as Text
    window.getSelection()?.setBaseAndExtent(text, 0, text, 8)
    fireEvent.click(id)
    expect(search.value).toBe(before)
    expect(window.getSelection()?.toString()).toBe("5c0e9d41")

    window.getSelection()?.removeAllRanges()
    id.focus()
    await user.keyboard("{Enter}")
    expect(search.value).toMatch(/session_id:5c0e9d41/)
  })

  it("says a success kept as its summary line has no steps to show", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()
    await user.type(
      screen.getByRole("combobox", { name: "Search runs" }),
      ' cli_command:"tg messages search" status:success via:cli',
    )
    await user.click(await screen.findByRole("button", { name: /^Show run tg messages search / }))
    expect(await screen.findByText(/keeps only this summary, not its steps/)).toBeInTheDocument()
  })

  it("hides runs with no command by default, counts them, and lists them again once that filter is removed", async () => {
    const user = userEvent.setup()
    render(<LogsPage />)
    await loaded()

    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("-no_command:true")
    const commands = screen.getByRole("region", { name: "Command" })
    const list = within(commands).getByRole("button", { name: /^Command: All \d+$/ })
    await user.click(list)
    expect(screen.queryAllByRole("option", { name: /\(no command\)/ })).toHaveLength(0)
    await user.keyboard("{Escape}")
    expect(screen.queryAllByRole("button", { name: /^Show run \S+ \(no command\)/ })).toHaveLength(0)

    const show = screen.getByRole("button", { name: "Show them" })
    expect(show.parentElement).toHaveTextContent(/^\d+ runs with no command hidden Show them$/)
    await user.click(show)
    expect(screen.getByRole("combobox", { name: "Search runs" })).toHaveValue("")
    await user.click(within(commands).getByRole("button", { name: /^Command: All \d+$/ }))
    expect(screen.getAllByRole("option", { name: /\(no command\)/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Show them" })).not.toBeInTheDocument()
  })
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rows = () => screen.queryAllByRole("button", { name: /^Show run / })

describe("Logs pages", () => {
  it("shows the runs a page at a time and steps to the next page", async () => {
    const user = userEvent.setup()
    const listRuns = platform.listRuns.bind(platform)
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      const res = await listRuns(id, ...rest)
      const model = res.items[0]
      if (id !== "tg" || !model) return res
      const extra = Array.from({ length: 80 }, (_, i) => ({
        ...model,
        run_id: `many-${i}`,
        command: `read ${i}`,
        cli_command: `tg read ${i}`,
      }))
      return { ...res, items: [...res.items, ...extra] }
    })
    render(<LogsPage />)
    await loaded()
    const pager = screen.getByRole("navigation", { name: "Pages" })
    expect(pager).toHaveTextContent(/^1–50 of \d+/)
    expect(rows()).toHaveLength(50)
    const first = rows()[0]?.getAttribute("aria-label")
    await user.click(within(pager).getByRole("button", { name: "Next page" }))
    expect(within(pager).getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page")
    expect(rows()[0]?.getAttribute("aria-label")).not.toBe(first)
  })
})

describe("Logs snapshot", () => {
  const saved = { ...timing }
  afterEach(() => Object.assign(timing, saved))

  it("shows the table once, after every tool has answered", async () => {
    const listRuns = platform.listRuns.bind(platform)
    let release = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "tg") await held
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)

    const progress = await screen.findByRole("progressbar", { name: "Tools read" })
    const total = Number(progress.getAttribute("aria-valuemax"))
    await waitFor(() => expect(progress).toHaveAttribute("aria-valuenow", String(total - 1)))
    expect(rows()).toHaveLength(0)
    expect(progress.parentElement).toHaveTextContent(/of \d+ tools done, reading Telegram…$/)

    release()
    await loaded()
    expect(rows().length).toBeGreaterThan(0)
    const sources = await openSettings(userEvent.setup())
    expect(within(runsOf(sources, "Telegram")).getByText(/^\d+\+? runs$/)).toBeInTheDocument()
  })

  it("stops waiting for a slow tool, says so, and takes its answer in the next round without asking twice", async () => {
    timing.answer = 1000
    const user = userEvent.setup()
    const listRuns = platform.listRuns.bind(platform)
    let answerTg = () => {}
    const tgHeld = new Promise<void>((resolve) => {
      answerTg = resolve
    })
    const spy = vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      if (id === "tg") await tgHeld
      return listRuns(id, ...rest)
    })
    render(<LogsPage />)
    await loaded()

    expect(rows().length).toBeGreaterThan(0)
    expect(screen.getByRole("img", { name: /could not be read; open Log settings/ })).toBeInTheDocument()
    const sources = await openSettings(user)
    expect(within(sources).getByText("did not answer in 1 s")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Read again" }))
    answerTg()
    await loaded()
    expect(await within(runsOf(sources, "Telegram")).findByText(/^\d+\+? runs$/)).toBeInTheDocument()
    expect(spy.mock.calls.filter(([id]) => id === "tg")).toHaveLength(1)
  })
})

// Live rounds answered at once from each tool's first answer, so a round takes no mock wait.
function answeredOnce() {
  const listRuns = platform.listRuns.bind(platform)
  const first = new Map<string, ReturnType<typeof listRuns>>()
  return (...args: Parameters<typeof listRuns>) => {
    const [id] = args
    if (!first.has(id)) first.set(id, listRuns(...args))
    return first.get(id) as ReturnType<typeof listRuns>
  }
}

describe("Logs live", () => {
  const saved = { ...timing }
  afterEach(() => {
    Object.assign(timing, saved)
    Reflect.deleteProperty(document, "visibilityState")
  })

  it("reads again while Live is on, one round at a time, and waits while the window is hidden", async () => {
    timing.live = 100
    const user = userEvent.setup()
    const listRuns = answeredOnce()
    let calls = 0
    let inFlight = 0
    let most = 0
    const tools = new Set<string>()
    vi.spyOn(platform, "listRuns").mockImplementation(async (...args) => {
      tools.add(args[0])
      calls++
      inFlight++
      most = Math.max(most, inFlight)
      try {
        return await listRuns(...args)
      } finally {
        inFlight--
      }
    })
    render(<LogsPage />)
    await loaded()
    const perRound = calls

    const live = screen.getByRole("button", { name: "Live" })
    expect(live).toHaveAttribute("aria-pressed", "false")
    await user.click(live)
    expect(live).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(perRound * 3))
    // One read per tool at most at any moment: a second round never starts while one is running.
    expect(most).toBeLessThanOrEqual(tools.size)
    expect(screen.getByText("Updated just now")).toBeInTheDocument()

    let visibility = "hidden"
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
    await waitFor(() => expect(inFlight).toBe(0))
    const paused = calls
    await sleep(timing.live * 5)
    expect(calls).toBe(paused)

    visibility = "visible"
    await waitFor(() => expect(calls).toBeGreaterThan(paused))
    await user.click(live)
    expect(live).toHaveAttribute("aria-pressed", "false")
  })

  it("puts new runs on top, and holds them behind a button while the reader is scrolled down", async () => {
    timing.live = 100
    const user = userEvent.setup()
    const listRuns = answeredOnce()
    let added = 0
    vi.spyOn(platform, "listRuns").mockImplementation(async (id, ...rest) => {
      const res = await listRuns(id, ...rest)
      const model = res.items[0]
      if (id !== "tg" || !model) return res
      const items = Array.from({ length: added }, (_, i) => ({
        ...model,
        run_id: `new-${i}`,
        command: `watch ${i}`,
        cli_command: `tg watch ${i}`,
        status: "failed",
        started_at: new Date().toISOString(),
      }))
      return { ...res, items: [...items, ...res.items] }
    })
    let down = true
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.tagName === "MAIN" ? 0 : down ? -400 : 10
      return { x: 0, y: top, top, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }
    })
    const scrollTo = vi.fn(() => {
      down = false
    })
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo })
    try {
      render(
        <main>
          <LogsPage />
        </main>,
      )
      await loaded()
      added = 2
      await user.click(screen.getByRole("button", { name: "Live" }))

      const more = await screen.findByRole("button", { name: "2 new runs" })
      expect(screen.queryByRole("button", { name: /^Show run tg watch/ })).not.toBeInTheDocument()
      await user.click(more)
      expect(scrollTo).toHaveBeenCalled()
      const [first, second] = rows()
      expect(first).toHaveAccessibleName(/^Show run tg watch \d/)
      expect(second).toHaveAccessibleName(/^Show run tg watch \d/)
      expect(screen.queryByRole("button", { name: /new runs?$/ })).not.toBeInTheDocument()

      added = 3
      expect(await screen.findByRole("button", { name: /^Show run tg watch 2 / })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /new runs?$/ })).not.toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Live" }))
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollTo")
    }
  })
})
