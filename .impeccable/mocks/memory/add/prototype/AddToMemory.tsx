// cspell:words Northbridge Ortiz Becker
// Design prototype for docs/dev/plans/2026-11-01-memory-add.md. Made-up data, no platform calls, outside `src`.
// `?add=<state>` opens the panel at one state: source, file, link, text, image, audio, about, picker, extracting, facts, done,
// and the failures too-big, unreadable, link-fail, no-reader, extract-fail, old. Without it the page shows the
// "Add to memory" button with the panel closed. The page around the panel is a stand-in for the Memory page
// (version 2, grouped by subject, PR #37), drawn only far enough to show where the panel sits and where the result
// lands.
import {
  AudioLines,
  BookUser,
  Check,
  Database,
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
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { type StepState, Stepper } from "@/ui/Stepper"

type Way = "file" | "link" | "text"
type Kind = "pdf" | "docx" | "text" | "html" | "image" | "audio"
type Source = { way: Way; kind: Kind; name: string; size?: string; detail: string; words: number }
type Subject = { ref: string; name: string; kind: "person" | "project" | "task"; key?: string }
type Fact = { id: string; kind: "fact" | "task"; text: string; quote: string; where: string }
type Step = "source" | "about" | "facts" | "done"
type Phase = "pick" | "extracting" | "review"

const SUBJECTS: Subject[] = [
  { ref: "project:3", name: "Northbridge Bench", kind: "project", key: "NBB" },
  { ref: "project:5", name: "Harbour launch", kind: "project", key: "HRB" },
  { ref: "person:12", name: "Lena Ortiz", kind: "person" },
  { ref: "person:9", name: "Kai Sample", kind: "person" },
  { ref: "person:17", name: "Tom Becker", kind: "person" },
  { ref: "task:NBB-4", name: "Add 40 Spanish queries to the evaluation set", kind: "task", key: "NBB-4" },
  { ref: "task:NBB-6", name: "Ask Tom Becker for read access to the runner logs", kind: "task", key: "NBB-6" },
]

const SOURCES: Record<string, Source> = {
  file: {
    way: "file",
    kind: "pdf",
    name: "runner-notes.pdf",
    size: "1.4 MB",
    detail: "PDF · 12 pages · text found on every page",
    words: 4210,
  },
  link: {
    way: "link",
    kind: "html",
    name: "https://docs.example.com/northbridge/runbook",
    detail: "Web page · “Northbridge Bench runbook” · text taken from the page as it is today",
    words: 2380,
  },
  text: {
    way: "text",
    kind: "text",
    name: "Call with Lena, 31 Oct",
    detail: "Text you wrote · 3 paragraphs",
    words: 312,
  },
  image: {
    way: "file",
    kind: "image",
    name: "whiteboard.jpg",
    size: "3.1 MB",
    detail: "Image · 4032 × 3024 · kept as it is; its words are read only if you ask for facts",
    words: 96,
  },
  audio: {
    way: "file",
    kind: "audio",
    name: "standup-31-oct.m4a",
    size: "18.7 MB",
    detail: "Audio · 14 min · turned into text on this computer",
    words: 2050,
  },
}

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

const param = (name: string) =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name)

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "about", label: "About" },
  { id: "facts", label: "Facts" },
  { id: "done", label: "Saved" },
]

// The model the owner set for Memo's analysis (NEED-1 A). Never chosen by the app; unset means the no-reader state.
const READER = "OpenAI"

