import {
  CircleAlert,
  CircleCheck,
  Cloud,
  Database,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  type LucideIcon,
  OctagonAlert,
  PackageCheck,
  QrCode,
  Server,
  Smartphone,
} from "lucide-react"
import { type ReactNode, useId, useMemo, useState } from "react"
import { PHONE_COUNTRIES } from "@/domain/asterisk-source"
import {
  allowedLink,
  type Block,
  type ChoiceBlock,
  classesOf,
  type Field,
  type Inline,
  type InputBlock,
  type Known,
  keptSecret,
  markdown,
  roleOf,
  type SetupDocument,
  shown,
} from "@/domain/setup-flow"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { ExtLink } from "@/shared/ExtLink"
import { OpenLink } from "@/shared/OpenLink"
import { Button } from "@/ui/Button"
import { Checkbox, Radio } from "@/ui/Checkbox"
import { CopyButton } from "@/ui/CopyButton"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { FieldError } from "@/ui/FieldError"
import { FilterMenu } from "@/ui/FilterMenu"
import { wideFieldClass } from "@/ui/field"
import { noticeBox } from "@/ui/notice"
import { SecretField } from "@/ui/SecretField"
import { Select } from "@/ui/Select"
import { flowMessages } from "./messages-flow"
import { typedSecret } from "./setup-flow-store"

/** Desktop's own icons by the names the format reserves; any other name draws no icon. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  file: FileText,
  database: Database,
  browser: Globe,
  key: KeyRound,
  qr: QrCode,
  phone: Smartphone,
  folder: Folder,
  server: Server,
  cloud: Cloud,
  lock: Lock,
}

/** An image the tool's package holds, as Rust read and checked it; any other address is never loaded. */
const IMAGE_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export type FlowView = {
  doc: SetupDocument
  images: Readonly<Record<string, string>>
  t: (id: string | undefined, params?: Record<string, string>) => string
  known: Known
  answers: Readonly<Record<string, unknown>>
  problems: Readonly<Record<string, string>>
  /** Domains the tool's catalog entry allows links to, besides WireCat's own. */
  domains: readonly string[]
  answer(id: string, value: unknown): void
  secret(id: string, value: string): void
}

export function Blocks({ blocks, view, row = false }: { blocks: readonly Block[]; view: FlowView; row?: boolean }) {
  return (
    <>
      {blocks
        .filter((block) => shown(block, view.known))
        .map((block, i) => (
          <BlockView key={`${block.type}-${block.id ?? i}`} block={block} view={view} row={row} />
        ))}
    </>
  )
}

function BlockView({ block, view, row }: { block: Block; view: FlowView; row: boolean }) {
  const own = classesOf(block.class)
  const wrap = (node: ReactNode) => <div className={cx("min-w-0", row && "flex-1", own)}>{node}</div>
  switch (block.type) {
    case "text":
      return wrap(<Rich text={view.t(block.text, block.params)} domains={view.domains} />)
    case "heading":
      return wrap(
        <h4 className={cx("font-semibold text-ink", block.level === 3 ? "text-[1rem]" : "text-[1.1rem]")}>
          {view.t(block.text, block.params)}
        </h4>,
      )
    case "note":
      return wrap(<Note role={roleOf("note", block.role)} text={view.t(block.text, block.params)} view={view} />)
    case "image": {
      // A height sizes the picture itself; the rest place its figure.
      const tall = (block.class ?? []).filter((name) => name.startsWith("h-"))
      const rest = (block.class ?? []).filter((name) => !name.startsWith("h-"))
      return <Picture block={block} view={view} classes={classesOf(rest)} height={classesOf(tall)} />
    }
    case "code":
      return wrap(<Code code={block.code} copy={block.copy !== false} />)
    case "input":
      return wrap(<InputField field={block as InputBlock} view={view} />)
    case "choice":
      return wrap(<Choice field={block as ChoiceBlock} view={view} />)
    case "group":
      return <Group block={block} view={view} classes={own} />
    case "link": {
      const href = allowedLink(block.href, view.domains)
      const text = view.t(block.text)
      if (!href) return wrap(<p className="text-body text-ink">{text}</p>)
      return wrap(
        roleOf("link", block.role) === "button" ? (
          <OpenLink url={href} variant="secondary" size="md">
            {text}
          </OpenLink>
        ) : (
          <ExtLink href={href}>{text}</ExtLink>
        ),
      )
    }
    case "requirement":
      return wrap(<Requirement text={view.t(block.text)} fix={block.fix ? view.t(block.fix) : null} view={view} />)
    case "divider":
      return <hr className={cx("border-line", own)} />
    default:
      return block.fallback ? wrap(<Rich text={view.t(block.fallback)} domains={view.domains} />) : null
  }
}

