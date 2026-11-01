// Design prototype for docs/dev/plans/2026-11-01-guides.md. Outside `src`, no new platform calls: it reads the
// installed tools from the app's own store, so `?state=one` and `?state=mixed` change which guides are ready.
// `?guides=first` arrives from the setup's last step, `?guides=offline` shows the bundled copy with no network,
// `?guide=<id>` opens one guide, `?q=<words>` starts with a search.
import { Check, Copy, ExternalLink, Search, ShieldCheck, X } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { KNOWN_AGENTS } from "@/domain/agents"
import { tools } from "@/domain/catalog"
import { formatList, LANGS, type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, holdInPlace, reducedMotion } from "@/ui/motion"
import { Select } from "@/ui/Select"
import { StableText } from "@/ui/Skeleton"
import { useNav } from "../../../../src/features/nav"
import { openTool } from "../../../../src/features/tools/go"
import { useTools } from "../../../../src/features/tools/store"
import { ToolIcon } from "../../../../src/features/tools/ToolIcon"
import { GOALS, type Goal, GUIDES, type Guide, textOf } from "./guides"
import { guidesMessages, type Text } from "./messages"

const params = new URLSearchParams(window.location.search)
const scenario = params.get("guides")
let firstVisit = scenario === "first"

/** Called by the setup's last step on the review branch, so the page greets the owner once. */
export function arriveFromSetup() {
  firstVisit = true
  useNav.getState().go("guides")
}

// The first guide here that the owner's tools can run is the one the page offers first.
const START_ORDER = ["catch-up", "plan-the-day", "where-decided", "meeting-prep", "drive-brief", "call-follow-up"]

// Apps that reach WireCat through its connector, not a command line: they get the prompt without "Use tg CLI.".
const APPS = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "claude-app", name: "Claude" },
]
const CHAT_AGENTS = new Set(["hermes", "openclaw"])
const AGENT_KEY = "wirecat.guides.agent"

const nameOf = (id: string, m: Text) => (id === "memo" ? m.memory : (tools.find((t) => t.id === id)?.name ?? id))
const binOf = (id: string) => tools.find((t) => t.id === id)?.bin ?? id
const orList = (items: string[], lang: Lang) => new Intl.ListFormat(lang, { type: "disjunction" }).format(items)

type Fit = { ready: boolean; missing: string[]; messenger: string | null; extras: string[] }

function fitOf(g: Guide, has: (id: string) => boolean): Fit {
  const missing = (g.needs.all ?? []).filter((id) => !has(id))
  const any = g.needs.any ?? []
  const messenger = any.find(has) ?? null
  const ready = missing.length === 0 && (any.length === 0 || messenger !== null)
  return { ready, missing, messenger: messenger ?? any[0] ?? null, extras: (g.needs.extra ?? []).filter(has) }
}

// The site writes its prompts for Telegram; the owner who has only WhatsApp or MAX gets them for his messenger.
const forMessenger = (text: string, messenger: string | null) =>
  messenger && messenger !== "tg"
    ? text.replace(/\btg CLI\b/g, `${binOf(messenger)} CLI`).replace(/^tg /, `${binOf(messenger)} `)
    : text

