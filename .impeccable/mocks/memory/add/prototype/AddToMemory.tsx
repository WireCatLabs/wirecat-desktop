// cspell:words Northbridge Ortiz Becker
// Design prototype for docs/dev/plans/2026-11-01-memory-add.md. Made-up data, no platform calls, outside `src`.
// `?add=<state>` opens the panel at one state: source, file, link, link-reading, text, image, audio, about, picker,
// extracting, facts, done, and the failures too-big, unreadable, link-fail, no-reader, extract-fail, old.
// `?add=closed` shows the page with the panel closed. The page around the panel is a stand-in for the Memory page
// (version 2, grouped by subject, PR #37), drawn only far enough to show where the panel sits and where the result
// lands.
import {
  AudioLines,
  BookUser,
  Check,
  FileText,
  FolderKanban,
  Globe,
  ImageIcon,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SquareCheckBig,
  Type,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import {
  type ClipboardEvent,
  type DragEvent,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"

type Way = "file" | "link" | "text"
type Kind = "pdf" | "docx" | "text" | "html" | "image" | "audio"
type Source = {
  way: Way
  kind: Kind
  title: string
  name: string
  detail: string
  size?: string
  words: number
  excerpt?: string
}
type Subject = { ref: string; name: string; kind: "person" | "project" | "task"; key?: string }
type Fact = { id: string; kind: "fact" | "task"; text: string; quote: string; where: string }
type Step = "source" | "about" | "facts" | "done"
type Phase = "pick" | "extracting" | "review"
type LinkState = "idle" | "reading" | "read" | "failed"
type Summary = { source: Source; facts: string[]; tasks: string[]; about: Subject[] }

const SUBJECTS: Subject[] = [
  { ref: "project:3", name: "Northbridge Bench", kind: "project", key: "NBB" },
  { ref: "project:5", name: "Harbour launch", kind: "project", key: "HRB" },
  { ref: "person:12", name: "Lena Ortiz", kind: "person" },
  { ref: "person:9", name: "Kai Sample", kind: "person" },
  { ref: "person:17", name: "Tom Becker", kind: "person" },
  { ref: "task:NBB-4", name: "Add 40 Spanish queries to the evaluation set", kind: "task", key: "NBB-4" },
  { ref: "task:NBB-6", name: "Ask Tom Becker for read access to the runner logs", kind: "task", key: "NBB-6" },
]

const RUNBOOK = "https://docs.example.com/northbridge/runbook"
const INTRANET = "https://intranet.example.com/wiki/runner"

const SOURCES: Record<string, Source> = {
  file: {
    way: "file",
    kind: "pdf",
    title: "runner-notes.pdf",
    name: "runner-notes.pdf",
    size: "1.4 MB",
    detail: "PDF · 12 pages · text found on every page",
    words: 4210,
  },
  link: {
    way: "link",
    kind: "html",
    title: "Northbridge Bench runbook",
    name: RUNBOOK,
    detail: "Web page · 2,380 words, as the page reads today",
    words: 2380,
    excerpt:
      "The bench kicks off at 02:00 every night on the shared runner and is usually done by 02:40. Anything under 0.72 on retrieval is a release blocker, no exceptions. Lena takes over the Spanish queries from November.",
  },
  image: {
    way: "file",
    kind: "image",
    title: "whiteboard.jpg",
    name: "whiteboard.jpg",
    size: "3.1 MB",
    detail: "Image · 4032 × 3024 · its words are read only if you ask for facts",
    words: 96,
  },
  audio: {
    way: "file",
    kind: "audio",
    title: "standup-31-oct.m4a",
    name: "standup-31-oct.m4a",
    size: "18.7 MB",
    detail: "Recording · 14 min · turned into text on this computer",
    words: 2050,
  },
}

const TEXT_TITLE = "Call with Lena, 31 Oct"
const TEXT_BODY =
  "Lena takes over the Spanish queries from November and wants 40 more in the evaluation set before the next release.\n\nShe prefers a short written summary after each call, not a meeting."

const FACTS: Fact[] = [
  {
    id: "f1",
    kind: "fact",
    text: "Northbridge Bench runs nightly at 02:00 on the shared runner; a run takes about 40 minutes.",
    quote: "The bench kicks off at 02:00 every night on the shared runner and is usually done by 02:40.",
    where: "page 2",
  },
  {
    id: "f2",
    kind: "fact",
    text: "Lena Ortiz owns the Spanish part of the evaluation set.",
    quote: "Lena takes over the Spanish queries from November.",
    where: "page 5",
  },
  {
    id: "f3",
    kind: "fact",
    text: "A score below 0.72 on the retrieval suite blocks a release of the ranking model.",
    quote: "Anything under 0.72 on retrieval is a release blocker, no exceptions.",
    where: "page 7",
  },
  {
    id: "f4",
    kind: "task",
    text: "Rotate the runner's access token before 15 November.",
    quote: "The runner token expires mid-November; someone needs to rotate it.",
    where: "page 11",
  },
]

const KEPT = ["f1", "f2", "f3"]
const LINKED = SUBJECTS.filter((s) => s.ref === "project:3" || s.ref === "person:12")

const DEMO: Summary = {
  source: SOURCES.file as Source,
  facts: FACTS.filter((f) => KEPT.includes(f.id) && f.kind === "fact").map((f) => f.text),
  tasks: [],
  about: LINKED,
}

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "about", label: "About" },
  { id: "facts", label: "Facts" },
  { id: "done", label: "Saved" },
]

// The model the owner set for suggesting facts (NEED-1 A). Never chosen by the app; unset means the no-reader state.
const READER = "OpenAI"

const param = (name: string) =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name)

const validUrl = (url: string) => /^https?:\/\/[^\s/.]+\.[^\s]+$/i.test(url.trim())
const unreachable = (url: string) => /intranet|localhost/i.test(url)
const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function kindOf(name: string): Kind {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "image"
  if (["m4a", "mp3", "wav", "ogg", "opus", "webm"].includes(ext)) return "audio"
  if (["doc", "docx", "odt"].includes(ext)) return "docx"
  if (["html", "htm"].includes(ext)) return "html"
  if (["txt", "md", "csv"].includes(ext)) return "text"
  return "pdf"
}