export function AddToMemoryPrototype() {
  const scenario = param("add")
  const [open, setOpen] = useState(scenario !== null)
  const [saved, setSaved] = useState(scenario === "done")
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
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            aria-expanded={open}
            aria-controls="add-panel"
            onClick={() => setOpen(true)}
            disabled={open}
          >
            Add to memory
          </Button>
        </div>
      </header>

      <section className="rounded-[0.2rem] border border-line-strong bg-app">
        <Collapse open={open} id="add-panel">
          <AddPanel
            initial={scenario}
            onClose={() => setOpen(false)}
            onSaved={() => setSaved(true)}
            onAnother={() => setSaved(false)}
          />
        </Collapse>
        <Group name="Northbridge Bench" icon={<FolderKanban className="size-4" aria-hidden />} waiting={1} all={3}>
          {saved && (
            <Row
              fresh
              lamp="ok"
              icon={<FileText className="size-5" aria-hidden />}
              kind="Source · Today"
              text="runner-notes.pdf · 3 facts kept · searchable"
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
  )
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

function sourceOf(scenario: string | null): Source | null {
  if (scenario === null || scenario === "source" || scenario === "old") return null
  if (scenario === "too-big" || scenario === "unreadable") return null
  if (scenario === "link-fail") return null
  return SOURCES[scenario] ?? SOURCES.file ?? null
}

function AddPanel(props: { initial: string | null; onClose: () => void; onSaved: () => void; onAnother: () => void }) {
  const scenario = props.initial
  const [step, setStep] = useState<Step>(stepOf(scenario))
  const [source, setSource] = useState<Source | null>(sourceOf(scenario))
  const [way, setWay] = useState<Way>(
    scenario === "link" || scenario === "link-fail" ? "link" : scenario === "text" ? "text" : "file",
  )
  const [about, setAbout] = useState<Subject[]>(
    step === "source" || scenario === "picker" ? [] : SUBJECTS.filter((s) => s.ref === "project:3" || s.ref === "person:12"),
  )
  const [suggest, setSuggest] = useState(scenario !== "no-reader")
  const [phase, setPhase] = useState<Phase>(
    scenario === "extracting" ? "extracting" : scenario === "facts" ? "review" : "pick",
  )
  const [kept, setKept] = useState<string[]>(FACTS.filter((f) => f.id !== "f4").map((f) => f.id))
  const index = STEPS.findIndex((s) => s.id === step)
  const steps = STEPS.map((s, i) => ({
    label: s.label,
    state: (scenario === "extract-fail" && s.id === "facts"
      ? "failed"
      : i < index || step === "done"
        ? "done"
        : i === index
          ? "active"
          : "todo") as StepState,
  }))

  useEffect(() => {
    if (phase !== "extracting" || scenario === "extracting") return
    const t = setTimeout(() => setPhase("review"), 2600)
    return () => clearTimeout(t)
  }, [phase, scenario])

  const save = () => {
    if (!suggest) {
      setStep("done")
      props.onSaved()
      return
    }
    setStep("facts")
    setPhase("extracting")
  }

  if (scenario === "old") {
    return (
      <PanelFrame onClose={props.onClose}>
        <div className="flex items-start gap-3">
          <Lamp tone="warn" label="Update needed" />
          <div className="flex flex-col gap-2">
            <p className="font-medium text-ink">Adding to memory needs a newer Memo</p>
            <p className="max-w-[60ch] text-[0.95rem] text-ink-soft">
              The installed Memo is <span className="font-mono text-ink">0.131.3</span>. Saving one file, a link or a
              recording, and suggesting facts from it, needs a Memo that is not released yet.
            </p>
            <div className="mt-1 flex gap-2">
              <Button variant="primary">Update Memo</Button>
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
    <PanelFrame onClose={props.onClose}>
      <div className="mx-auto w-full max-w-[34rem]">
        <Stepper steps={steps} />
      </div>
      <AutoHeight swap={`${step}-${phase}`}>
        <div key={`${step}-${phase}`} className="step-in flex flex-col gap-[1.1rem]">
          {step === "source" && (
            <SourceStep
              scenario={scenario}
              way={way}
              onWay={setWay}
              source={source}
              onSource={setSource}
              onNext={() => setStep("about")}
              onCancel={props.onClose}
            />
          )}
          {step === "about" && source && (
            <AboutStep
              source={source}
              about={about}
              onAbout={setAbout}
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
              onKeep={() => {
                setStep("done")
                props.onSaved()
              }}
            />
          )}
          {step === "done" && source && (
            <DoneStep
              source={source}
              about={about}
              facts={suggest ? kept.length : 0}
              onAnother={() => {
                setStep("source")
                setSource(null)
                setAbout([])
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

function PanelFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-[1.4rem] bg-app-2/60 px-[1.3rem] py-[1.4rem]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[1.08rem] font-semibold text-ink">Add to memory</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-[0.35rem] text-ink-dim hover:bg-app-3 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  )
}

function StoredNote() {
  return (
    <p className="flex items-start gap-2 text-[0.9rem] text-ink-soft">
      <Database className="mt-[0.2rem] size-4 shrink-0 text-ink-dim" aria-hidden />
      <span>
        The source will be stored in Memo’s database on this computer and be searchable too: in Search, and by your
        agents when they look something up.
      </span>
    </p>
  )
}

const WAYS: { value: Way; label: string; icon: ReactNode }[] = [
  { value: "file", label: "File", icon: <Upload className="size-4" aria-hidden /> },
  { value: "link", label: "Link", icon: <Link2 className="size-4" aria-hidden /> },
  { value: "text", label: "Text", icon: <Type className="size-4" aria-hidden /> },
]

function SourceStep(props: {
  scenario: string | null
  way: Way
  onWay: (w: Way) => void
  source: Source | null
  onSource: (s: Source | null) => void
  onNext: () => void
  onCancel: () => void
}) {
  const name = useId()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.95rem] text-ink">What do you want Memo to keep?</p>
        <fieldset className="flex rounded-[0.45rem] bg-app-3 p-[3px]">
          <legend className="sr-only">Kind of source</legend>
          {WAYS.map((w) => (
            <label key={w.value} className="relative">
              <input
                type="radio"
                name={name}
                value={w.value}
                checked={props.way === w.value}
                onChange={() => {
                  props.onWay(w.value)
                  props.onSource(null)
                }}
                className="peer sr-only"
              />
              <span className="flex h-[1.9rem] cursor-pointer items-center gap-1.5 rounded-[0.35rem] px-3 text-[0.9rem] text-ink-soft transition-colors duration-150 peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand hover:text-ink">
                {w.icon}
                {w.label}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      {props.source ? (
        <SourceCard source={props.source} onChange={() => props.onSource(null)} />
      ) : props.way === "file" ? (
        <DropZone scenario={props.scenario} onPick={props.onSource} />
      ) : props.way === "link" ? (
        <LinkField failed={props.scenario === "link-fail"} onRead={() => props.onSource(SOURCES.link ?? null)} />
      ) : (
        <TextField onDone={() => props.onSource(SOURCES.text ?? null)} />
      )}

      <StoredNote />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!props.source} onClick={props.onNext}>
          Next
        </Button>
      </div>
    </>
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
    onPick(SOURCES.file as Source)
  }
  const tooBig = scenario === "too-big"
  const unreadable = scenario === "unreadable"
  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cx(
          "flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-[0.45rem] border border-dashed px-6 py-6 text-center transition-colors duration-150",
          over ? "border-brand bg-brand-soft/60" : "border-line-strong bg-app",
          (tooBig || unreadable) && "border-bad/60",
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
        <input ref={input} type="file" className="sr-only" tabIndex={-1} onChange={() => onPick(SOURCES.file as Source)} />
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.85rem] text-ink-soft">
          <li className="flex items-center gap-1.5">
            <FileText className="size-3.5" aria-hidden /> PDF, Word, text, Markdown, HTML
          </li>
          <li className="flex items-center gap-1.5">
            <ImageIcon className="size-3.5" aria-hidden /> Images
          </li>
          <li className="flex items-center gap-1.5">
            <AudioLines className="size-3.5" aria-hidden /> Audio
          </li>
          <li className="font-mono">up to 50 MB</li>
        </ul>
      </div>
      {tooBig && (
        <ErrorNotice inline>
          <span className="font-mono">board-meeting.mp4</span> is 212 MB. Memo reads files up to 50 MB. For a recorded
          meeting, save the audio only: an hour of it is about 30 MB.
        </ErrorNotice>
      )}
      {unreadable && (
        <ErrorNotice inline>
          <span className="font-mono">scan-2019.pdf</span> has no text in it: its pages are pictures. Memo can still
          keep it, but finds it only by its title and the people you link, until a model reads its words.
        </ErrorNotice>
      )}
    </div>
  )
}

function LinkField({ failed, onRead }: { failed: boolean; onRead: () => void }) {
  const id = useId()
  const [url, setUrl] = useState(failed ? "https://intranet.example.com/wiki/runner" : "")
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.9rem] font-medium text-ink-dim">
        Link to a page, a document or an image
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className={cx(
            "h-[2.4rem] min-w-0 flex-1 rounded-[0.35rem] border bg-app px-[0.625rem] font-mono text-[0.9rem] text-ink placeholder:font-sans placeholder:text-ink-dim",
            failed ? "border-bad" : "border-line-strong",
          )}
        />
        <Button onClick={onRead} disabled={!url && !failed}>
          Read it
        </Button>
      </div>
      {failed ? (
        <ErrorNotice inline>
          The page answered 401: it needs you signed in. Save it from the browser as a file (HTML or PDF) and drop that
          here instead.
        </ErrorNotice>
      ) : (
        <p className="text-[0.85rem] text-ink-soft">
          Memo opens the link once, from this computer, and keeps the text as it is today. A page that needs you
          signed in, such as a private Google Doc, cannot be read this way.
        </p>
      )}
    </div>
  )
}

function TextField({ onDone }: { onDone: () => void }) {
  const title = useId()
  const body = useId()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={title} className="text-[0.9rem] font-medium text-ink-dim">
          Title
        </label>
        <input
          id={title}
          placeholder="Call with Lena, 31 Oct"
          className="h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink placeholder:text-ink-dim"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={body} className="text-[0.9rem] font-medium text-ink-dim">
          Text
        </label>
        <textarea
          id={body}
          rows={5}
          onBlur={(e) => e.target.value && onDone()}
          placeholder="Paste or write anything: notes from a call, a decision, what someone prefers."
          className="resize-y rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-2 text-[0.95rem] leading-relaxed text-ink placeholder:text-ink-dim"
        />
      </div>
    </div>
  )
}

function SourceCard({ source, onChange }: { source: Source; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-[0.9rem] rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.8rem]">
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.35rem] bg-app-3 text-ink-soft">
        {kindIcon(source.kind)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="selectable block truncate font-mono text-[0.9rem] text-ink">{source.name}</span>
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

function subjectIcon(kind: Subject["kind"]) {
  if (kind === "person") return <UserRound className="size-4" aria-hidden />
  if (kind === "project") return <FolderKanban className="size-4" aria-hidden />
  return <SquareCheckBig className="size-4" aria-hidden />
}

function AboutStep(props: {
  source: Source
  about: Subject[]
  onAbout: (s: Subject[]) => void
  suggest: boolean
  onSuggest: (v: boolean) => void
  noReader: boolean
  onBack: () => void
  onSave: () => void
}) {
  const id = useId()
  const radio = useId()
  const [query, setQuery] = useState(props.about.length ? "" : "or")
  const [focused, setFocused] = useState(!props.about.length)
  const chosen = new Set(props.about.map((s) => s.ref))
  const matches = SUBJECTS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) && query.length > 0)
  const results = KINDS.flatMap((k) => matches.filter((s) => s.kind === k.kind))
  const mentioned = SUBJECTS.filter((s) => ["project:3", "person:12", "person:17"].includes(s.ref) && !chosen.has(s.ref))
  const toggle = (s: Subject) =>
    props.onAbout(chosen.has(s.ref) ? props.about.filter((a) => a.ref !== s.ref) : [...props.about, s])
  return (
    <>
      <SourceCard source={props.source} />
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-[0.95rem] text-ink">
          Who or what is it about?{" "}
          <span className="text-ink-soft">Facts from it will be filed there. You can skip this.</span>
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-dim" />
          <input
            id={id}
            role="combobox"
            aria-expanded={focused && results.length > 0}
            aria-controls={`${id}-list`}
            value={query}
            onFocus={() => setFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A person, a project or a task"
            className="h-[2.4rem] w-full rounded-[0.35rem] border border-line-strong bg-app pr-[0.625rem] pl-8 text-[0.95rem] text-ink placeholder:text-ink-dim"
          />
          {focused && results.length > 0 && (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-multiselectable
              className="reveal absolute top-[calc(100%+0.3rem)] right-0 left-0 z-20 flex flex-col rounded-[0.45rem] border border-line-strong bg-app p-1 shadow-panel"
            >
              {results.map((s, i) => [
                results[i - 1]?.kind !== s.kind && (
                  <li
                    key={`${s.kind}-head`}
                    role="presentation"
                    className="px-2 pt-1.5 pb-0.5 text-[0.85rem] font-medium text-ink-dim"
                  >
                    {KINDS.find((k) => k.kind === s.kind)?.label}
                  </li>
                ),
                <li
                  key={s.ref}
                  role="option"
                  aria-selected={chosen.has(s.ref)}
                  tabIndex={-1}
                  onClick={() => toggle(s)}
                  onKeyDown={(e) => e.key === "Enter" && toggle(s)}
                  className={cx(
                    "flex min-h-[2.1rem] cursor-pointer items-center gap-2 rounded-[0.35rem] px-2 text-[0.95rem] text-ink hover:bg-app-3",
                    i === 0 && "bg-app-3",
                  )}
                >
                  <span className="text-ink-soft">{subjectIcon(s.kind)}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.key && <span className="font-mono text-[0.85rem] text-ink-dim">{s.key}</span>}
                  <Check className={cx("size-4 text-brand", !chosen.has(s.ref) && "invisible")} aria-hidden />
                </li>,
              ])}
            </ul>
          )}
        </div>
        {props.about.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Chosen">
            {props.about.map((s) => (
              <li
                key={s.ref}
                className="reveal flex h-[1.9rem] items-center gap-1.5 rounded-[0.35rem] bg-brand-soft pr-1 pl-2 text-[0.9rem] text-ink"
              >
                <span className="text-brand">{subjectIcon(s.kind)}</span>
                {s.name}
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => toggle(s)}
                  className="grid size-6 place-items-center rounded-[0.3rem] text-ink-soft hover:bg-app hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {mentioned.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.9rem] text-ink-soft">
            <span>Named in it:</span>
            {mentioned.map((s) => (
              <button
                key={s.ref}
                type="button"
                onClick={() => toggle(s)}
                className="inline-flex h-[1.75rem] items-center gap-1 rounded-[0.35rem] border border-line-strong bg-app px-2 text-ink hover:bg-app-2"
              >
                <Plus className="size-3.5 text-ink-dim" aria-hidden />
                {s.name}
              </button>
            ))}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2 rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.8rem]">
        <legend className="sr-only">After saving</legend>
        <label className={cx("flex gap-3", props.noReader && "opacity-55")}>
          <input
            type="radio"
            name={radio}
            checked={props.suggest}
            disabled={props.noReader}
            onChange={() => props.onSuggest(true)}
            className="mt-[0.3rem] size-[1.05rem] shrink-0 accent-brand"
          />
          <span>
            <span className="block text-[0.95rem] text-ink">Save it and suggest facts from it</span>
            <span className="block text-[0.9rem] text-ink-soft">
              {props.noReader ? (
                "Memo would send the text to a model you choose in Settings."
              ) : (
                <>
              Memo sends the text (
              <span className="font-mono">{props.source.words.toLocaleString("en")}</span> words) to the model you set
              in Settings, at <span className="font-medium text-ink">{READER}</span>, with your key. It suggests a few
              facts; you pick which to keep.
                </>
              )}
            </span>
          </span>
        </label>
        <label className="flex gap-3">
          <input
            type="radio"
            name={radio}
            checked={!props.suggest}
            onChange={() => props.onSuggest(false)}
            className="mt-[0.3rem] size-[1.05rem] shrink-0 accent-brand"
          />
          <span>
            <span className="block text-[0.95rem] text-ink">Only save it</span>
            <span className="block text-[0.9rem] text-ink-soft">
              Nothing leaves this computer. It is still searchable, and you can ask for facts later.
            </span>
          </span>
        </label>
        {props.noReader && (
          <p className="mt-1 border-t border-line pt-2 text-[0.9rem] text-ink-soft">
            No model is set for suggesting facts. Choose one in{" "}
            <button type="button" className="font-medium text-brand hover:text-brand-hover hover:underline">
              Settings
            </button>
            : a model at OpenAI or Anthropic with your own key, or one running on this computer. The source is saved
            either way and can be read later.
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

function FactsStep(props: {
  source: Source
  about: Subject[]
  phase: Phase
  failed: boolean
  kept: string[]
  onKept: (k: string[]) => void
  onKeep: () => void
}) {
  const where = props.about.find((s) => s.kind === "project")?.name ?? "your memory"
  return (
    <>
      <div className="flex items-start gap-3">
        <Lamp tone="ok" label="Saved" />
        <p className="text-[0.95rem] text-ink">
          <span className="font-mono">{props.source.name}</span> is saved and searchable.
        </p>
      </div>
      {props.failed ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice inline>
            {READER} answered 429, too many requests: the key’s limit is reached for now.
          </ErrorNotice>
          <p className="text-[0.9rem] text-ink-soft">
            The source stays saved. Ask again later from its row, or keep it without facts.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost">Keep without facts</Button>
            <Button>Try again</Button>
          </div>
        </div>
      ) : props.phase === "extracting" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Lamp tone="busy" label="Working" />
            <div>
              <p className="text-[0.95rem] text-ink">
                The model at {READER} is reading it for facts…
              </p>
              <p className="text-[0.9rem] text-ink-soft">
                Usually under a minute. You can leave this page: the suggestions will wait in Review under {where}.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-0 rounded-[0.45rem] border border-line bg-app" aria-hidden>
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
        <Suggestions kept={props.kept} onKept={props.onKept} where={where} onKeep={props.onKeep} />
      )}
    </>
  )
}

function Suggestions(props: { kept: string[]; onKept: (k: string[]) => void; where: string; onKeep: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const on = new Set(props.kept)
  const facts = props.kept.filter((id) => FACTS.find((f) => f.id === id)?.kind === "fact").length
  const tasks = props.kept.length - facts
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">
        The model suggests 3 facts and 1 task, each with the words it rests on. Tick the ones to keep.
      </h3>
      <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
        {FACTS.map((f) => {
          const ticked = on.has(f.id)
          const text = texts[f.id] ?? f.text
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
                        setTexts({ ...texts, [f.id]: e.target.value })
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
        {props.kept.length === 0
          ? "Nothing ticked: the source stays saved without facts."
          : `Keeping ${facts} ${facts === 1 ? "fact" : "facts"}${tasks ? ` and ${tasks} task` : ""} in ${props.where}. They count as yours: agents use them at once. The rest are dropped.`}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => props.onKept([])}>
          Untick all
        </Button>
        <Button variant="primary" onClick={props.onKeep}>
          {props.kept.length === 0 ? "Keep the source only" : `Keep ${props.kept.length}`}
        </Button>
      </div>
    </div>
  )
}

function DoneStep(props: {
  source: Source
  about: Subject[]
  facts: number
  onAnother: () => void
  onClose: () => void
}) {
  const names = props.about.map((s) => s.name)
  return (
    <>
      <div className="flex items-start gap-3">
        <Lamp tone="ok" label="Saved" />
        <div className="flex flex-col gap-1">
          <p className="text-[1.02rem] font-medium text-ink">
            {props.facts > 0
              ? `Memo now knows ${props.facts} facts from ${props.source.name}${names.length ? `, about ${names.join(" and ")}` : ""}.`
              : `${props.source.name} is saved${names.length ? `, about ${names.join(" and ")}` : ""}.`}
          </p>
          <p className="text-[0.95rem] text-ink-soft">
            Your agents can use it from now on. The source itself is in Memo’s database and turns up in Search.
          </p>
        </div>
      </div>
      <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app text-[0.95rem]">
        <li className="flex items-center gap-3 px-[0.9rem] py-[0.7rem]">
          <span className="text-ink-soft">{kindIcon(props.source.kind, "size-4")}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[0.9rem] text-ink">{props.source.name}</span>
          <span className="text-[0.9rem] text-ink-soft">searchable</span>
        </li>
        {props.facts > 0 && (
          <li className="flex items-center gap-3 border-t border-line px-[0.9rem] py-[0.7rem]">
            <ListChecks className="size-4 text-ink-soft" aria-hidden />
            <span className="flex-1 text-ink">{props.facts} facts in use</span>
            <span className="text-[0.9rem] text-ink-soft">cite the source</span>
          </li>
        )}
      </ul>
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
