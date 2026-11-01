// cspell:words cópiala pégala Pégala
// Design prototype for docs/dev/plans/2026-11-01-guides.md. Outside `src`, no new platform calls: it reads the
// installed tools from the app's own store, so `?state=one` and `?state=mixed` change which guides are ready.
// `?guides=first` arrives from the setup's last step, `?guides=offline` shows the bundled copy with no network,
// `?guides=ready` starts on "Ready to try", `?guide=<id>` opens one guide.
import { BookOpenText, Check, Copy, ExternalLink, ShieldCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { tools } from "@/domain/catalog"
import { type Lang, type Messages, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { holdInPlace } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { StableText } from "@/ui/Skeleton"
import { useNav } from "../../../../src/features/nav"
import { openTool } from "../../../../src/features/tools/go"
import { ToolIcon } from "../../../../src/features/tools/ToolIcon"
import { useTools } from "../../../../src/features/tools/store"
import { GUIDES, type Guide, textOf } from "./guides"

const en = {
  title: "Guides",
  intro:
    "Each guide is a request for your AI agent. It runs several WireCat tools for you and shows where every answer came from. Change the names to yours, copy it, and paste it into your agent.",
  fresh: "Up to date with wirecat.dev",
  offline: "The guides that came with WireCat. New ones arrive when you are online.",
  allOnSite: "All guides on wirecat.dev",
  filter: "Show guides",
  all: (n: number) => `All ${n}`,
  ready: (n: number) => `Ready to try ${n}`,
  noneReady: "None is ready yet: each guide needs a tool you have not installed. Open a guide to see which.",
  welcomeTitle: "Your tools are ready. Try one of these first.",
  welcomeText:
    "Open a guide, copy its request and paste it into your agent. These need only the tools you just installed.",
  lampReady: "Ready: every tool it needs is installed",
  lampMissing: "Needs a tool that is not installed",
  copy: "Copy request",
  copied: "Copied",
  get: (tool: string) => `Get ${tool}`,
  getMessenger: "Get a messenger",
  ask: "Ask your agent",
  askHint: "Change the names and dates to yours before you copy.",
  pasteInto: "Paste it into Claude Code, Codex, Hermes or another agent that has WireCat's skills.",
  whichAgents: "Which agents are ready",
  asksFirst: "Your agent shows you what it would save and saves only after you agree.",
  runs: "What your agent runs",
  account: "If you have more than one account, your agent asks which one to use.",
  get_: "What you get",
  needs: "Needs",
  oneOf: "One of these",
  extra: "Adds more when installed",
  installed: "Installed",
  notInstalled: "Not installed",
  install: "Install",
  fullGuide: "Full guide on wirecat.dev",
}

const ru: typeof en = {
  title: "Рецепты",
  intro:
    "Каждый рецепт — это запрос для вашего ИИ-агента. Агент сам запускает несколько инструментов WireCat и показывает, откуда взят каждый ответ. Замените имена на свои, скопируйте и вставьте в агента.",
  fresh: "Совпадает с wirecat.dev",
  offline: "Рецепты, которые пришли с WireCat. Новые появятся, когда будет интернет.",
  allOnSite: "Все рецепты на wirecat.dev",
  filter: "Показать рецепты",
  all: (n) => `Все ${n}`,
  ready: (n) => `Можно попробовать ${n}`,
  noneReady:
    "Пока ни один не готов: каждому нужен инструмент, который не установлен. Откройте рецепт, чтобы узнать какой.",
  welcomeTitle: "Инструменты готовы. Начните с одного из этих рецептов.",
  welcomeText:
    "Откройте рецепт, скопируйте запрос и вставьте его в агента. Им нужны только те инструменты, которые вы только что установили.",
  lampReady: "Готов: все нужные инструменты установлены",
  lampMissing: "Нужен инструмент, который не установлен",
  copy: "Скопировать запрос",
  copied: "Скопировано",
  get: (tool) => `Установить ${tool}`,
  getMessenger: "Установить мессенджер",
  ask: "Запрос агенту",
  askHint: "Замените имена и даты на свои перед копированием.",
  pasteInto: "Вставьте его в Claude Code, Codex, Hermes или другого агента с навыками WireCat.",
  whichAgents: "Какие агенты готовы",
  asksFirst: "Агент покажет, что собирается сохранить, и сохранит только после вашего согласия.",
  runs: "Что запускает агент",
  account: "Если у вас несколько аккаунтов, агент спросит, какой использовать.",
  get_: "Что вы получите",
  needs: "Нужно",
  oneOf: "Один из этих",
  extra: "Добавит больше, если установлен",
  installed: "Установлен",
  notInstalled: "Не установлен",
  install: "Установить",
  fullGuide: "Полный рецепт на wirecat.dev",
}

const es: typeof en = {
  title: "Guías",
  intro:
    "Cada guía es una petición para tu agente de IA. Ejecuta varias herramientas de WireCat por ti y muestra de dónde sale cada respuesta. Cambia los nombres por los tuyos, cópiala y pégala en tu agente.",
  fresh: "Al día con wirecat.dev",
  offline: "Las guías que vinieron con WireCat. Las nuevas llegan cuando tengas conexión.",
  allOnSite: "Todas las guías en wirecat.dev",
  filter: "Mostrar guías",
  all: (n) => `Todas ${n}`,
  ready: (n) => `Listas para probar ${n}`,
  noneReady:
    "Ninguna está lista aún: cada guía necesita una herramienta que no está instalada. Abre una para ver cuál.",
  welcomeTitle: "Tus herramientas están listas. Prueba primero una de estas.",
  welcomeText:
    "Abre una guía, copia su petición y pégala en tu agente. Solo necesitan las herramientas que acabas de instalar.",
  lampReady: "Lista: todas las herramientas que necesita están instaladas",
  lampMissing: "Necesita una herramienta que no está instalada",
  copy: "Copiar petición",
  copied: "Copiada",
  get: (tool) => `Instalar ${tool}`,
  getMessenger: "Instalar un mensajero",
  ask: "Pide a tu agente",
  askHint: "Cambia los nombres y las fechas por los tuyos antes de copiar.",
  pasteInto: "Pégala en Claude Code, Codex, Hermes u otro agente con las habilidades de WireCat.",
  whichAgents: "Qué agentes están listos",
  asksFirst: "Tu agente te muestra lo que guardaría y solo lo guarda cuando estés de acuerdo.",
  runs: "Lo que ejecuta tu agente",
  account: "Si tienes más de una cuenta, tu agente te pregunta cuál usar.",
  get_: "Lo que obtienes",
  needs: "Necesita",
  oneOf: "Una de estas",
  extra: "Añade más si está instalada",
  installed: "Instalada",
  notInstalled: "No instalada",
  install: "Instalar",
  fullGuide: "Guía completa en wirecat.dev",
}

const guidesMessages: Messages<typeof en> = { en, ru, es }
type Text = typeof en

const params = new URLSearchParams(window.location.search)
const scenario = params.get("guides")
let firstVisit = scenario === "first"

/** Called by the setup's last step on the review branch, so the page greets the owner once. */
export function arriveFromSetup() {
  firstVisit = true
  useNav.getState().go("guides")
}

const nameOf = (id: string) => tools.find((t) => t.id === id)?.name ?? id
const binOf = (id: string) => tools.find((t) => t.id === id)?.bin ?? id

type Fit = { ready: boolean; missing: string[]; messenger: string | null; extras: string[] }

function fitOf(g: Guide, has: (id: string) => boolean): Fit {
  const missing = (g.needs.all ?? []).filter((id) => !has(id))
  const any = g.needs.any ?? []
  const messenger = any.find(has) ?? null
  const ready = missing.length === 0 && (any.length === 0 || messenger !== null)
  return { ready, missing, messenger: messenger ?? any[0] ?? null, extras: (g.needs.extra ?? []).filter(has) }
}

// The site writes its prompts for Telegram; the owner who has only WhatsApp or MAX gets them for his messenger.
const forMessenger = (text: string, fit: Fit) =>
  fit.messenger && fit.messenger !== "tg"
    ? text.replace(/\btg CLI\b/g, `${binOf(fit.messenger)} CLI`).replace(/^tg /, `${binOf(fit.messenger)} `)
    : text

export function GuidesPage() {
  const m = useMessages(guidesMessages)
  const lang = useLang()
  const installs = useTools((s) => s.installs)
  const has = (id: string) => (installs[id]?.length ?? 0) > 0
  const [welcome] = useState(firstVisit)
  const [show, setShow] = useState<"all" | "ready">(welcome || scenario === "ready" ? "ready" : "all")
  const [open, setOpen] = useState<string | null>(params.get("guide"))
  const fits = new Map(GUIDES.map((g) => [g.id, fitOf(g, has)]))
  const readyCount = GUIDES.filter((g) => fits.get(g.id)?.ready).length

  useEffect(() => {
    firstVisit = false
    useTools.getState().refresh()
  }, [])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
          <p className="min-w-0 truncate text-[0.9rem] text-ink-dim">{scenario === "offline" ? m.offline : m.fresh}</p>
        </div>
        <SiteLink href={`https://wirecat.dev/${lang}/docs/prompting`}>{m.allOnSite}</SiteLink>
      </div>

      {welcome ? (
        <section
          aria-labelledby="guides-welcome"
          className="reveal flex gap-[0.9rem] rounded-[0.2rem] border border-brand/40 bg-brand-soft/60 px-[1.3rem] py-[1rem]"
        >
          <BookOpenText className="mt-[0.15rem] size-[1.3rem] shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
          <div className="max-w-[70ch]">
            <h2 id="guides-welcome" className="font-semibold">
              {m.welcomeTitle}
            </h2>
            <p className="mt-1 text-[0.95rem] text-ink-soft">{m.welcomeText}</p>
          </div>
        </section>
      ) : (
        <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.intro}</p>
      )}

      <div className="flex flex-col gap-[0.8rem]">
        <Filter
          label={m.filter}
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: m.all(GUIDES.length) },
            { value: "ready", label: m.ready(readyCount) },
          ]}
        />
        <Collapse open={show === "ready" && readyCount === 0}>
          <p className="text-[0.95rem] text-ink-soft">{m.noneReady}</p>
        </Collapse>
        <ul className="rounded-[0.2rem] border border-line-strong bg-app">
          {GUIDES.map((g) => {
            const fit = fits.get(g.id) as Fit
            return (
              <li key={g.id} className={cx((show === "all" || fit.ready) && "border-line border-t first:border-t-0")}>
                <Collapse open={show === "all" || fit.ready}>
                  <GuideRow
                    guide={g}
                    fit={fit}
                    lang={lang}
                    m={m}
                    has={has}
                    open={open === g.id}
                    onToggle={() => setOpen((o) => (o === g.id ? null : g.id))}
                  />
                </Collapse>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function GuideRow(props: {
  guide: Guide
  fit: Fit
  lang: Lang
  m: Text
  has: (id: string) => boolean
  open: boolean
  onToggle: () => void
}) {
  const { guide: g, fit, lang, m, has, open, onToggle } = props
  const header = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const [prompt, setPrompt] = useState(() => forMessenger(textOf(g.prompt, lang), fit))
  useEffect(() => setPrompt(forMessenger(textOf(g.prompt, lang), fit)), [lang, g, fit.messenger])
  const shown = [...(g.needs.all ?? []), ...(fit.messenger ? [fit.messenger] : []), ...fit.extras]
  // `?guide=<id>` stands in for a link from elsewhere in the app (a tool's details, the setup), which lands on the row.
  useEffect(() => {
    if (params.get("guide") === g.id) header.current?.scrollIntoView({ block: "start" })
  }, [g.id])

  const toggle = () => {
    if (header.current) holdInPlace(header.current)
    onToggle()
  }

  return (
    <>
      <div
        ref={header}
        className="grid min-h-[4.5rem] grid-cols-[1.2rem_4.4rem_minmax(0,1fr)_10.2rem] items-center gap-x-[0.9rem] px-[1.3rem] xl:grid-cols-[1.6rem_5rem_minmax(0,1fr)_11rem] xl:gap-x-[1.2rem]"
      >
        <Lamp tone={fit.ready ? "ok" : "idle"} label={fit.ready ? m.lampReady : m.lampMissing} />
        <span className="flex items-center gap-[0.45rem]">
          {shown.map((id) => (
            <ToolIcon key={id} id={id} className={cx("size-[1.35rem]", has(id) ? "text-ink" : "text-ink-dim")} />
          ))}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="group min-w-0 py-3 text-left"
        >
          <h3 className="text-[1.08rem] font-semibold leading-tight group-hover:text-brand">{textOf(g.title, lang)}</h3>
          <p className="mt-1 truncate text-[0.95rem] text-ink-soft">{textOf(g.outcome, lang)}</p>
        </button>
        <div className="flex justify-end">
          {fit.ready ? (
            <CopyButton text={prompt} m={m} />
          ) : (
            <Button
              className="min-w-[7.6rem]"
              onClick={() =>
                fit.missing[0]
                  ? openTool(fit.missing[0])
                  : fit.messenger
                    ? openTool(fit.messenger)
                    : useNav.getState().go("tools")
              }
            >
              {fit.missing[0] ? m.get(nameOf(fit.missing[0])) : m.getMessenger}
            </Button>
          )}
        </div>
      </div>
      <Collapse id={panelId} open={open}>
        <Panel guide={g} fit={fit} lang={lang} m={m} has={has} prompt={prompt} setPrompt={setPrompt} />
      </Collapse>
    </>
  )
}

function Panel(props: {
  guide: Guide
  fit: Fit
  lang: Lang
  m: Text
  has: (id: string) => boolean
  prompt: string
  setPrompt: (v: string) => void
}) {
  const { guide: g, fit, lang, m, has, prompt, setPrompt } = props
  const promptId = useId()
  const label = "text-[0.9rem] font-medium text-ink-dim"
  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-[0.6rem]">
        <label htmlFor={promptId} className={label}>
          {m.ask}
        </label>
        <textarea
          id={promptId}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full resize-y rounded-[0.4rem] border border-line-strong bg-app px-[0.8rem] py-[0.6rem] text-[0.95rem] leading-relaxed text-ink"
        />
        <p className="text-[0.9rem] text-ink-dim">{m.askHint}</p>
        <div className="flex flex-wrap items-center gap-x-[1rem] gap-y-2">
          {fit.ready && <CopyButton text={prompt} m={m} />}
          <button
            type="button"
            onClick={() => useNav.getState().go("agents")}
            className="text-[0.95rem] font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {m.whichAgents}
          </button>
        </div>
        <p className="text-[0.95rem] text-ink-soft">{m.pasteInto}</p>
        {g.saves && (
          <p className="flex gap-2 text-[0.95rem] text-ink-soft">
            <ShieldCheck className="mt-[0.2rem] size-[1rem] shrink-0 text-ok" aria-hidden />
            {m.asksFirst}
          </p>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-[1.2rem]">
        <section className="flex flex-col gap-[0.6rem]">
          <h4 className={label}>{m.runs}</h4>
          <ol className="flex flex-col gap-[0.7rem]">
            {g.steps.map((s, i) => (
              <li key={s.run} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-[0.6rem]">
                <span className="grid size-[1.5rem] place-items-center rounded-full bg-app-3 text-[0.85rem] font-medium text-ink-soft tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.95rem] text-ink">{textOf(s.text, lang)}</p>
                  <code className="selectable mt-0.5 block truncate font-mono text-[0.85rem] text-ink-soft">
                    {forMessenger(s.run, fit)}
                  </code>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[0.9rem] text-ink-dim">{m.account}</p>
        </section>

        <section className="flex flex-col gap-[0.4rem]">
          <h4 className={label}>{m.get_}</h4>
          <p className="text-[0.95rem] text-ink-soft">{textOf(g.result, lang)}</p>
        </section>

        <section className="flex flex-col gap-[0.5rem]">
          <h4 className={label}>{m.needs}</h4>
          <ul className="flex flex-col gap-[0.4rem]">
            {(g.needs.all ?? []).map((id) => (
              <Need key={id} id={id} has={has(id)} m={m} />
            ))}
            {g.needs.any && (
              <li className="flex flex-col gap-[0.4rem]">
                <span className="text-[0.9rem] text-ink-dim">{m.oneOf}</span>
                <ul className="flex flex-col gap-[0.4rem] pl-[0.9rem]">
                  {g.needs.any.map((id) => (
                    <Need key={id} id={id} has={has(id)} m={m} />
                  ))}
                </ul>
              </li>
            )}
            {(g.needs.extra ?? []).map((id) => (
              <Need key={id} id={id} has={has(id)} m={m} note={m.extra} />
            ))}
          </ul>
        </section>

        <SiteLink href={textOf(g.docs, lang)}>{m.fullGuide}</SiteLink>
      </div>
    </div>
  )
}

function Need({ id, has, m, note }: { id: string; has: boolean; m: Text; note?: string }) {
  return (
    <li className="flex min-h-[2rem] items-center gap-[0.6rem]">
      <Lamp size="sm" tone={has ? "ok" : "idle"} />
      <ToolIcon id={id} className="size-[1.1rem] text-ink" />
      <span className="font-medium">{nameOf(id)}</span>
      {note && <Pill>{note}</Pill>}
      <span className="ml-auto flex items-center gap-2">
        {has ? (
          <span className="text-[0.9rem] text-ink-soft">{m.installed}</span>
        ) : (
          <Button size="sm" onClick={() => openTool(id)}>
            {m.install}
          </Button>
        )}
      </span>
    </li>
  )
}

function CopyButton({ text, m }: { text: string; m: Text }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      className="min-w-[7.6rem]"
      icon={
        copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4 text-ink-dim" aria-hidden />
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

function Filter<T extends string>(props: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="inline-flex self-start rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{props.label}</legend>
      {props.options.map((o) => (
        <label key={o.value} className="relative">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={props.value === o.value}
            onChange={() => props.onChange(o.value)}
            className="peer sr-only"
          />
          <span className="block cursor-pointer rounded-[0.35rem] px-[0.8rem] py-[0.3rem] text-[0.9rem] font-medium text-ink-soft tabular-nums transition-colors duration-150 peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2 hover:text-ink">
            {o.label}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
