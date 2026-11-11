// `?guides=first` arrives from the setup's last step, `?guides=offline` shows the bundled copy with no network,
// `?guide=<id>` opens one guide, `?q=<words>` starts with a search.
import { Check, ChevronDown, Copy, Search, ShieldCheck, SquareTerminal, X } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import { AgentRunNote, runAgent, useStartableAgents } from "@/features/fix"
import { openTool } from "@/features/tools"
import { formatList, LANGS, type Lang, useLang, useMessages } from "@/i18n"
import type { AgentRun } from "@/platform/agents-schemas"
import { ExtLink } from "@/shared/ExtLink"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { fieldFocus } from "@/ui/field"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, holdInPlace, reducedMotion } from "@/ui/motion"
import { Segmented } from "@/ui/Segmented"
import { StableText } from "@/ui/Skeleton"
import {
  docsOf,
  fill,
  GOALS,
  type Goal,
  GUIDES,
  type Guide,
  promptOf,
  stepsOf,
  textOf,
  variesByMessenger,
} from "./guides"
import { guidesMessages, type Text } from "./messages"
import { useGuideStart } from "./start-store"

const params = new URLSearchParams(window.location.search)
const scenario = params.get("guides")
let firstVisit = scenario === "first"

/** The tour started from the setup ends here, so the page greets the owner once when it opens. */
export function greetOnArrival() {
  firstVisit = true
}

/** The guides "Start here" offers in turn: the ready ones in START_ORDER, then the other ready ones. */
export function startOrder(fits: Map<string, Fit>): string[] {
  const ready = (id: string) => fits.get(id)?.ready
  return [...new Set([...START_ORDER.filter(ready), ...GUIDES.map((g) => g.id).filter(ready)])]
}

// The first guide here that the owner's tools can run is the one the page offers first.
const START_ORDER = ["catch-up", "plan-the-day", "where-decided", "meeting-prep", "drive-brief", "call-follow-up"]

const nameOf = (id: string, m: Text) => (id === "memo" ? m.memory : (tools.find((t) => t.id === id)?.name ?? id))
const orList = (items: string[], lang: Lang) => new Intl.ListFormat(lang, { type: "disjunction" }).format(items)

/** `messengers`: the installed ones the guide works with, in catalog order; the owner picks among them. */
type Fit = { ready: boolean; missing: string[]; messengers: string[]; extras: string[] }

export function fitOf(g: Guide, has: (id: string) => boolean): Fit {
  const missing = (g.needs.all ?? []).filter((id) => !has(id))
  const any = g.needs.any ?? []
  const messengers = tools.map((t) => t.id).filter((id) => any.includes(id) && has(id))
  const ready = missing.length === 0 && (any.length === 0 || messengers.length > 0)
  return { ready, missing, messengers, extras: (g.needs.extra ?? []).filter(has) }
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
}