// "Use tg CLI." is for the agent; people read the request without it.
const LEAD = /^(?:Use|Usa|Используй) [^.]*?CLI(?:\.|,? (?:to|para|чтобы))\s*/
function withoutLead(prompt: string) {
  const rest = prompt.replace(LEAD, "")
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

const fold = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
// Every language at once: an owner who reads Spanish may still type the English word he saw on the site.
const haystack = new Map(
  GUIDES.map((g) => [g.id, fold(LANGS.flatMap((l) => [textOf(g.title, l), textOf(g.outcome, l)]).join(" "))]),
)
// A word's ending may change ("звонок", "звонку"), so a long word also matches by its first letters.
const stems = (w: string) => (w.length >= 5 ? [w, w.slice(0, -1), w.slice(0, Math.max(4, w.length - 2))] : [w])
const matches = (g: Guide, words: string[]) =>
  words.every((w) => stems(w).some((stem) => haystack.get(g.id)?.includes(stem)))

function readAgent() {
  try {
    return localStorage.getItem(AGENT_KEY) ?? "any"
  } catch {
    return "any"
  }
}

function useFits() {
  const installs = useTools((s) => s.installs)
  const checked = useTools((s) => s.checked)
  const has = (id: string) => (installs[id]?.length ?? 0) > 0
  // Before the tools answer, an empty list means "not asked yet", not "nothing installed".
  const known = checked || Object.keys(installs).length > 0
  return { has, known, fits: new Map(GUIDES.map((g) => [g.id, fitOf(g, has)])) }
}

type Ctx = {
  m: Text
  lang: Lang
  has: (id: string) => boolean
  known: boolean
  fits: Map<string, Fit>
  agent: string
  setAgent: (id: string) => void
}

export function GuidesPage() {
  const m = useMessages(guidesMessages)
  const lang = useLang()
  const { has, known, fits } = useFits()
  const [welcome] = useState(firstVisit)
  const [open, setOpen] = useState<string | null>(params.get("guide"))
  const [query, setQuery] = useState(params.get("q") ?? "")
  const [agent, setAgentState] = useState(readAgent)
  const setAgent = (id: string) => {
    setAgentState(id)
    try {
      localStorage.setItem(AGENT_KEY, id)
    } catch {
      // Without storage the choice lasts until the page closes.
    }
  }
  const start = useRef<string | null>(null)
  if (known && !start.current)
    start.current =
      START_ORDER.find((id) => fits.get(id)?.ready) ?? GUIDES.find((g) => fits.get(g.id)?.ready)?.id ?? null
  const startId = start.current ?? (known ? null : "catch-up")
  const starter = GUIDES.find((g) => g.id === startId)
  const words = fold(query).split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const shown = new Set(GUIDES.filter((g) => matches(g, words)).map((g) => g.id))
  const headings = useRef(new Map<Goal, HTMLHeadingElement>())

  useEffect(() => {
    firstVisit = false
    useTools.getState().refresh()
  }, [])

  const ctx: Ctx = { m, lang, has, known, fits, agent, setAgent }

  const jump = (goal: Goal) => {
    const h = headings.current.get(goal)
    if (!h) return
    h.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })
    h.focus({ preventScroll: true })
  }

  return (
    <div className="@container flex flex-col gap-[1.8rem] px-[2.1rem] pt-[1.6rem] pb-[3rem]">
      <header className="flex flex-col gap-[1rem]">
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-[1.2rem]">
            <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
            <p className="min-w-0 truncate text-[0.9rem] text-ink-dim">
              {scenario === "offline" ? m.offline : m.fresh}
            </p>
          </div>
          <SiteLink href={`https://wirecat.dev/${lang}/docs/prompting`}>{m.allOnSite}</SiteLink>
        </div>
        <p className="max-w-[62ch] text-[1.02rem] leading-relaxed text-ink-soft">{m.intro}</p>
        <label className="relative block max-w-[36rem]">
          <span className="sr-only">{m.search}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-[0.8rem] size-4 -translate-y-1/2 text-ink-dim"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault()
                setQuery("")
              }
            }}
            placeholder={m.searchHint}
            spellCheck={false}
            className="selectable h-[2.6rem] w-full rounded-[0.35rem] border border-line-strong bg-app pr-[0.8rem] pl-[2.3rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand"
          />
        </label>
        <nav aria-label={m.jumpTo} className="flex flex-wrap gap-x-[0.3rem] gap-y-[0.3rem]">
          {GOALS.map((goal) => {
            const count = GUIDES.filter((g) => g.goal === goal && shown.has(g.id)).length
            return (
              <button
                key={goal}
                type="button"
                disabled={count === 0}
                onClick={() => jump(goal)}
                className="flex h-[2rem] items-center gap-[0.4rem] rounded-[0.35rem] px-[0.6rem] text-[0.92rem] font-medium text-ink-soft transition-[color,background-color,opacity] duration-150 hover:bg-app-3 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
              >
                {m.goals[goal].name}
                <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">{count}</span>
              </button>
            )
          })}
        </nav>
      </header>

      <Collapse open={searching && shown.size === 0}>
        <p role="status" className="text-[0.95rem] text-ink-soft">
          {m.noMatch(query.trim())}
        </p>
      </Collapse>

      {starter && (
        <Collapse open={!searching}>
          <section aria-labelledby="guides-start" className="flex flex-col gap-[0.8rem]">
            <h2 id="guides-start" className="text-[0.95rem] font-medium text-ink-dim">
              {welcome ? m.welcomeTitle : m.startHere}
            </h2>
            <AutoHeight swap={starter.id}>
              <Crossfade swap={starter.id}>
                <GuideBody
                  guide={starter}
                  ctx={ctx}
                  lead
                  quiet={open !== null && open !== starter.id}
                  scrollTo={params.get("guide") === starter.id}
                />
              </Crossfade>
            </AutoHeight>
          </section>
        </Collapse>
      )}

      <div className="flex flex-col">
        {GOALS.map((goal) => (
          <GoalBlock
            key={goal}
            goal={goal}
            ctx={ctx}
            open={open}
            shown={shown}
            heading={(el) => {
              if (el) headings.current.set(goal, el)
            }}
            onToggle={(id) => setOpen((o) => (o === id ? null : id))}
          />
        ))}
      </div>
    </div>
  )
}

