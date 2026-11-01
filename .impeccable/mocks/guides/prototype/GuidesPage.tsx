// Design prototype for docs/dev/plans/2026-11-01-guides.md. Outside `src`, no new platform calls: it reads the
// installed tools from the app's own store, so `?state=one` and `?state=mixed` change which guides are ready.
// `?guides=first` arrives from the setup's last step, `?guides=offline` shows the bundled copy with no network,
// `?guide=<id>` opens one guide.
import { Check, Copy, ExternalLink, ShieldCheck, X } from "lucide-react"
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import { formatList, type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, holdInPlace } from "@/ui/motion"
import { StableText } from "@/ui/Skeleton"
import { useNav } from "../../../../src/features/nav"
import { openTool } from "../../../../src/features/tools/go"
import { useTools } from "../../../../src/features/tools/store"
import { ToolIcon } from "../../../../src/features/tools/ToolIcon"
import { GOALS, GUIDES, type Guide, textOf } from "./guides"
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

// A card shows what the owner asks for; "Use tg CLI." is for the agent and stays in the full request.
const LEAD = /^(?:Use|Usa|Используй) [^.]*?CLI(?:\.|,? (?:to|para|чтобы))\s*/
function excerptOf(prompt: string) {
  const rest = prompt.replace(LEAD, "")
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

function useFits() {
  const installs = useTools((s) => s.installs)
  const checked = useTools((s) => s.checked)
  const has = (id: string) => (installs[id]?.length ?? 0) > 0
  // Before the tools answer, an empty list means "not asked yet", not "nothing installed".
  const known = checked || Object.keys(installs).length > 0
  return { has, known, fits: new Map(GUIDES.map((g) => [g.id, fitOf(g, has)])) }
}

export function GuidesPage() {
  const m = useMessages(guidesMessages)
  const lang = useLang()
  const { has, known, fits } = useFits()
  const [welcome] = useState(firstVisit)
  const [open, setOpen] = useState<string | null>(params.get("guide"))
  const start = useRef<string | null>(null)
  if (known && !start.current)
    start.current =
      START_ORDER.find((id) => fits.get(id)?.ready) ?? GUIDES.find((g) => fits.get(g.id)?.ready)?.id ?? null
  const startId = start.current ?? (known ? null : "catch-up")
  const starter = GUIDES.find((g) => g.id === startId)

  useEffect(() => {
    firstVisit = false
    useTools.getState().refresh()
  }, [])

  const ctx = { m, lang, has, known, fits }

  return (
    <div className="@container flex flex-col gap-[1.8rem] px-[2.1rem] pt-[1.6rem] pb-[3rem]">
      <div className="flex flex-col gap-[0.8rem]">
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-[1.2rem]">
            <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
            <p className="min-w-0 truncate text-[0.9rem] text-ink-dim">
              {scenario === "offline" ? m.offline : m.fresh}
            </p>
          </div>
          <SiteLink href={`https://wirecat.dev/${lang}/docs/prompting`}>{m.allOnSite}</SiteLink>
        </div>
        {!welcome && <p className="max-w-[64ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.intro}</p>}
      </div>

      {starter && (
        <section aria-labelledby="guides-start" className="flex flex-col gap-[0.9rem]">
          <div className="flex flex-col gap-1">
            <h2 id="guides-start" className="text-[1.2rem] font-semibold">
              {welcome ? m.welcomeTitle : m.startHere}
            </h2>
            {welcome && <p className="max-w-[64ch] text-[0.95rem] text-ink-soft">{m.welcomeText}</p>}
          </div>
          <AutoHeight swap={starter.id}>
            <Crossfade swap={starter.id}>
              <Spread
                guide={starter}
                ctx={ctx}
                lead
                quiet={open !== null && open !== starter.id}
                scrollTo={params.get("guide") === starter.id}
              />
            </Crossfade>
          </AutoHeight>
        </section>
      )}
      {GOALS.map((goal) => (
        <GoalShelf
          key={goal}
          goal={goal}
          ctx={ctx}
          open={open}
          starter={starter?.id ?? null}
          onOpen={(id) => setOpen((o) => (o === id ? null : id))}
        />
      ))}
    </div>
  )
}

type Ctx = {
  m: Text
  lang: Lang
  has: (id: string) => boolean
  known: boolean
  fits: Map<string, Fit>
}

function GoalShelf(props: {
  goal: (typeof GOALS)[number]
  ctx: Ctx
  open: string | null
  starter: string | null
  onOpen: (id: string) => void
}) {
  const { goal, ctx, open, starter, onOpen } = props
  const { m } = ctx
  const list = GUIDES.filter((g) => g.goal === goal)
  const opened = list.find((g) => g.id === open && g.id !== starter)
  const shown = useRef(opened)
  if (opened) shown.current = opened
  const headingId = useId()
  const cards = useRef(new Map<string, HTMLButtonElement>())
  const section = useRef<HTMLElement>(null)
  // `?guide=<id>` stands in for a link from elsewhere in the app; the group's heading lands at the top, card in view.
  useEffect(() => {
    const target = GUIDES.find((g) => g.id === params.get("guide"))
    if (target?.goal === goal && target.id !== starter) section.current?.scrollIntoView({ block: "start" })
  }, [goal, starter])

  return (
    <section ref={section} aria-labelledby={headingId} className="flex flex-col gap-[0.9rem]">
      <div className="flex flex-wrap items-baseline gap-x-[0.9rem] gap-y-1">
        <h2 id={headingId} className="text-[1.2rem] font-semibold">
          {m.goals[goal].name}
        </h2>
        <p className="text-[0.95rem] text-ink-soft">{m.goals[goal].line}</p>
      </div>
      <ul className="grid gap-[0.8rem] @min-[40rem]:grid-cols-2 @min-[62rem]:grid-cols-3">
        {list.map((g) => (
          <li key={g.id} className="flex">
            <Card
              guide={g}
              ctx={ctx}
              open={g.id === opened?.id}
              starter={g.id === starter}
              ref={(el) => {
                if (el) cards.current.set(g.id, el)
              }}
              onOpen={() => {
                const el = cards.current.get(g.id)
                if (el) holdInPlace(el)
                onOpen(g.id)
              }}
            />
          </li>
        ))}
      </ul>
      <Collapse open={!!opened}>
        {shown.current && (
          <AutoHeight swap={shown.current.id}>
            <Crossfade swap={shown.current.id}>
              <Spread
                guide={shown.current}
                ctx={ctx}
                onClose={() => {
                  const id = shown.current?.id
                  if (!id) return
                  onOpen(id)
                  focusInPlace(cards.current.get(id) ?? null)
                }}
              />
            </Crossfade>
          </AutoHeight>
        )}
      </Collapse>
    </section>
  )
}

function Card(props: {
  guide: Guide
  ctx: Ctx
  open: boolean
  starter: boolean
  onOpen: () => void
  ref: (el: HTMLButtonElement | null) => void
}) {
  const { guide: g, ctx, open, starter, onOpen, ref } = props
  const { lang } = ctx
  const fit = ctx.fits.get(g.id) as Fit
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      onClick={onOpen}
      className={cx(
        "group flex w-full flex-col gap-[0.7rem] rounded-[0.45rem] border bg-app p-[1rem] text-left",
        "transition-[border-color,background-color] duration-150 ease-out-quart",
        open ? "border-brand" : "border-line-strong hover:border-ink-dim/60",
      )}
    >
      <h3
        className={cx(
          "text-[1.02rem] font-semibold leading-snug",
          open ? "text-brand" : "group-hover:text-brand transition-colors duration-150",
        )}
      >
        {textOf(g.title, lang)}
      </h3>
      <p className="flex-1 rounded-[0.6rem] rounded-bl-[0.15rem] bg-app-2 px-[0.8rem] py-[0.55rem] text-[0.92rem] leading-relaxed text-ink-soft">
        <span className="line-clamp-3">{excerptOf(forMessenger(textOf(g.prompt, lang), fit.messenger))}</span>
      </p>
      <Readiness guide={g} ctx={ctx} starter={starter} />
    </button>
  )
}

function Readiness({ guide: g, ctx, starter }: { guide: Guide; ctx: Ctx; starter?: boolean }) {
  const { m, lang, known } = ctx
  const fit = ctx.fits.get(g.id) as Fit
  const label = !known
    ? m.checking
    : fit.ready
      ? m.ready
      : m.needs(
          fit.missing.length > 0
            ? formatList(
                fit.missing.map((id) => nameOf(id, m)),
                lang,
              )
            : m.aMessenger,
        )
  return (
    <span className="flex min-h-[1.4rem] items-center gap-[0.5rem] text-[0.9rem] text-ink-soft">
      <Lamp size="sm" tone={known && fit.ready ? "ok" : "idle"} />
      <StableText value={label} variants={[m.checking, label]} />
      {starter && <span className="ml-auto text-ink-dim">{m.startHere}</span>}
    </span>
  )
}

function Spread(props: {
  guide: Guide
  ctx: Ctx
  lead?: boolean
  quiet?: boolean
  scrollTo?: boolean
  onClose?: () => void
}) {
  const { guide: g, ctx, lead, quiet, scrollTo, onClose } = props
  const { m, lang, has, known } = ctx
  const fit = ctx.fits.get(g.id) as Fit
  const box = useRef<HTMLElement>(null)
  const promptId = useId()
  const messenger = fit.messenger
  const [prompt, setPrompt] = useState(() => forMessenger(textOf(g.prompt, lang), messenger))
  useEffect(() => setPrompt(forMessenger(textOf(g.prompt, lang), messenger)), [lang, g, messenger])
  // `?guide=<id>` stands in for a link from elsewhere in the app (a tool's details, the setup).
  useEffect(() => {
    if (scrollTo) box.current?.scrollIntoView({ block: "start" })
  }, [scrollTo])
  const uses = [...(g.needs.all ?? []), ...(fit.messenger ? [fit.messenger] : []), ...fit.extras]

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && onClose) {
      e.stopPropagation()
      onClose()
    }
  }

  return (
    <article
      ref={box}
      aria-label={textOf(g.title, lang)}
      onKeyDown={onKeyDown}
      className={cx(
        "grid gap-x-[2.2rem] gap-y-[1.6rem] rounded-[0.45rem] border border-line-strong bg-app p-[1.4rem] @min-[52rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
        !lead && "mt-[0.1rem]",
      )}
    >
      <section className="flex min-w-0 flex-col gap-[0.8rem]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {lead && <h3 className="text-[1.35rem] font-semibold leading-snug">{textOf(g.title, lang)}</h3>}
            <p className={cx(lead ? "mt-1 text-[0.95rem] text-ink-soft" : "text-[1rem] font-medium text-ink")}>
              {textOf(g.outcome, lang)}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" aria-label={m.close} onClick={onClose}>
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        <label htmlFor={promptId} className="text-[0.9rem] font-medium text-ink-dim">
          {m.youAsk}
        </label>
        <div className="rounded-[0.8rem] rounded-br-[0.2rem] bg-brand-soft/70 px-[1rem] py-[0.8rem] focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-2">
          <textarea
            id={promptId}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={lead ? 4 : 5}
            className="field-sizing-content block w-full resize-none bg-transparent text-[1.02rem] leading-relaxed text-ink outline-none"
          />
        </div>
        <p className="text-[0.9rem] text-ink-dim">{m.askHint}</p>
        <div className="flex flex-wrap items-center gap-x-[1.1rem] gap-y-2">
          <CopyButton text={prompt} m={m} primary={!quiet && known && fit.ready} />
          <button
            type="button"
            onClick={() => useNav.getState().go("agents")}
            className="text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {m.whichAgents}
          </button>
        </div>
        <p className="text-[0.9rem] text-ink-soft">{m.pasteInto}</p>
        {g.saves && (
          <p className="flex gap-2 text-[0.9rem] text-ink-soft">
            <ShieldCheck className="mt-[0.15rem] size-[1rem] shrink-0 text-ok" aria-hidden />
            {m.asksFirst}
          </p>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-[0.8rem]">
        <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.agentRuns}</h4>
        <ol className="relative flex flex-col gap-[0.9rem] before:absolute before:top-[0.6rem] before:bottom-[0.6rem] before:left-[0.35rem] before:w-px before:bg-line-strong">
          {g.steps.map((s) => (
            <li key={s.run} className="relative grid grid-cols-[0.7rem_minmax(0,1fr)] gap-x-[0.8rem]">
              <span className="mt-[0.45rem] size-[0.7rem] rounded-full border-[1.5px] border-ink-dim bg-app" />
              <div className="min-w-0">
                <p className="text-[0.95rem] text-ink">{textOf(s.text, lang)}</p>
                <code className="selectable mt-0.5 block truncate font-mono text-[0.85rem] text-ink-soft">
                  {forMessenger(s.run, fit.messenger)}
                </code>
              </div>
            </li>
          ))}
        </ol>
        <h4 className="mt-[0.4rem] text-[0.9rem] font-medium text-ink-dim">{m.answers}</h4>
        <p className="rounded-[0.8rem] rounded-bl-[0.2rem] border border-line bg-app-2 px-[1rem] py-[0.7rem] text-[0.95rem] leading-relaxed text-ink">
          {textOf(g.result, lang)}
        </p>
        <p className="text-[0.9rem] text-ink-dim">{m.account}</p>
        <div className="mt-auto flex flex-col gap-[0.5rem] border-line border-t pt-[0.8rem]">
          <Needs guide={g} fit={fit} ctx={ctx} uses={uses} has={has} />
          <SiteLink href={textOf(g.docs, lang)}>{m.fullGuide}</SiteLink>
        </div>
      </section>
    </article>
  )
}

function Needs(props: { guide: Guide; fit: Fit; ctx: Ctx; uses: string[]; has: (id: string) => boolean }) {
  const { guide: g, fit, ctx, uses } = props
  const { m, lang, known } = ctx
  const link = "text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
  const icons = (
    <span className="flex items-center gap-[0.4rem]">
      {uses.map((id) => (
        <ToolIcon key={id} id={id} className={cx("size-[1.1rem]", props.has(id) ? "text-ink" : "text-ink-dim")} />
      ))}
    </span>
  )
  if (!known)
    return (
      <p className="flex items-center gap-[0.6rem] text-[0.9rem] text-ink-soft">
        <Lamp size="sm" tone="idle" />
        {m.checking}
      </p>
    )
  if (fit.ready)
    return (
      <p className="flex flex-wrap items-center gap-[0.6rem] text-[0.9rem] text-ink-soft">
        {icons}
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
      className="inline-flex shrink-0 items-center gap-1.5 self-start text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ExternalLink className="size-[0.95rem]" aria-hidden />
    </a>
  )
}