export function GuidesPage() {
  const m = useMessages(guidesMessages)
  const lang = useLang()
  const { has, known, fits } = useFits()
  const [welcome] = useState(firstVisit)
  const [open, setOpen] = useState<string | null>(params.get("guide"))
  const [query, setQuery] = useState(params.get("q") ?? "")
  // Fixed once the tools are known, so installing one later does not swap the guide the owner is reading.
  const order = useRef<string[] | null>(null)
  if (known && !order.current) order.current = startOrder(fits)
  const ids = order.current ?? (known ? [] : ["catch-up"])
  const shift = useGuideStart((s) => s.shift)
  const startId = ids.length > 0 ? ids[shift % ids.length] : null
  const starter = GUIDES.find((g) => g.id === startId)
  const words = fold(query).split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const shown = new Set(GUIDES.filter((g) => matches(g, words)).map((g) => g.id))
  const headings = useRef(new Map<Goal, HTMLHeadingElement>())

  useEffect(() => {
    firstVisit = false
    useTools.getState().refresh()
  }, [])

  const ctx: Ctx = { m, lang, has, known, fits }

  const jump = (goal: Goal) => {
    const h = headings.current.get(goal)
    if (!h) return
    h.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" })
    h.focus({ preventScroll: true })
  }

  return (
    <Page className="@container">
      <header data-tour="guides" className="flex flex-col gap-[1rem]">
        <PageHeader
          title={m.title}
          status={scenario === "offline" ? m.offline : m.fresh}
          busy={false}
          intro={m.intro}
          actions={
            <ExtLink href={`https://wirecat.dev/${lang}/docs/prompting`} className="font-medium">
              {m.allOnSite}
            </ExtLink>
          }
        />
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
            className={`selectable h-[2.8rem] w-full rounded-[0.35rem] border border-line-strong bg-app pr-[0.8rem] pl-[2.3rem] text-[0.95rem] text-ink placeholder:text-ink-dim ${fieldFocus}`}
          />
        </label>
        <nav aria-label={m.jumpTo} className="flex flex-wrap gap-x-[0.3rem] gap-y-[0.3rem]">
          {GOALS.map((goal) => {
            const count = GUIDES.filter((g) => g.goal === goal && shown.has(g.id)).length
            // A goal the search leaves empty has nothing to jump to; it returns when the search changes.
            if (count === 0) return null
            return (
              <button
                key={goal}
                type="button"
                onClick={() => jump(goal)}
                className="flex h-[2rem] items-center gap-[0.4rem] rounded-[0.35rem] px-[0.6rem] text-[0.92rem] font-medium text-ink-soft transition-[color,background-color,opacity] duration-(--motion-fast) hover:bg-app-3 hover:text-ink"
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
          <section data-tour="guide-start" aria-labelledby="guides-start" className="flex flex-col gap-[0.8rem]">
            <div className="flex min-h-[2rem] items-center justify-between gap-3">
              <h2 id="guides-start" className="text-[0.95rem] font-medium text-ink-dim">
                {welcome ? m.welcomeTitle : m.startHere}
              </h2>
              {ids.length > 1 && (
                <Button size="sm" onClick={() => useGuideStart.getState().next()}>
                  {m.nextGuide}
                </Button>
              )}
            </div>
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
    </Page>
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
          "transition-colors duration-(--motion-fast) ease-out-quart",
          open ? "bg-app" : "hover:bg-app-3/70",
        )}
      >
        <span className="min-w-0">
          <span
            className={cx(
              "block text-[1.02rem] font-semibold leading-snug transition-colors duration-(--motion-fast)",
              open ? "text-brand" : "text-ink group-hover:text-brand",
            )}
          >
            {textOf(g.title, lang)}
          </span>
          <span className="mt-[0.15rem] block text-[0.95rem] leading-snug text-ink-soft">
            {textOf(g.outcome, lang)}
          </span>
        </span>
        {/* The shared ExpandChevron's look; PR #47 does not have that component, so the prototype draws its own. */}
        <ChevronDown
          aria-hidden
          className={cx(
            "size-4 shrink-0 text-ink-dim transition-transform duration-(--motion-normal)",
            open && "rotate-180",
          )}
        />
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
  const { m, lang, known } = ctx
  const fit = ctx.fits.get(g.id) as Fit
  const box = useRef<HTMLElement>(null)
  const promptId = useId()
  const varies = variesByMessenger(g)
  const [picked, setPicked] = useState<string | null>(null)
  // With none installed the guide reads as written for the first one, under "Needs a messenger".
  const messenger = (picked && fit.messengers.includes(picked) ? picked : fit.messengers[0]) ?? g.needs.any?.[0] ?? null
  const [edits, setEdits] = useState<Record<string, string>>({})
  const variant = `${lang}/${messenger}`
  const prompt = edits[variant] ?? fill(promptOf(g, lang, ctx.has), messenger)
  useEffect(() => {
    if (scrollTo) box.current?.scrollIntoView({ block: "start" })
  }, [scrollTo])
  // Every agent WireCat can start and found on this computer gets its own Open; any other agent takes the copy.
  const launchers = useStartableAgents() ?? []
  const [run, setRun] = useState<{ agent: string; result: AgentRun | null } | null>(null)
  const launch = launchers.find((a) => a.id === run?.agent) ?? null
  const shownRun = launch ? run : null
  const open = async (id: string) => {
    setRun({ agent: id, result: null })
    setRun({ agent: id, result: await runAgent(id, prompt) })
  }
  // Beside the title or the close button the labelled switch would squeeze them, so it gets a row above the prompt.
  const switcher = known && varies && fit.messengers.length > 1 && messenger && (
    <MessengerSwitch choices={fit.messengers} value={messenger} onChange={setPicked} m={m} />
  )

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
        <section className="@container/prompt flex min-w-0 flex-col gap-[0.7rem]">
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
            <div className="flex shrink-0 items-center gap-[0.6rem]">
              {onClose && (
                <Button variant="ghost" size="sm" aria-label={m.close} onClick={onClose} className="-mt-1 -mr-1">
                  <X className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
          {switcher}
          {lead && (
            <label htmlFor={promptId} className="sr-only">
              {m.promptLabel}
            </label>
          )}
          <AutoHeight swap={messenger}>
            <Crossfade swap={variant}>
              <div className="rounded-[0.8rem] rounded-br-[0.2rem] bg-brand-soft/70 px-[1rem] py-[0.75rem] focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-2">
                <textarea
                  id={promptId}
                  value={prompt}
                  onChange={(e) => setEdits((all) => ({ ...all, [variant]: e.target.value }))}
                  rows={3}
                  className="inner-field selectable field-sizing-content block w-full resize-none bg-transparent text-[0.98rem] leading-relaxed text-ink outline-none"
                />
              </div>
            </Crossfade>
          </AutoHeight>
          <p className="text-[0.9rem] text-ink-dim">{launchers.length > 0 ? m.askHintOpen : m.askHint}</p>
          <div className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-2">
            <CopyButton text={prompt} m={m} primary={!quiet && known && fit.ready} />
            {launchers.map((a) => {
              const opening = shownRun?.agent === a.id && !shownRun.result
              return (
                <Button
                  key={a.id}
                  disabled={shownRun !== null && shownRun.result === null}
                  onClick={() => open(a.id)}
                  icon={<SquareTerminal className="size-4 text-ink-dim" aria-hidden />}
                >
                  <StableText value={opening ? m.opening : m.openIn(a.name)} variants={[m.opening, m.openIn(a.name)]} />
                </Button>
              )
            })}
          </div>
          <p className="text-[0.9rem] text-ink-soft">{m.pasteAny}</p>
          <div aria-live="polite">
            <Collapse open={Boolean(shownRun?.result)}>
              {shownRun?.result && launch && (
                <AgentRunNote run={shownRun.result} name={launch.name} started={m.startedIn(launch.name)} />
              )}
            </Collapse>
          </div>
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
            <Crossfade swap={String(messenger)}>
              <ol className="relative flex flex-col gap-[0.8rem] before:absolute before:top-[0.6rem] before:bottom-[0.6rem] before:left-[0.35rem] before:w-px before:bg-line-strong">
                {stepsOf(g, ctx.has).map((s) => (
                  <li key={s.run} className="relative grid grid-cols-[0.7rem_minmax(0,1fr)] gap-x-[0.8rem]">
                    <span className="mt-[0.45rem] size-[0.7rem] rounded-full border-[1.5px] border-ink-dim bg-app" />
                    <div className="min-w-0">
                      <p className="text-[0.95rem] text-ink">{textOf(s.text, lang)}</p>
                      <code className="selectable mt-0.5 block truncate font-mono text-[0.85rem] text-ink-soft">
                        {fill(s.run, messenger)}
                      </code>
                    </div>
                  </li>
                ))}
              </ol>
            </Crossfade>
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
        <Needs guide={g} fit={fit} messenger={messenger} ctx={ctx} />
        <ExtLink href={docsOf(g, messenger, lang)} className="shrink-0 font-medium">
          {m.fullGuide}
        </ExtLink>
      </div>
    </article>
  )
}

function Needs(props: { guide: Guide; fit: Fit; messenger: string | null; ctx: Ctx }) {
  const { guide: g, fit, messenger, ctx } = props
  const { m, lang, known } = ctx
  // A guide whose words do not change with the messenger reads from every installed one.
  const reads = variesByMessenger(g)
    ? messenger && fit.messengers.includes(messenger)
      ? [messenger]
      : []
    : fit.messengers
  const uses = [...(g.needs.all ?? []), ...reads, ...fit.extras]
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

function MessengerSwitch(props: { choices: string[]; value: string; onChange: (id: string) => void; m: Text }) {
  const { choices, value, onChange, m } = props
  return (
    <span className="flex items-center gap-[0.5rem]">
      {/* Named choices say what they are; only the bare icons need the word in front. */}
      <span aria-hidden className="text-[0.9rem] text-ink-dim @min-[21rem]/prompt:hidden">
        {m.messenger}
      </span>
      <Segmented
        label={m.messenger}
        value={value}
        onChange={onChange}
        labelClass="hidden @min-[21rem]/prompt:inline"
        options={choices.map((id) => ({
          value: id,
          label: nameOf(id, m),
          icon: <ToolIcon id={id} className="size-[1.05rem]" />,
        }))}
      />
    </span>
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