/** Restricted Markdown: React escapes every string, so raw HTML stays text, and a link goes only where allowed. */
function Rich({ text, domains }: { text: string; domains: readonly string[] }) {
  const parts = markdown(text)
  return (
    <div className="selectable flex flex-col gap-2 text-body leading-relaxed text-ink">
      {parts.map((part, i) => {
        const key = `${part.t}-${i}`
        if (part.t === "p") return <p key={key}>{inlines(part.c, domains)}</p>
        if (part.t === "h")
          return (
            <p key={key} className="font-semibold">
              {inlines(part.c, domains)}
            </p>
          )
        const List = part.t === "ul" ? "ul" : "ol"
        return (
          <List key={key} className={cx("flex flex-col gap-1 pl-5", part.t === "ul" ? "list-disc" : "list-decimal")}>
            {part.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a text's list never reorders
              <li key={j}>{inlines(item, domains)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}

function inlines(parts: readonly Inline[], domains: readonly string[]): ReactNode {
  // biome-ignore lint/suspicious/noArrayIndexKey: parsed text never reorders
  return parts.map((part, i) => <InlineView key={i} part={part} domains={domains} />)
}

function InlineView({ part, domains }: { part: Inline; domains: readonly string[] }): ReactNode {
  if (part.t === "text") return part.v
  if (part.t === "code") return <code className="rounded bg-app-3 px-1 font-mono text-[0.92em]">{part.v}</code>
  if (part.t !== "link") {
    const Mark = part.t
    return <Mark>{inlines(part.c, domains)}</Mark>
  }
  const href = allowedLink(part.href, domains)
  return href ? <ExtLink href={href}>{inlines(part.c, domains)}</ExtLink> : inlines(part.c, domains)
}

const NOTE_ICONS: Record<string, LucideIcon> = {
  tip: Lightbulb,
  info: Info,
  warning: CircleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
}

function Note({ role = "info", text, view }: { role: string | undefined; text: string; view: FlowView }) {
  const Icon = NOTE_ICONS[role] ?? Info
  const box =
    role === "danger"
      ? noticeBox("bad")
      : role === "warning"
        ? noticeBox("warn")
        : role === "success"
          ? "rounded-rack border border-ok/40 bg-ok/10 px-4 py-3"
          : "rounded-rack border border-line bg-app-2 px-4 py-3"
  const tint =
    role === "danger" ? "text-bad" : role === "warning" ? "text-warn" : role === "success" ? "text-ok" : "text-brand"
  return (
    <div className={cx("flex items-start gap-3", box)}>
      <Icon className={cx("mt-[0.2rem] size-[1.1rem] shrink-0", tint)} aria-hidden />
      <Rich text={text} domains={view.domains} />
    </div>
  )
}

function Picture({
  block,
  view,
  classes,
  height,
}: {
  block: Extract<Block, { type: "image" }>
  view: FlowView
  classes: string
  height: string
}) {
  const m = useMessages(flowMessages)
  const src = view.images[block.asset]
  const alt = view.t(block.alt)
  const size = view.doc.assets?.[block.asset]
  return (
    <figure className={cx("flex min-w-0 flex-col items-start gap-1.5", classes)}>
      {src && IMAGE_URL.test(src) ? (
        <img
          src={src}
          alt={alt}
          width={size?.width}
          height={size?.height}
          className={cx("h-auto w-auto max-w-full rounded-rack border border-line object-contain", height)}
        />
      ) : (
        <div className="rounded-rack border border-line-strong border-dashed px-4 py-3 text-body text-ink-soft">
          <span className="sr-only">{m.noImage}: </span>
          {block.fallback ? view.t(block.fallback) : alt}
        </div>
      )}
      {block.caption && <figcaption className="text-[0.85rem] text-ink-soft">{view.t(block.caption)}</figcaption>}
    </figure>
  )
}

/** A command or a value to copy; nothing here ever runs it. */
function Code({ code, copy }: { code: string; copy: boolean }) {
  const m = useMessages(flowMessages)
  return (
    <div className="flex items-start gap-2 rounded-rack border border-line bg-app-2 p-2 pl-3">
      <pre className="selectable min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all py-1 font-mono text-[0.92rem] text-ink">
        {code}
      </pre>
      {copy && <CopyButton value={code} label={m.copy} size="sm" variant="ghost" />}
    </div>
  )
}

function Group({
  block,
  view,
  classes,
}: {
  block: Extract<Block, { type: "group" }>
  view: FlowView
  classes: string
}) {
  const role = roleOf("group", block.role)
  const title = block.title ? view.t(block.title) : null
  const gap = /\bgap-\d/.test(classes) ? "" : "gap-4"
  if (role === "row")
    return (
      <div className={cx("flex flex-col sm:flex-row sm:items-start", gap, classes)}>
        <Blocks blocks={block.blocks} view={view} row />
      </div>
    )
  const inner = (
    <div className={cx("flex flex-col", gap, classes)}>
      <Blocks blocks={block.blocks} view={view} />
    </div>
  )
  if (role === "details") return <Disclosure summary={title}>{inner}</Disclosure>
  return (
    <section className={cx("flex flex-col gap-3", role === "card" && "rounded-rack border border-line p-4")}>
      {title && <h4 className="text-[1rem] font-semibold text-ink">{title}</h4>}
      {inner}
    </section>
  )
}

/** Shown only: v1 runs no check and installs nothing; the fix is a text, a command in it is to copy. */
function Requirement({ text, fix, view }: { text: string; fix: string | null; view: FlowView }) {
  const m = useMessages(flowMessages)
  return (
    <div className="flex items-start gap-3 rounded-rack border border-line px-4 py-3">
      <PackageCheck className="mt-[0.2rem] size-[1.1rem] shrink-0 text-ink-soft" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[0.8rem] font-medium tracking-wide text-ink-dim uppercase">{m.needLater}</p>
        <p className="font-medium text-ink">{text}</p>
        {fix && <Rich text={fix} domains={view.domains} />}
      </div>
    </div>
  )
}

function FieldFrame({
  id,
  field,
  view,
  children,
  label = true,
}: {
  id: string
  field: Field
  view: FlowView
  children: ReactNode
  label?: boolean
}) {
  const m = useMessages(flowMessages)
  const problem = view.problems[field.id]
  const said = problem === "is needed" ? m.needed : problem
  const hint = field.hint ? view.t(field.hint) : null
  const kept = keptSecret(field, view.doc.values) ? m.keepSecret : null
  return (
    <div className="flex flex-col gap-1.5">
      {label && field.label && (
        <label htmlFor={id} className="text-[0.95rem] font-medium text-ink">
          {view.t(field.label)}
        </label>
      )}
      {children}
      <FieldError id={`${id}-error`}>{said}</FieldError>
      {(hint || kept) && (
        <p id={`${id}-hint`} className="text-[0.85rem] leading-snug text-ink-soft">
          {[hint, kept].filter(Boolean).join(" ")}
        </p>
      )}
    </div>
  )
}

const ariaOf = (id: string, field: Field, view: FlowView) => {
  const invalid = view.problems[field.id] !== undefined
  const said = [invalid ? `${id}-error` : null, field.hint || keptSecret(field, view.doc.values) ? `${id}-hint` : null]
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": said.filter(Boolean).join(" ") || undefined,
  }
}

const asText = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")
const asList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [])

function InputField({ field, view }: { field: InputBlock; view: FlowView }) {
  const id = useId()
  const m = useMessages(flowMessages)
  const lang = useLang()
  const value = view.answers[field.id]
  const aria = ariaOf(id, field, view)
  const placeholder = field.placeholder ? view.t(field.placeholder) : undefined
  const set = (next: unknown) => view.answer(field.id, next)
  switch (field.input) {
    case "password":
      return (
        <FieldFrame id={id} field={field} view={view}>
          <Password id={id} field={field} view={view} aria={aria} />
        </FieldFrame>
      )
    case "toggle":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2.5">
            <Checkbox id={id} checked={value === true} onChange={(on) => set(on)} className="mt-[0.2rem]" {...aria} />
            <label htmlFor={id} className="text-[0.95rem] font-medium text-ink">
              {view.t(field.label)}
            </label>
          </div>
          <FieldFrame id={id} field={field} view={view} label={false}>
            {null}
          </FieldFrame>
        </div>
      )
    case "select": {
      const options = (field.options ?? []).map((o) => ({ value: o.value, label: view.t(o.label) }))
      return (
        <FieldFrame id={id} field={field} view={view}>
          <Select
            id={id}
            value={asText(value)}
            onChange={set}
            options={options}
            placeholder={placeholder ?? m.choose}
            size="lg"
            {...aria}
          />
        </FieldFrame>
      )
    }
    case "multiselect":
    case "countries":
      return (
        <FieldFrame id={id} field={field} view={view} label={false}>
          <ListPicker field={field} view={view} id={id} lang={lang} />
        </FieldFrame>
      )
    case "timezone":
      return (
        <FieldFrame id={id} field={field} view={view}>
          <Select
            id={id}
            value={asText(value)}
            onChange={set}
            options={zones()}
            placeholder={placeholder ?? m.choose}
            size="lg"
            {...aria}
          />
        </FieldFrame>
      )
    case "file":
    case "folder":
      return (
        <FieldFrame id={id} field={field} view={view}>
          <div className="flex gap-2">
            <input
              id={id}
              spellCheck={false}
              autoComplete="off"
              value={asText(value)}
              placeholder={placeholder}
              onChange={(e) => set(e.target.value)}
              className={wideFieldClass}
              {...aria}
            />
            <PickPath folder={field.input === "folder"} accept={field.accept ?? []} onPick={set} />
          </div>
        </FieldFrame>
      )
    default: {
      const numeric = field.input === "port" || field.input === "number"
      const common = {
        id,
        spellCheck: false,
        autoComplete: "off",
        value: asText(value),
        placeholder,
        className: wideFieldClass,
        ...aria,
      }
      return (
        <FieldFrame id={id} field={field} view={view}>
          {field.multiline ? (
            <textarea
              {...common}
              rows={4}
              onChange={(e) => set(e.target.value)}
              className={cx(wideFieldClass, "h-auto py-2", classesOf(field.class))}
            />
          ) : (
            <input {...common} inputMode={numeric ? "numeric" : undefined} onChange={(e) => set(e.target.value)} />
          )}
        </FieldFrame>
      )
    }
  }
}

/** The password stays outside the store and reaches the tool only on its stdin; a kept one is never shown back. */
function Password({
  id,
  field,
  view,
  aria,
}: {
  id: string
  field: InputBlock
  view: FlowView
  aria: ReturnType<typeof ariaOf>
}) {
  const m = useMessages(flowMessages)
  const [value, setValue] = useState(() => typedSecret(field.id))
  return (
    <SecretField
      id={id}
      value={value}
      onChange={(next) => {
        setValue(next)
        view.secret(field.id, next)
      }}
      showLabel={m.show}
      hideLabel={m.hide}
      invalid={aria["aria-invalid"] === true}
      {...(aria["aria-describedby"] ? { describedBy: aria["aria-describedby"] } : {})}
    />
  )
}

function ListPicker({ field, view, id, lang }: { field: InputBlock; view: FlowView; id: string; lang: string }) {
  const m = useMessages(flowMessages)
  const countries = field.input === "countries"
  const options = useMemo(() => {
    if (!countries) return (field.options ?? []).map((o) => ({ value: o.value, label: view.t(o.label) }))
    const names = new Intl.DisplayNames([lang], { type: "region" })
    return PHONE_COUNTRIES.map((code) => ({
      value: code.toUpperCase(),
      label: names.of(code.toUpperCase()) ?? code,
      hint: code.toUpperCase(),
    })).sort((a, b) => a.label.localeCompare(b.label, lang))
  }, [countries, field.options, view, lang])
  const label = view.t(field.label)
  return (
    <div id={id} className="flex flex-col gap-1.5" {...ariaOf(id, field, view)}>
      <p className="text-[0.95rem] font-medium text-ink">{label}</p>
      <div className="flex">
        <FilterMenu
          label={countries ? m.countries : label}
          empty={m.noCountry}
          search
          options={options}
          selected={asList(view.answers[field.id])}
          onChange={(values) => view.answer(field.id, values)}
        />
      </div>
    </div>
  )
}

let zoneList: { value: string; label: string }[] | null = null
const zones = () => {
  zoneList ??= (Intl.supportedValuesOf?.("timeZone") ?? []).map((zone) => ({
    value: zone,
    label: zone.replaceAll("_", " "),
  }))
  return zoneList
}

/** The system's own window: the path comes from it, and the tool's schema checks it like a typed one. */
function PickPath({ folder, accept, onPick }: { folder: boolean; accept: string[]; onPick: (path: string) => void }) {
  const m = useMessages(flowMessages)
  const [busy, setBusy] = useState(false)
  const pick = async () => {
    setBusy(true)
    try {
      const path = await platform.setupPickPath(folder, accept)
      if (path !== null) onPick(path)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="secondary"
      busy={busy}
      icon={<FolderOpen className="size-4" aria-hidden />}
      onClick={() => void pick()}
      className="h-10 shrink-0"
    >
      {folder ? m.chooseFolder : m.chooseFile}
    </Button>
  )
}

/** A choice drawn as cards, one per option; its answer usually picks the next step. */
function Choice({ field, view }: { field: ChoiceBlock; view: FlowView }) {
  const name = useId()
  const m = useMessages(flowMessages)
  const value = view.answers[field.id]
  const problem = view.problems[field.id]
  const many = field.options.length
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0" {...ariaOf(name, field, view)}>
      {field.label && <legend className="mb-2 text-[1rem] font-semibold text-ink">{view.t(field.label)}</legend>}
      <div className={cx("grid gap-2", many >= 3 ? "sm:grid-cols-3" : many === 2 ? "sm:grid-cols-2" : "")}>
        {field.options.map((option) => {
          const id = `${name}-${option.value}`
          const Icon = option.icon ? ICONS[option.icon] : undefined
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line-strong px-3 py-2.5 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <Radio
                id={id}
                name={name}
                checked={value === option.value}
                onChange={() => view.answer(field.id, option.value)}
                className="mt-[0.2rem]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[0.95rem] font-medium text-ink">
                  {Icon && <Icon className="size-4 shrink-0 text-ink-soft" aria-hidden />}
                  {view.t(option.label)}
                </span>
                {option.hint && <span className="text-[0.8rem] leading-snug text-ink-soft">{view.t(option.hint)}</span>}
              </span>
            </label>
          )
        })}
      </div>
      <FieldError id={`${name}-error`}>{problem === "is needed" ? m.pickOne : problem}</FieldError>
      {field.hint && <p className="text-[0.85rem] text-ink-soft">{view.t(field.hint)}</p>}
    </fieldset>
  )
}