function GoalBlock(props: {
  goal: Goal
  ctx: Ctx
  open: string | null
  shown: Set<string>
  heading: (el: HTMLHeadingElement | null) => void
  onToggle: (id: string) => void
}) {
  const { goal, ctx, open, shown, heading, onToggle } = props
  const { m } = ctx
  const list = GUIDES.filter((g) => g.goal === goal)
  const visible = list.some((g) => shown.has(g.id))
  const headingId = useId()
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    const target = GUIDES.find((g) => g.id === params.get("guide"))
    if (target?.goal === goal) section.current?.scrollIntoView({ block: "start" })
  }, [goal])

  return (
    <Collapse open={visible}>
      <section
        ref={section}
        aria-labelledby={headingId}
        className="grid scroll-mt-[1rem] gap-x-[2rem] gap-y-[0.6rem] border-line border-t py-[1.3rem] @min-[46rem]:grid-cols-[12rem_minmax(0,1fr)] @min-[64rem]:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <div className="flex flex-col gap-[0.3rem] @min-[46rem]:pt-[0.55rem]">
          <h2 ref={heading} id={headingId} tabIndex={-1} className="text-[1.2rem] font-semibold outline-none">
            {m.goals[goal].name}
          </h2>
          <p className="text-[0.9rem] leading-snug text-ink-dim">{m.goals[goal].line}</p>
        </div>
        <ul className="flex min-w-0 flex-col">
          {list.map((g) => (
            <li key={g.id}>
              <Collapse open={shown.has(g.id)}>
                <Entry guide={g} ctx={ctx} open={open === g.id} onToggle={() => onToggle(g.id)} />
              </Collapse>
            </li>
          ))}
        </ul>
      </section>
    </Collapse>
  )
}

function Entry({ guide: g, ctx, open, onToggle }: { guide: Guide; ctx: Ctx; open: boolean; onToggle: () => void }) {
  const { lang } = ctx
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  return (
    <div className="py-[0.15rem]">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (button.current) holdInPlace(button.current)
          onToggle()
        }}
        className={cx(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[0.8rem] rounded-[0.4rem] px-[0.75rem] py-[0.55rem] text-left",
          "transition-colors duration-150 ease-out-quart",
          open ? "bg-app" : "hover:bg-app-3/70",
        )}
      >
        <span className="min-w-0">
          <span
            className={cx(
              "block text-[1.02rem] font-semibold leading-snug transition-colors duration-150",
              open ? "text-brand" : "text-ink group-hover:text-brand",
            )}
          >
            {textOf(g.title, lang)}
          </span>
          <span className="mt-[0.15rem] block text-[0.95rem] leading-snug text-ink-soft">
            {textOf(g.outcome, lang)}
          </span>
        </span>
        <ExpandChevron open={open} />
      </button>
      <Collapse id={panelId} open={open}>
        <div className="pt-[0.4rem] pb-[0.8rem]">
          <GuideBody
            guide={g}
            ctx={ctx}
            onClose={() => {
              onToggle()
              focusInPlace(button.current)
            }}
          />
        </div>
      </Collapse>
    </div>
  )
}