const TYPE: Record<Kind, string> = {
  pdf: "PDF",
  docx: "Word document",
  text: "Text",
  html: "Web page",
  image: "Image",
  audio: "Recording",
}

function fromFile(file: File | undefined): Source {
  if (!file) return SOURCES.file as Source
  const kind = kindOf(file.name)
  const mb = file.size / 1_000_000
  return {
    way: "file",
    kind,
    title: file.name,
    name: file.name,
    size: mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1000))} KB`,
    detail: `${TYPE[kind]} · read on this computer`,
    words: 1200,
  }
}

function fromText(title: string, body: string): Source | null {
  const words = wordCount(body)
  if (!words) return null
  const first = body.trim().split("\n")[0] ?? ""
  const name = title.trim() || (first.length > 56 ? `${first.slice(0, 55)}…` : first)
  return {
    way: "text",
    kind: "text",
    title: name,
    name,
    detail: `Text you wrote · ${plural(words, "word", "words")}`,
    words,
  }
}

export function AddToMemoryPrototype() {
  const scenario = param("add")
  const [open, setOpen] = useState(scenario !== null && scenario !== "closed")
  const [saved, setSaved] = useState<Summary | null>(scenario === "done" ? DEMO : null)
  const heading = useRef<HTMLHeadingElement>(null)
  const opened = useRef(open)

  useEffect(() => {
    if (open && !opened.current) heading.current?.focus()
    opened.current = open
  }, [open])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <header className="flex items-end justify-between gap-6">
        <div className="max-w-[44rem]">
          <h1 className="font-display text-[2.1rem] leading-none font-extrabold tracking-[-0.035em] text-ink">
            Memory
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
            What your AI agents concluded about you and the people you talk to, and what you added yourself. Nothing an
            agent writes counts, and nothing it proposes happens, until you approve it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
            Read again
          </Button>
          <Button
            variant={open ? "secondary" : "primary"}
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            aria-expanded={open}
            aria-controls="add-panel"
            onClick={() => (open ? heading.current?.focus() : setOpen(true))}
          >
            Add to memory
          </Button>
        </div>
      </header>

      <div>
        <Collapse open={open} id="add-panel">
          <div className="pb-[1.5rem]">
            <AddPanel
              scenario={scenario}
              heading={heading}
              onClose={() => setOpen(false)}
              onSaved={setSaved}
              onAnother={() => setSaved(null)}
            />
          </div>
        </Collapse>

        <section aria-label="Memory" className="rounded-[0.2rem] border border-line-strong bg-app">
          <Group name="Northbridge Bench" icon={<FolderKanban className="size-4" aria-hidden />} waiting={1} all={3}>
            {saved && (
              <Row
                fresh
                lamp="ok"
                icon={kindIcon(saved.source.kind)}
                kind={`Added by you · ${TYPE[saved.source.kind]} · Today`}
                text={savedLine(saved)}
                time="10:42"
                action="Open"
              />
            )}
            <Row
              lamp="warn"
              icon={<ListChecks className="size-5" aria-hidden />}
              kind="Findings · Today"
              text="2 facts and 2 tasks to review"
              time="00:23"
              action="Approve"
            />
          </Group>
          <Group name="Kai Sample" icon={<UserRound className="size-4" aria-hidden />} waiting={1} all={1}>
            <Row
              lamp="warn"
              icon={<BookUser className="size-5" aria-hidden />}
              kind="Preference · Yesterday"
              text="Kai Sample prefers calls on Friday afternoons and asks for the agenda the evening before."
              time="23:35"
              action="Confirm"
            />
          </Group>
        </section>
      </div>
    </div>
  )
}

function savedLine(s: Summary) {
  const kept = [
    s.facts.length && plural(s.facts.length, "fact", "facts"),
    s.tasks.length && plural(s.tasks.length, "task", "tasks"),
  ]
    .filter(Boolean)
    .join(" and ")
  return kept ? `${s.source.title} · ${kept} your agents use` : `${s.source.title} · in Search`
}

function Group(props: { name: string; icon: ReactNode; waiting: number; all: number; children: ReactNode }) {
  return (
    <div className="border-line not-first:border-t">
      <div className="flex items-center gap-2 px-[1.3rem] py-[0.8rem]">
        <span className="text-ink-soft">{props.icon}</span>
        <span className="font-semibold text-ink">{props.name}</span>
        <Lamp tone="warn" size="sm" label="Waiting for you" />
        <span className="font-mono text-[0.85rem] text-ink-soft">
          {props.waiting} waiting · {props.all} in all
        </span>
      </div>
      {props.children}
    </div>
  )
}

function Row(props: {
  lamp: "ok" | "warn"
  icon: ReactNode
  kind: string
  text: string
  time: string
  action: string
  fresh?: boolean
}) {
  return (
    <div
      className={cx(
        "grid min-h-[4.5rem] grid-cols-[1.4rem_2rem_minmax(0,1fr)_auto_7.6rem] items-center gap-[0.9rem] border-t border-line px-[1.3rem]",
        props.fresh && "reveal bg-brand-soft/40",
      )}
    >
      <Lamp tone={props.lamp} label={props.lamp === "ok" ? "In use" : "Waiting for you"} />
      <span className="text-ink-soft">{props.icon}</span>
      <span className="min-w-0">
        <span className="block text-[0.85rem] text-ink-dim">{props.kind}</span>
        <span className="block truncate text-[0.95rem] font-medium text-ink">{props.text}</span>
      </span>
      <span className="font-mono text-[0.9rem] text-ink-soft">{props.time}</span>
      <Button size="md">{props.action}</Button>
    </div>
  )
}

function stepOf(scenario: string | null): Step {
  if (scenario === "about" || scenario === "no-reader" || scenario === "picker") return "about"
  if (scenario === "extracting" || scenario === "facts" || scenario === "extract-fail") return "facts"
  if (scenario === "done") return "done"
  return "source"
}

function wayOf(scenario: string | null): Way {
  if (scenario?.startsWith("link")) return "link"
  if (fileOf(scenario) || scenario === "too-big" || scenario === "unreadable") return "file"
  return "text"
}

function fileOf(scenario: string | null): Source | null {
  if (scenario === "image" || scenario === "audio") return SOURCES[scenario] ?? null
  return scenario === "file" || stepOf(scenario) !== "source" ? (SOURCES.file ?? null) : null
}

export function AddPanel(props: {
  scenario: string | null
  heading: RefObject<HTMLHeadingElement | null>
  onClose: () => void
  onSaved: (s: Summary) => void
  onAnother: () => void
}) {
  const { scenario } = props
  const [step, setStep] = useState<Step>(stepOf(scenario))
  const [way, setWay] = useState<Way>(wayOf(scenario))
  const [file, setFile] = useState<Source | null>(fileOf(scenario))
  const [url, setUrl] = useState(scenario === "link-fail" ? INTRANET : scenario?.startsWith("link") ? RUNBOOK : "")
  const [link, setLink] = useState<LinkState>(
    scenario === "link"
      ? "read"
      : scenario === "link-reading"
        ? "reading"
        : scenario === "link-fail"
          ? "failed"
          : "idle",
  )
  const [title, setTitle] = useState(scenario === "text" ? TEXT_TITLE : "")
  const [body, setBody] = useState(scenario === "text" ? TEXT_BODY : "")
  const [waitingToGo, setWaitingToGo] = useState(false)
  const [about, setAbout] = useState<Subject[]>(
    stepOf(scenario) === "source" ? [] : scenario === "picker" ? LINKED.slice(0, 1) : LINKED,
  )
  const [suggest, setSuggest] = useState(scenario !== "no-reader")
  const [phase, setPhase] = useState<Phase>(
    scenario === "extracting" ? "extracting" : scenario === "facts" ? "review" : "pick",
  )
  const [kept, setKept] = useState<string[]>(KEPT)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Summary | null>(scenario === "done" ? DEMO : null)

  const source =
    way === "file"
      ? file
      : way === "link"
        ? link === "read"
          ? { ...(SOURCES.link as Source), name: url.trim() }
          : null
        : fromText(title, body)
  const ready = way === "file" ? Boolean(file) : way === "link" ? validUrl(url) && link !== "failed" : Boolean(source)

  useEffect(() => {
    if (link !== "reading" || scenario === "link-reading") return
    const t = setTimeout(() => setLink(unreachable(url) ? "failed" : "read"), 1500)
    return () => clearTimeout(t)
  }, [link, url, scenario])

  useEffect(() => {
    if (!waitingToGo || link === "reading") return
    setWaitingToGo(false)
    if (link === "read") setStep("about")
  }, [waitingToGo, link])

  useEffect(() => {
    if (phase !== "extracting" || scenario === "extracting") return
    const t = setTimeout(() => setPhase("review"), 2600)
    return () => clearTimeout(t)
  }, [phase, scenario])

  const textOf = (f: Fact) => texts[f.id] ?? f.text
  const summary = (withFacts: boolean): Summary | null =>
    source && {
      source,
      facts: withFacts ? FACTS.filter((f) => kept.includes(f.id) && f.kind === "fact").map(textOf) : [],
      tasks: withFacts ? FACTS.filter((f) => kept.includes(f.id) && f.kind === "task").map(textOf) : [],
      about,
    }
  const finish = (withFacts: boolean) => {
    const s = summary(withFacts)
    setDone(s)
    setStep("done")
    if (s) props.onSaved(s)
  }

  const next = () => {
    if (way !== "link" || link === "read") return setStep("about")
    if (link === "idle") setLink("reading")
    setWaitingToGo(true)
  }

  const save = () => {
    if (!suggest) return finish(false)
    setStep("facts")
    setPhase("extracting")
  }

  if (scenario === "old") {
    return (
      <PanelFrame heading={props.heading} step={null} onClose={props.onClose}>
        <div className="flex items-start gap-3">
          <Lamp tone="warn" label="Update needed" />
          <div className="flex flex-col gap-2">
            <p className="font-medium text-ink">Adding to memory needs an update</p>
            <p className="max-w-[60ch] text-[0.95rem] text-ink-soft">
              The memory installed on this computer can keep messages, mail and notes, but not a single file, a link or
              a recording yet. The next release can.
            </p>
            <div className="mt-1 flex gap-2">
              <Button variant="primary">Update</Button>
              <Button variant="ghost" onClick={props.onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </PanelFrame>
    )
  }

  return (
    <PanelFrame
      heading={props.heading}
      step={{ index: STEPS.findIndex((s) => s.id === step), failed: scenario === "extract-fail" }}
      promise={step === "source"}
      onClose={props.onClose}
    >
      <AutoHeight swap={`${step}-${phase}`}>
        <div key={`${step}-${phase}`} className="step-in flex flex-col gap-[1.1rem]">
          {step === "source" && (
            <SourceStep
              scenario={scenario}
              way={way}
              onWay={setWay}
              file={file}
              onFile={setFile}
              url={url}
              onUrl={(u) => {
                setUrl(u)
                setLink("idle")
              }}
              link={link}
              onRead={(u = url) => validUrl(u) && setLink("reading")}
              linkSource={way === "link" ? source : null}
              title={title}
              onTitle={setTitle}
              body={body}
              onBody={setBody}
              ready={ready}
              going={waitingToGo}
              onNext={next}
              onCancel={props.onClose}
            />
          )}
          {step === "about" && source && (
            <AboutStep
              source={source}
              about={about}
              onAbout={setAbout}
              openPicker={scenario === "picker"}
              suggest={suggest}
              onSuggest={setSuggest}
              noReader={scenario === "no-reader"}
              onBack={() => setStep("source")}
              onSave={save}
            />
          )}
          {step === "facts" && source && (
            <FactsStep
              source={source}
              about={about}
              phase={phase}
              failed={scenario === "extract-fail"}
              kept={kept}
              onKept={setKept}
              textOf={textOf}
              onText={(id, text) => setTexts({ ...texts, [id]: text })}
              onKeep={() => finish(true)}
              onSourceOnly={() => finish(false)}
            />
          )}
          {step === "done" && done && (
            <DoneStep
              summary={done}
              onAnother={() => {
                setStep("source")
                setFile(null)
                setUrl("")
                setLink("idle")
                setTitle("")
                setBody("")
                setAbout([])
                setKept(KEPT)
                setTexts({})
                setDone(null)
                setPhase("pick")
                props.onAnother()
              }}
              onClose={props.onClose}
            />
          )}
        </div>
      </AutoHeight>
    </PanelFrame>
  )
}

function PanelFrame(props: {
  heading: RefObject<HTMLHeadingElement | null>
  step: { index: number; failed: boolean } | null
  promise?: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby="add-title"
      className="flex flex-col gap-[1.2rem] rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] pt-[1.1rem] pb-[1.3rem]"
    >
      <div className={cx("flex justify-between gap-4", props.promise ? "items-start" : "items-center")}>
        <div className="min-w-0">
          <h2
            id="add-title"
            ref={props.heading}
            tabIndex={-1}
            className="text-[1.08rem] font-semibold text-ink outline-offset-4"
          >
            Add to memory
          </h2>
          {props.promise && (
            <p className="mt-1 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-soft">
              Your agents will use what is in it when they answer you. You can find it later in Search, even if you
              don’t remember the exact words.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {props.step && <StepLine index={props.step.index} failed={props.step.failed} />}
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-[0.35rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {props.children}
    </section>
  )
}

function StepLine({ index, failed }: { index: number; failed: boolean }) {
  const current = STEPS[index]
  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <ol className="flex items-center gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={cx(
              "h-[4px] w-[1.1rem] rounded-full transition-colors duration-500",
              i === index && failed ? "bg-bad" : i <= index ? "bg-brand" : "bg-line-strong",
            )}
          />
        ))}
      </ol>
      <span className={cx("text-[0.85rem] whitespace-nowrap", failed ? "text-bad" : "text-ink-soft")}>
        <span className={cx("font-medium", failed ? "text-bad" : "text-ink")}>{current?.label}</span>
        <span className="font-mono">
          {" "}
          · {index + 1} of {STEPS.length}
        </span>
        {failed && <span className="sr-only"> (failed)</span>}
      </span>
    </div>
  )
}

const WAYS: { value: Way; label: string; hint: string; icon: ReactNode }[] = [
  {
    value: "text",
    label: "Text",
    hint: "Notes from a call, a decision",
    icon: <Type className="size-5" aria-hidden />,
  },
  {
    value: "link",
    label: "Link",
    hint: "A web page or a public document",
    icon: <Link2 className="size-5" aria-hidden />,
  },
  {
    value: "file",
    label: "File",
    hint: "A document, an image or a recording",
    icon: <Upload className="size-5" aria-hidden />,
  },
]

function SourceStep(props: {
  scenario: string | null
  way: Way
  onWay: (w: Way) => void
  file: Source | null
  onFile: (s: Source | null) => void
  url: string
  onUrl: (u: string) => void
  link: LinkState
  onRead: () => void
  linkSource: Source | null
  title: string
  onTitle: (t: string) => void
  body: string
  onBody: (b: string) => void
  ready: boolean
  going: boolean
  onNext: () => void
  onCancel: () => void
}) {
  const name = useId()
  const hint = useId()
  return (
    <>
      <div className="grid gap-[1.1rem] md:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)]">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[0.95rem] font-medium text-ink">What do you want to add?</legend>
          {WAYS.map((w) => (
            <label key={w.value} className="relative block">
              <input
                type="radio"
                name={name}
                value={w.value}
                checked={props.way === w.value}
                onChange={() => props.onWay(w.value)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-[0.45rem] border px-[0.8rem] py-[0.7rem] transition-colors duration-150",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                  props.way === w.value
                    ? "border-brand bg-brand-soft/50"
                    : "border-line bg-app hover:border-line-strong hover:bg-app-2",
                )}
              >
                <span
                  className={cx(
                    "grid size-9 shrink-0 place-items-center rounded-[0.35rem] transition-colors duration-150",
                    props.way === w.value ? "bg-brand text-brand-ink" : "bg-app-3 text-ink-soft",
                  )}
                >
                  {w.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[1rem] font-semibold text-ink">{w.label}</span>
                  <span className="block text-[0.85rem] leading-snug text-ink-soft">{w.hint}</span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <Pane swap={props.way}>
          {props.way === "file" ? (
            props.file ? (
              <SourceCard source={props.file} onChange={() => props.onFile(null)} />
            ) : (
              <DropZone scenario={props.scenario} onPick={props.onFile} />
            )
          ) : props.way === "link" ? (
            <LinkField
              url={props.url}
              onUrl={props.onUrl}
              state={props.link}
              onRead={props.onRead}
              source={props.linkSource}
            />
          ) : (
            <TextField title={props.title} onTitle={props.onTitle} body={props.body} onBody={props.onBody} />
          )}
        </Pane>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {!props.ready && (
          <p id={hint} className="mr-auto text-[0.9rem] text-ink-soft">
            {props.way === "file"
              ? "Choose or drop a file to go on."
              : props.way === "link"
                ? "Paste a link that starts with https:// to go on."
                : "Write or paste some text to go on."}
          </p>
        )}
        <span className="flex gap-2">
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!props.ready || props.going}
            aria-describedby={props.ready ? undefined : hint}
            onClick={props.onNext}
          >
            {props.going ? "Reading the page…" : "Next"}
          </Button>
        </span>
      </div>
    </>
  )
}

/** The input of the chosen way. Switching swaps it in place: the tiles fix the row's height, so nothing below moves,
 * and a short fade from mostly visible marks the change without making the owner wait for it. */
function Pane({ swap, children }: { swap: Way; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `swap` is the trigger; the fade runs when the way changes
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      box.current?.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 120, easing: "ease-out" })
  }, [swap])
  return (
    <div ref={box} className="min-w-0 md:pt-[2.05rem]">
      {children}
    </div>
  )
}

function kindIcon(kind: Kind, cls = "size-5") {
  if (kind === "image") return <ImageIcon className={cls} aria-hidden />
  if (kind === "audio") return <AudioLines className={cls} aria-hidden />
  if (kind === "html") return <Globe className={cls} aria-hidden />
  if (kind === "text") return <Type className={cls} aria-hidden />
  return <FileText className={cls} aria-hidden />
}

function DropZone({ scenario, onPick }: { scenario: string | null; onPick: (s: Source) => void }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    onPick(fromFile(e.dataTransfer.files[0]))
  }
  const failed = scenario === "too-big" || scenario === "unreadable"
  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target; "choose one" inside is the keyboard path */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cx(
          "flex min-h-[11.4rem] flex-col md:min-h-[15.4rem] items-center justify-center gap-3 rounded-[0.45rem] border border-dashed px-6 py-5 text-center transition-colors duration-150",
          over ? "border-brand bg-brand-soft/60" : failed ? "border-bad/60 bg-app" : "border-line-strong bg-app-2/60",
        )}
      >
        <Upload className={cx("size-6", over ? "text-brand" : "text-ink-dim")} aria-hidden />
        <p className="text-[0.95rem] text-ink">
          Drop a file here, or{" "}
          <button
            type="button"
            className="font-medium text-brand underline-offset-2 hover:text-brand-hover hover:underline"
            onClick={() => input.current?.click()}
          >
            choose one
          </button>
        </p>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => onPick(fromFile(e.target.files?.[0]))}
        />
        <p className="max-w-[34ch] text-[0.85rem] text-ink-soft">
          PDF, Word, text and web pages, images, recordings. Up to <span className="font-mono">50 MB</span>.
        </p>
      </div>
      {scenario === "too-big" && (
        <ErrorNotice inline>
          <span className="font-mono">board-meeting.mp4</span> is 212 MB; WireCat takes files up to 50 MB. For a
          recorded meeting, save the audio only: an hour of it is about 30 MB.
        </ErrorNotice>
      )}
      {scenario === "unreadable" && (
        <ErrorNotice inline>
          <span className="font-mono">scan-2019.pdf</span> has no text in it: its pages are pictures. WireCat can still
          keep it, but finds it only by its title and the people you link, until a model reads its words.
        </ErrorNotice>
      )}
    </div>
  )
}

function LinkField(props: {
  url: string
  onUrl: (u: string) => void
  state: LinkState
  onRead: (url?: string) => void
  source: Source | null
}) {
  const id = useId()
  const valid = validUrl(props.url)
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim()
    if (!validUrl(pasted)) return
    e.preventDefault()
    props.onUrl(pasted)
    props.onRead(pasted)
  }
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          props.onRead(props.url)
        }}
      >
        <label htmlFor={id} className="text-[0.9rem] font-medium text-ink-dim">
          Link to a page, a document or an image
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={props.url}
            onChange={(e) => props.onUrl(e.target.value)}
            onPaste={paste}
            placeholder="https://"
            aria-invalid={props.state === "failed" || undefined}
            className={cx(
              "h-[2.4rem] min-w-0 flex-1 rounded-[0.35rem] border bg-app px-[0.625rem] font-mono text-[0.9rem] text-ink placeholder:font-sans placeholder:text-ink-dim focus:border-brand",
              props.state === "failed" ? "border-bad" : "border-line-strong",
            )}
          />
          <Button type="submit" disabled={!valid || props.state === "reading" || props.state === "read"}>
            {props.state === "read" ? "Read" : "Read it"}
          </Button>
        </div>
      </form>

      {props.state === "reading" ? (
        <div className="flex items-start gap-3 rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.8rem]">
          <Lamp tone="busy" label="Reading" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[0.95rem] text-ink">Reading the page…</p>
            <span className="h-3 w-4/5 rounded-[0.2rem] bg-app-3" aria-hidden />
            <span className="h-3 w-3/5 rounded-[0.2rem] bg-app-3" aria-hidden />
          </div>
        </div>
      ) : props.state === "read" && props.source ? (
        <div className="reveal flex gap-3 rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.8rem]">
          <span className="grid size-9 shrink-0 place-items-center rounded-[0.35rem] bg-app-3 text-ink-soft">
            <Globe className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-semibold text-ink">{props.source.title}</p>
            <p className="text-[0.85rem] text-ink-soft">{props.source.detail}</p>
            <p className="selectable mt-2 line-clamp-3 text-[0.9rem] leading-relaxed text-ink-soft">
              “{props.source.excerpt}”
            </p>
          </div>
        </div>
      ) : props.state === "failed" ? (
        <ErrorNotice inline>
          The page answered 401: it needs you signed in. Save it from the browser as a file (HTML or PDF) and add that
          file instead.
        </ErrorNotice>
      ) : (
        <p className="text-[0.85rem] text-ink-soft">
          WireCat opens the link once, from this computer, and keeps the text as it reads today. A page that needs you
          signed in, such as a private Google Doc, cannot be read this way.
        </p>
      )}
    </div>
  )
}

function TextField(props: { title: string; onTitle: (t: string) => void; body: string; onBody: (b: string) => void }) {
  const title = useId()
  const body = useId()
  const words = wordCount(props.body)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={title} className="text-[0.9rem] font-medium text-ink-dim">
          Title <span className="font-normal">(optional)</span>
        </label>
        <input
          id={title}
          value={props.title}
          onChange={(e) => props.onTitle(e.target.value)}
          placeholder="Call with Lena, 31 Oct"
          className="h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink placeholder:text-ink-dim focus:border-brand"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between">
          <label htmlFor={body} className="text-[0.9rem] font-medium text-ink-dim">
            Text
          </label>
          <span className="font-mono text-[0.8rem] text-ink-dim" aria-live="polite">
            {words ? plural(words, "word", "words") : ""}
          </span>
        </span>
        <textarea
          id={body}
          rows={4}
          value={props.body}
          onChange={(e) => props.onBody(e.target.value)}
          placeholder="Paste or write anything: notes from a call, a decision, what someone prefers."
          className="selectable resize-y rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-2 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-dim focus:border-brand"
        />
      </div>
    </div>
  )
}

function SourceCard({ source, onChange }: { source: Source; onChange?: () => void }) {
  return (
    <div className="reveal flex items-center gap-[0.9rem] rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.8rem]">
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.35rem] bg-app-3 text-ink-soft">
        {kindIcon(source.kind)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="selectable block truncate text-[0.95rem] font-semibold text-ink">{source.title}</span>
        <span className="block text-[0.85rem] text-ink-soft">
          {source.detail}
          {source.size && <span className="font-mono"> · {source.size}</span>}
        </span>
      </span>
      {onChange && (
        <Button variant="ghost" size="sm" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  )
}

const KINDS: { kind: Subject["kind"]; label: string }[] = [
  { kind: "person", label: "People" },
  { kind: "project", label: "Projects" },
  { kind: "task", label: "Tasks" },
]

function subjectIcon(kind: Subject["kind"], cls = "size-4") {
  if (kind === "person") return <UserRound className={cls} aria-hidden />
  if (kind === "project") return <FolderKanban className={cls} aria-hidden />
  return <SquareCheckBig className={cls} aria-hidden />
}

function Chip({ subject, onRemove }: { subject: Subject; onRemove?: () => void }) {
  return (
    <span className="reveal inline-flex h-[1.75rem] max-w-full items-center gap-1.5 rounded-[0.3rem] bg-brand-soft pr-1 pl-2 text-[0.9rem] text-ink">
      <span className="text-brand">{subjectIcon(subject.kind, "size-3.5")}</span>
      <span className="truncate">{subject.name}</span>
      {onRemove ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Remove ${subject.name}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          className="grid size-5 place-items-center rounded-[0.25rem] text-ink-soft hover:bg-app hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  )
}

const NONE: Record<Subject["kind"], string> = { person: "No person", project: "No project", task: "No task" }

/** Many-of picker after the app's Combobox (WAI-ARIA list autocomplete), for one kind of subject: focus stays in the
 * field, the list follows it with aria-activedescendant, and chosen items sit as chips in front of the field. */
function SubjectPicker(props: {
  kind: Subject["kind"]
  value: Subject[]
  onChange: (v: Subject[]) => void
  startOpen: boolean
  labelledBy: string
  describedBy: string
}) {
  const base = useId()
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(props.startOpen)
  const [active, setActive] = useState(props.startOpen ? 0 : -1)
  const chosen = new Set(props.value.map((s) => s.ref))
  const typed = query.trim().toLocaleLowerCase()
  const shown = SUBJECTS.filter((s) => s.kind === props.kind && (!typed || s.name.toLocaleLowerCase().includes(typed)))
  const optionId = (s: Subject) => `${base}-${s.ref.replace(":", "-")}`
  const label = KINDS.find((k) => k.kind === props.kind)?.label.toLocaleLowerCase()

  useEffect(() => {
    if (props.startOpen) field.current?.focus()
  }, [props.startOpen])

  useEffect(() => {
    const s = shown[active]
    if (open && s) document.getElementById(optionId(s))?.scrollIntoView?.({ block: "nearest" })
  })

  const toggle = (s: Subject) => {
    props.onChange(chosen.has(s.ref) ? props.value.filter((v) => v.ref !== s.ref) : [...props.value, s])
    setQuery("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const { key } = e
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(key === "ArrowDown" ? 0 : shown.length - 1)
        return
      }
      setActive((a) => {
        if (!shown.length) return -1
        if (key === "ArrowDown") return a + 1 >= shown.length ? 0 : a + 1
        return a <= 0 ? shown.length - 1 : a - 1
      })
    } else if (key === "Enter" && open && shown[active]) {
      e.preventDefault()
      toggle(shown[active] as Subject)
    } else if (key === "Escape") {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      } else if (query) setQuery("")
    } else if (key === "Backspace" && query === "" && props.value.length) {
      props.onChange(props.value.slice(0, -1))
    } else if (key === "Tab") setOpen(false)
  }

  const expanded = open && shown.length > 0
  return (
    <div className="relative min-w-0">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a click on the frame only moves focus to the field */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field inside is the keyboard target */}
      <div
        onClick={() => field.current?.focus()}
        className={cx(
          "flex min-h-[2.4rem] cursor-text flex-wrap items-center gap-1.5 rounded-[0.35rem] border border-line-strong bg-app py-[0.3rem] pr-2 pl-2.5",
          "hover:border-ink-dim/60 focus-within:border-brand",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
        )}
      >
        <Search className="size-4 shrink-0 text-ink-dim" aria-hidden />
        {props.value.map((s) => (
          <Chip key={s.ref} subject={s} onRemove={() => toggle(s)} />
        ))}
        <input
          ref={field}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${base}-list`}
          aria-labelledby={props.labelledBy}
          aria-describedby={props.describedBy}
          aria-activedescendant={expanded && shown[active] ? optionId(shown[active] as Subject) : undefined}
          value={query}
          placeholder={props.value.length ? "Add more" : `Search ${label}`}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          style={{ outline: "none" }}
          className="selectable h-[1.75rem] min-w-[8rem] flex-1 bg-transparent text-[0.95rem] text-ink placeholder:text-ink-dim"
        />
      </div>
      <div
        id={`${base}-list`}
        role="listbox"
        aria-multiselectable
        aria-labelledby={props.labelledBy}
        hidden={!open}
        onMouseDown={(e) => e.preventDefault()}
        className="reveal absolute top-[calc(100%+0.3rem)] right-0 left-0 z-20 max-h-[14rem] overflow-y-auto overscroll-contain rounded-[0.45rem] border border-line bg-app p-1 shadow-panel"
      >
        {!shown.length && (
          <p className="px-2 py-2 text-[0.9rem] text-ink-soft">
            {NONE[props.kind]} matches “{query.trim()}”.
          </p>
        )}
        {shown.map((s, i) => {
          const on = chosen.has(s.ref)
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keys reach options through the combobox field
            <div
              key={s.ref}
              id={optionId(s)}
              role="option"
              tabIndex={-1}
              aria-selected={on}
              onMouseMove={() => i !== active && setActive(i)}
              onClick={() => toggle(s)}
              className={cx(
                "flex min-h-[2.1rem] cursor-pointer items-center gap-2 rounded-[0.3rem] px-2 text-[0.95rem] text-ink",
                i === active && "bg-app-3",
              )}
            >
              <span
                className={cx(
                  "grid size-[1.05rem] shrink-0 place-items-center rounded-[0.25rem] border transition-colors duration-150",
                  on ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-app",
                )}
              >
                {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.key && <span className="font-mono text-[0.85rem] text-ink-dim">{s.key}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AboutStep(props: {
  source: Source
  about: Subject[]
  onAbout: (s: Subject[]) => void
  openPicker: boolean
  suggest: boolean
  onSuggest: (v: boolean) => void
  noReader: boolean
  onBack: () => void
  onSave: () => void
}) {
  const ids = useId()
  const hint = useId()
  const radio = useId()
  const chosen = new Set(props.about.map((s) => s.ref))
  const mentioned = SUBJECTS.filter(
    (s) => ["project:3", "person:12", "person:17"].includes(s.ref) && !chosen.has(s.ref),
  )
  return (
    <>
      <SourceCard source={props.source} />
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-[0.95rem] font-medium text-ink">Who or what is it about?</p>
          <p id={hint} className="text-[0.9rem] text-ink-soft">
            Your agents then recall it when that person, project or task comes up. You can skip this.
          </p>
        </div>
        <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[6rem_minmax(0,1fr)]">
          {KINDS.map((k) => (
            <Fragment key={k.kind}>
              <span
                id={`${ids}-${k.kind}`}
                className="flex items-center gap-1.5 text-[0.9rem] font-medium text-ink-dim md:h-[2.4rem]"
              >
                {subjectIcon(k.kind)}
                {k.label}
              </span>
              <SubjectPicker
                kind={k.kind}
                value={props.about.filter((s) => s.kind === k.kind)}
                onChange={(v) => props.onAbout([...props.about.filter((s) => s.kind !== k.kind), ...v])}
                startOpen={props.openPicker && k.kind === "person"}
                labelledBy={`${ids}-${k.kind}`}
                describedBy={hint}
              />
            </Fragment>
          ))}
        </div>
        {mentioned.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.9rem] text-ink-soft">
            <span>Named in it:</span>
            {mentioned.map((s) => (
              <button
                key={s.ref}
                type="button"
                onClick={() => props.onAbout([...props.about, s])}
                className="inline-flex h-[1.75rem] items-center gap-1 rounded-[0.3rem] border border-line-strong bg-app px-2 text-ink hover:bg-app-2"
              >
                <Plus className="size-3.5 text-ink-dim" aria-hidden />
                {s.name}
              </button>
            ))}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2 md:grid-cols-2">
        <legend className="mb-2 text-[0.95rem] font-medium text-ink">Then</legend>
        <ChoiceTile
          name={radio}
          checked={props.suggest}
          disabled={props.noReader}
          onChange={() => props.onSuggest(true)}
          title="Save it and suggest facts"
        >
          {props.noReader ? (
            "Needs a model for reading, set in Settings."
          ) : (
            <>
              Its text (<span className="font-mono">{props.source.words.toLocaleString("en")}</span> words) goes once to
              your model at <span className="font-medium text-ink">{READER}</span>, with your key. You pick which facts
              to keep.
            </>
          )}
        </ChoiceTile>
        <ChoiceTile name={radio} checked={!props.suggest} onChange={() => props.onSuggest(false)} title="Only save it">
          Nothing leaves this computer. You can still find it in Search and ask for facts later.
        </ChoiceTile>
        {props.noReader && (
          <p className="text-[0.9rem] text-ink-soft md:col-span-2">
            No model is set for suggesting facts. Choose one in{" "}
            <button type="button" className="font-medium text-brand hover:text-brand-hover hover:underline">
              Settings
            </button>
            : a model at OpenAI or Anthropic with your own key, or one running on this computer.
          </p>
        )}
      </fieldset>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={props.onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={props.onSave}>
          {props.suggest ? "Save and suggest facts" : "Save"}
        </Button>
      </div>
    </>
  )
}

function ChoiceTile(props: {
  name: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  title: string
  children: ReactNode
}) {
  return (
    <label
      className={cx(
        "flex gap-3 rounded-[0.45rem] border px-[0.85rem] py-[0.7rem] transition-colors duration-150",
        props.checked ? "border-brand bg-brand-soft/40" : "border-line bg-app hover:border-line-strong",
        props.disabled ? "opacity-55" : "cursor-pointer",
      )}
    >
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        className="mt-[0.2rem] size-[1.05rem] shrink-0 accent-brand"
      />
      <span>
        <span className="block text-[0.95rem] font-medium text-ink">{props.title}</span>
        <span className="block text-[0.85rem] leading-snug text-ink-soft">{props.children}</span>
      </span>
    </label>
  )
}

function FactsStep(props: {
  source: Source
  about: Subject[]
  phase: Phase
  failed: boolean
  kept: string[]
  onKept: (k: string[]) => void
  textOf: (f: Fact) => string
  onText: (id: string, text: string) => void
  onKeep: () => void
  onSourceOnly: () => void
}) {
  const where = props.about.find((s) => s.kind === "project")?.name ?? props.about[0]?.name
  return (
    <>
      <div className="flex items-center gap-3">
        <Lamp tone="ok" label="Saved" />
        <p className="text-[0.95rem] text-ink">
          <span className="font-medium">{props.source.title}</span> is saved in WireCat.
        </p>
      </div>
      {props.failed ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice inline>
            {READER} answered 429, too many requests: your key’s limit is reached for now.
          </ErrorNotice>
          <p className="text-[0.9rem] text-ink-soft">
            The source stays saved. Ask again later from its row, or keep it without facts.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={props.onSourceOnly}>
              Keep without facts
            </Button>
            <Button variant="primary">Try again</Button>
          </div>
        </div>
      ) : props.phase === "extracting" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Lamp tone="busy" label="Working" />
            <div>
              <p className="text-[0.95rem] text-ink">Your model at {READER} is reading it for facts…</p>
              <p className="text-[0.9rem] text-ink-soft">
                Usually under a minute. You can leave this page: the suggestions wait for you
                {where ? ` under ${where}` : " on this page"}.
              </p>
            </div>
          </div>
          <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3 border-line px-[0.9rem] py-[0.85rem] not-first:border-t">
                <span className="size-[1.05rem] shrink-0 rounded-[0.2rem] bg-app-3" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className={cx("h-3.5 rounded-[0.2rem] bg-app-3", i === 1 ? "w-3/5" : "w-4/5")} />
                  <span className="h-3 w-2/5 rounded-[0.2rem] bg-app-3" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Suggestions {...props} where={where} />
      )}
    </>
  )
}

function Suggestions(props: {
  kept: string[]
  onKept: (k: string[]) => void
  textOf: (f: Fact) => string
  onText: (id: string, text: string) => void
  where: string | undefined
  onKeep: () => void
  onSourceOnly: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const on = new Set(props.kept)
  const facts = FACTS.filter((f) => on.has(f.id) && f.kind === "fact").length
  const tasks = FACTS.filter((f) => on.has(f.id) && f.kind === "task").length
  const keeping = [facts && plural(facts, "fact", "facts"), tasks && plural(tasks, "task", "tasks")]
    .filter(Boolean)
    .join(" and ")
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <h3 className="text-[0.95rem] font-medium text-ink">
        Suggested: 3 facts and 1 task.{" "}
        <span className="font-normal text-ink-soft">Each shows the words it comes from. Tick the ones to keep.</span>
      </h3>
      <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
        {FACTS.map((f) => {
          const ticked = on.has(f.id)
          const text = props.textOf(f)
          return (
            <li key={f.id} className="flex gap-[0.75rem] border-line px-[0.9rem] py-[0.75rem] not-first:border-t">
              <input
                type="checkbox"
                checked={ticked}
                aria-label={`Keep: ${text}`}
                onChange={(e) =>
                  props.onKept(e.target.checked ? [...props.kept, f.id] : props.kept.filter((k) => k !== f.id))
                }
                className="mt-[0.25rem] size-[1.05rem] shrink-0 accent-brand"
              />
              <span className={cx("min-w-0 flex-1 transition-opacity duration-150", !ticked && "opacity-55")}>
                <span className="flex items-baseline gap-x-[0.5rem]">
                  <Pill tone={f.kind === "task" ? "brand" : "neutral"}>{f.kind === "task" ? "Task" : "Fact"}</Pill>
                  {editing === f.id ? (
                    <input
                      // biome-ignore lint/a11y/noAutofocus: the field replaces the text the owner just clicked
                      autoFocus
                      defaultValue={text}
                      onBlur={(e) => {
                        props.onText(f.id, e.target.value)
                        setEditing(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur()
                        if (e.key === "Escape") setEditing(null)
                      }}
                      className="h-[1.9rem] min-w-0 flex-1 rounded-[0.35rem] border border-brand bg-app px-2 text-[0.95rem] text-ink"
                    />
                  ) : (
                    <span className="selectable min-w-0 text-[0.95rem] text-ink">{text}</span>
                  )}
                  {editing !== f.id && (
                    <button
                      type="button"
                      aria-label={`Correct: ${text}`}
                      onClick={() => setEditing(f.id)}
                      className="ml-auto grid size-7 shrink-0 place-items-center self-start rounded-[0.35rem] text-ink-dim hover:bg-app-3 hover:text-ink"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                  )}
                </span>
                <span className="mt-[0.3rem] flex flex-wrap items-baseline gap-x-[0.5rem] text-[0.85rem] text-ink-soft">
                  <span className="text-ink-dim">{f.where}</span>
                  <span className="selectable italic">“{f.quote}”</span>
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-[0.9rem] text-ink-soft">
        {keeping
          ? `Keeping ${keeping}${props.where ? `, linked to ${props.where}` : ""}. Your agents use them when they answer you; the rest are dropped.`
          : "Nothing ticked: the source stays saved without facts."}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => props.onKept([])}>
          Untick all
        </Button>
        <Button variant="primary" onClick={keeping ? props.onKeep : props.onSourceOnly}>
          {keeping ? `Keep ${keeping}` : "Keep the source only"}
        </Button>
      </div>
    </div>
  )
}

function DoneStep(props: { summary: Summary; onAnother: () => void; onClose: () => void }) {
  const { source, facts, tasks, about } = props.summary
  const kept = facts.length + tasks.length
  return (
    <>
      <div className="flex items-center gap-3">
        <Lamp tone="ok" label="Saved" />
        <p className="text-[1.02rem] font-semibold text-ink">Saved in WireCat</p>
      </div>
      <dl className="flex flex-col rounded-[0.45rem] border border-line bg-app px-[0.9rem]">
        <DoneRow term="Source">
          <span className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-[0.35rem] bg-app-3 text-ink-soft">
              {kindIcon(source.kind, "size-4")}
            </span>
            <span className="min-w-0">
              <span className="selectable block truncate text-[0.95rem] font-semibold text-ink">{source.title}</span>
              <span className="block truncate text-[0.85rem] text-ink-soft">
                {TYPE[source.kind]}
                {source.size && <span className="font-mono"> · {source.size}</span>}
                {source.way === "link" && <span className="font-mono"> · {source.name}</span>}
              </span>
            </span>
          </span>
        </DoneRow>
        <DoneRow term={kept ? `Kept (${kept})` : "Facts"}>
          {kept ? (
            <ul className="flex flex-col gap-1.5">
              {[...facts.map((t) => ({ t, task: false })), ...tasks.map((t) => ({ t, task: true }))].map(
                ({ t, task }) => (
                  <li key={t} className="flex items-baseline gap-2 text-[0.95rem] text-ink">
                    <Pill tone={task ? "brand" : "neutral"}>{task ? "Task" : "Fact"}</Pill>
                    <span className="selectable min-w-0">{t}</span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="text-[0.95rem] text-ink-soft">None yet. Ask for facts from its row whenever you like.</p>
          )}
        </DoneRow>
        <DoneRow term="Linked to">
          {about.length ? (
            <span className="flex flex-wrap gap-1.5">
              {about.map((s) => (
                <Chip key={s.ref} subject={s} />
              ))}
            </span>
          ) : (
            <p className="text-[0.95rem] text-ink-soft">Nobody yet. You can link it from its row.</p>
          )}
        </DoneRow>
      </dl>
      <p className="max-w-[72ch] text-[0.9rem] leading-relaxed text-ink-soft">
        {kept
          ? `Your agents use ${kept === 1 ? "this" : "these"} when they answer you.`
          : "Your agents can read it when they answer you."}{" "}
        You can find it later in Search, even if you don’t remember the exact words.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Search className="size-4" aria-hidden />}>
            Find it in Search
          </Button>
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={props.onAnother}>
            Add another
          </Button>
        </span>
        <Button variant="primary" onClick={props.onClose}>
          Done
        </Button>
      </div>
    </>
  )
}

function DoneRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-line py-[0.75rem] not-first:border-t md:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="pt-[0.1rem] text-[0.85rem] font-medium text-ink-dim">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