function GuideBody(props: {
  guide: Guide
  ctx: Ctx
  lead?: boolean
  quiet?: boolean
  scrollTo?: boolean
  onClose?: () => void
}) {
  const { guide: g, ctx, lead, quiet, scrollTo, onClose } = props
  const { m, lang, known, agent, setAgent } = ctx
  const fit = ctx.fits.get(g.id) as Fit
  const box = useRef<HTMLElement>(null)
  const promptId = useId()
  const agentId = useId()
  const messenger = fit.messenger
  const [prompt, setPrompt] = useState(() => forMessenger(textOf(g.prompt, lang), messenger))
  useEffect(() => setPrompt(forMessenger(textOf(g.prompt, lang), messenger)), [lang, g, messenger])
  useEffect(() => {
    if (scrollTo) box.current?.scrollIntoView({ block: "start" })
  }, [scrollTo])
  const app = APPS.find((a) => a.id === agent)
  const named = KNOWN_AGENTS.find((a) => a.id === agent)
  const hint = app
    ? m.pasteApp(app.name)
    : named
      ? CHAT_AGENTS.has(named.id)
        ? m.pasteChat(named.name)
        : m.pasteTerminal(named.name)
      : m.pasteAny
  const copied = app ? withoutLead(prompt) : prompt

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && onClose && !(e.target instanceof HTMLTextAreaElement)) {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <article
      ref={box}
      aria-label={textOf(g.title, lang)}
      onKeyDown={onKeyDown}
      className="@container flex flex-col gap-[1.1rem] rounded-[0.45rem] border border-line-strong bg-app p-[1.3rem]"
    >
      <div className="grid gap-x-[2.2rem] gap-y-[1.2rem] @min-[46rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-[0.7rem]">
          <div className="flex items-start justify-between gap-3">
            {lead ? (
              <div className="min-w-0">
                <h3 className="text-[1.35rem] font-semibold leading-snug">{textOf(g.title, lang)}</h3>
                <p className="mt-1 text-[0.98rem] text-ink-soft">{textOf(g.outcome, lang)}</p>
              </div>
            ) : (
              <label htmlFor={promptId} className="pt-[0.3rem] text-[0.9rem] font-medium text-ink-dim">
                {m.promptLabel}
              </label>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" aria-label={m.close} onClick={onClose} className="-mt-1 -mr-1">
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </div>
          {lead && (
            <label htmlFor={promptId} className="sr-only">
              {m.promptLabel}
            </label>
          )}
          <div className="rounded-[0.8rem] rounded-br-[0.2rem] bg-brand-soft/70 px-[1rem] py-[0.75rem] focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-2">
            <textarea
              id={promptId}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="selectable field-sizing-content block w-full resize-none bg-transparent text-[0.98rem] leading-relaxed text-ink outline-none"
            />
          </div>
          <p className="text-[0.9rem] text-ink-dim">{m.askHint}</p>
          <div className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-2">
            <CopyButton text={copied} m={m} primary={!quiet && known && fit.ready} />
            <span className="flex items-center gap-[0.5rem]">
              <span id={agentId} className="text-[0.9rem] text-ink-dim">
                {m.agent}
              </span>
              <Select
                size="sm"
                aria-labelledby={agentId}
                value={agent}
                onChange={setAgent}
                options={[
                  { value: "any", label: m.anyAgent },
                  ...KNOWN_AGENTS.map((a) => ({ value: a.id, label: a.name })),
                  ...APPS.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </span>
          </div>
          <p className="text-[0.9rem] text-ink-soft">{hint}</p>
          {g.saves && (
            <p className="flex gap-2 text-[0.9rem] text-ink-soft">
              <ShieldCheck className="mt-[0.15rem] size-[1rem] shrink-0 text-ok" aria-hidden />
              {m.asksFirst}
            </p>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-[1rem] border-line border-t pt-[1.1rem] @min-[46rem]:border-t-0 @min-[46rem]:border-l @min-[46rem]:pt-0 @min-[46rem]:pl-[2.2rem]">
          <section className="flex flex-col gap-[0.7rem]">
            <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.agentRuns}</h4>
            <ol className="relative flex flex-col gap-[0.8rem] before:absolute before:top-[0.6rem] before:bottom-[0.6rem] before:left-[0.35rem] before:w-px before:bg-line-strong">
              {g.steps.map((s) => (
                <li key={s.run} className="relative grid grid-cols-[0.7rem_minmax(0,1fr)] gap-x-[0.8rem]">
                  <span className="mt-[0.45rem] size-[0.7rem] rounded-full border-[1.5px] border-ink-dim bg-app" />
                  <div className="min-w-0">
                    <p className="text-[0.95rem] text-ink">{textOf(s.text, lang)}</p>
                    <code className="selectable mt-0.5 block truncate font-mono text-[0.85rem] text-ink-soft">
                      {forMessenger(s.run, messenger)}
                    </code>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="flex flex-col gap-[0.6rem]">
            <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.answers}</h4>
            <p className="rounded-[0.8rem] rounded-bl-[0.2rem] border border-line bg-app-2 px-[1rem] py-[0.7rem] text-[0.95rem] leading-relaxed text-ink">
              {textOf(g.result, lang)}
            </p>
            <p className="text-[0.9rem] text-ink-dim">{m.account}</p>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-[1.2rem] gap-y-2 border-line border-t pt-[0.9rem]">
        <Needs guide={g} fit={fit} ctx={ctx} />
        <SiteLink href={textOf(g.docs, lang)}>{m.fullGuide}</SiteLink>
      </div>
    </article>
  )
}

function Needs({ guide: g, fit, ctx }: { guide: Guide; fit: Fit; ctx: Ctx }) {
  const { m, lang, known } = ctx
  const uses = [...(g.needs.all ?? []), ...(fit.messenger ? [fit.messenger] : []), ...fit.extras]
  const link = "text-[0.92rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
  if (!known || fit.ready)
    return (
      <p className="flex flex-wrap items-center gap-[0.6rem] text-[0.9rem] text-ink-soft">
        <span className="flex items-center gap-[0.4rem]">
          {uses.map((id) => (
            <ToolIcon key={id} id={id} className="size-[1.1rem] text-ink-soft" />
          ))}
        </span>
        {m.uses(
          formatList(
            uses.map((id) => nameOf(id, m)),
            lang,
          ),
        )}
      </p>
    )
  const messengerMissing = fit.missing.length === 0
  const missingNames = messengerMissing
    ? orList(
        (g.needs.any ?? []).map((id) => nameOf(id, m)),
        lang,
      )
    : formatList(
        fit.missing.map((id) => nameOf(id, m)),
        lang,
      )
  return (
    <p className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-1 text-[0.9rem] text-ink-soft">
      <Lamp size="sm" tone="idle" />
      <span>{m.needs(missingNames)}</span>
      {messengerMissing ? (
        <button type="button" className={link} onClick={() => useNav.getState().go("tools")}>
          {m.getMessenger}
        </button>
      ) : (
        fit.missing.map((id) => (
          <button key={id} type="button" className={link} onClick={() => openTool(id)}>
            {id === "memo" ? m.turnOnMemory : m.get(nameOf(id, m))}
          </button>
        ))
      )}
    </p>
  )
}

function CopyButton({ text, m, primary }: { text: string; m: Text; primary: boolean }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      className="min-w-[9rem]"
      icon={
        copied ? (
          <Check className={cx("size-4", primary ? "text-brand-ink" : "text-ok")} aria-hidden />
        ) : (
          <Copy className={cx("size-4", primary ? "text-brand-ink" : "text-ink-dim")} aria-hidden />
        )
      }
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => undefined)
        setCopied(true)
      }}
    >
      <StableText value={copied ? m.copied : m.copy} variants={[m.copy, m.copied]} />
      <span className="sr-only" aria-live="polite">
        {copied ? m.copied : ""}
      </span>
    </Button>
  )
}

function SiteLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        platform.openUrl(href)
      }}
      className="inline-flex shrink-0 items-center gap-1.5 text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ExternalLink className="size-[0.95rem]" aria-hidden />
    </a>
  )
}
