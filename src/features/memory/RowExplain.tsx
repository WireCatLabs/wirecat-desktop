import { Pencil, Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { can, stateOf, toneOf } from "@/domain/memory"
import { relationParts, roleIdOf, roleLabel, roleListFor } from "@/domain/relationships"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { ExtLink } from "@/shared/ExtLink"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyRef } from "@/ui/CopyRef"
import { cx } from "@/ui/cx"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { Pill } from "@/ui/Pill"
import { Select } from "@/ui/Select"
import { relationSentence, textOf } from "./labels"
import { memoryMessages } from "./messages"
import { explainedMessages } from "./messages-explained"
import { RowFailed } from "./RowFailed"
import { SourceItem } from "./RowSources"
import { canRevoke, ownerRoles, useMemory } from "./store"

const TONES = { warn: "warn", ok: "brand", bad: "bad", idle: "neutral" } as const

/** A record's state in words, where a coloured dot alone said it before. */
export function StatusPill({ status }: { status: string }) {
  const m = useMessages(memoryMessages)
  return <Pill tone={TONES[toneOf(status)]}>{m.states[stateOf(status)]}</Pill>
}

const SOURCE_APPS: Record<string, string> = { bitrix24: "Bitrix24", drive: "Google Drive", amocrm: "amoCRM" }
const appOf = (account: string | null) => {
  const app = account?.split(":")[0] ?? ""
  return SOURCE_APPS[app] ?? app
}

/** What the owner's decision changes, said before it is made: what agents will know, and what each button does. */
export function Outcome({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const roles = useMemory(ownerRoles)
  if (entry.type === "action" || entry.findings) return null
  const state = stateOf(entry.status)
  const what = entry.type === "relationship" ? relationSentence(entry, m, x, roles) : textOf(entry, m, roles, x)
  return (
    <section className="flex flex-col gap-[0.5rem] rounded-[0.45rem] border border-line bg-app px-[0.95rem] py-[0.8rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{x.whatWouldBeSaved}</h3>
      <p className="selectable text-[1rem] leading-snug font-medium">{what}</p>
      {state === "review" ? (
        <dl className="mt-[0.2rem] grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-[0.25rem] text-[0.92rem]">
          <dt className="font-medium text-ok">{x.ifApprove}</dt>
          <dd className="text-ink-soft">{x.approveEffect}</dd>
          <dt className="font-medium text-ink">{x.ifReject}</dt>
          <dd className="text-ink-soft">{x.rejectEffect}</dd>
        </dl>
      ) : (
        <p className="text-[0.92rem] text-ink-soft">
          {entry.standing === "reported" && entry.account
            ? x.reportedEffect(appOf(entry.account))
            : state === "inuse" || state === "approved"
              ? x.inUseEffect
              : x.discardedEffect}
        </p>
      )}
    </section>
  )
}

const READABLE = /^(document|note|msg|meeting):/

/**
 * Where a relationship came from: a source writes a document's owner with the document as its first end, so that
 * document opens here as a source does under any memory.
 */
export function RelationSource({ entry }: { entry: MemoryEntry }) {
  const x = useMessages(explainedMessages)
  const from = entry.subject && READABLE.test(entry.subject) ? entry.subject : null
  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{x.whereFrom}</h3>
      {from ? (
        <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
          <SourceItem
            source={{
              ref: from,
              kind: from.slice(0, from.indexOf(":")),
              title: entry.subjectName,
              sender: null,
              at: null,
              excerpt: entry.reason,
              tool: null,
              missing: false,
            }}
          />
        </ul>
      ) : (
        <p className="text-[0.95rem] text-ink-soft">{entry.reason ?? x.noSource}</p>
      )}
    </div>
  )
}

/** An always visible way in to Edit, beside what would be saved: the row's own menu was easy to miss. */
export function EditButton({ entry }: { entry: MemoryEntry }) {
  const x = useMessages(explainedMessages)
  const revoke = useMemory(canRevoke)
  const busy = useMemory((s) => s.busy[entry.ref])
  const editing = useMemory((s) => s.correcting === entry.ref)
  if (editing || !can(entry, revoke).correct) return null
  return (
    <span>
      <Button
        size="sm"
        disabled={!!busy}
        onClick={() => useMemory.getState().startCorrect(entry.ref)}
        icon={<Pencil className="size-4" aria-hidden />}
      >
        {x.edit}
      </Button>
    </span>
  )
}

const NONE = "__none"

/** A relationship's role, chosen from memo's list for the other end, or typed where memo has none. */
export function RelationEdit({ entry, onDone }: { entry: MemoryEntry; onDone: () => void }) {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const roles = useMemory(ownerRoles)
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const { editRelation, removeRelation } = useMemory.getState()
  const lang = useLang()
  const parts = relationParts(entry)
  const list = entry.roleList ?? roleListFor(parts)
  const listed = list ? roles.filter((r) => r.list === list) : []
  const [role, setRole] = useState(entry.role ?? "")
  const label = useId()
  const hint = useId()
  const proposal = entry.status === "proposed"
  const options = [
    { value: NONE, label: x.noRoleChoice },
    ...listed.map((r) => ({ value: r.id, label: roleLabel(r.id, roles, m.roles, lang) })),
    ...(role && !listed.some((r) => r.id === role)
      ? [{ value: role, label: roleLabel(role, roles, m.roles, lang) }]
      : []),
  ]
  const save = () => void editRelation(entry.ref, role.trim() || null).then((done) => done && onDone())
  return (
    <form
      className="flex flex-col gap-[0.6rem]"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onDone()
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[14rem] flex-col gap-[0.3rem]">
          <span id={label} className="text-[0.9rem] text-ink-dim">
            {list ? x.role : x.roleFree}
          </span>
          {list ? (
            <Select<string>
              value={role || NONE}
              onChange={(v) => setRole(v === NONE ? "" : v)}
              options={options}
              aria-labelledby={label}
            />
          ) : (
            <input
              aria-labelledby={label}
              maxLength={80}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="inner-field h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.6rem] text-[0.95rem] focus:border-brand focus:ring-1 focus:ring-brand"
            />
          )}
        </div>
        {list && <AddRole list={list} taken={listed.map((r) => r.id)} onAdded={setRole} />}
      </div>
      {!proposal && (
        <p id={hint} className="text-[0.9rem] text-ink-dim">
          {x.removeHint}
        </p>
      )}
      {failed && <RowFailed failed={failed} label={x.editFailed} />}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          type="submit"
          variant={proposal ? "primary" : "secondary"}
          disabled={!!busy}
          busy={busy === "correct"}
        >
          {proposal ? x.saveAndApprove : x.save}
        </Button>
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={onDone}>
          {x.cancel}
        </Button>
        {!proposal && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-bad hover:text-bad"
            disabled={!!busy}
            onClick={() => void removeRelation(entry.ref)}
            busy={busy === "remove"}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            {busy === "remove" ? x.removing : x.remove}
          </Button>
        )}
      </div>
    </form>
  )
}

/** The owner's own role, added to memo's list for this kind of link and chosen at once. */
function AddRole({ list, taken, onAdded }: { list: string; taken: readonly string[]; onAdded: (id: string) => void }) {
  const x = useMessages(explainedMessages)
  const addRole = useMemory((s) => s.addRole)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const field = useId()
  const need = useFieldError(field)
  const close = () => {
    setName("")
    need.clear()
    setOpen(false)
  }
  const add = async () => {
    const label = name.trim()
    if (!label) return need.fail(x.newRoleMissing)
    const id = roleIdOf(label)
    if (!taken.includes(id)) {
      setBusy(true)
      const refused = await addRole(list, id, label)
      setBusy(false)
      if (refused) return need.fail(x.addRoleFailed(refused))
    }
    onAdded(id)
    close()
  }
  return (
    <div className="flex flex-col">
      {!open && (
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
          {x.addRole}
        </Button>
      )}
      <Collapse open={open}>
        <div className="flex flex-col gap-[0.3rem]">
          <label htmlFor={field} className="text-[0.9rem] text-ink-dim">
            {x.newRole}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={field}
              // biome-ignore lint/a11y/noAutofocus: the owner just asked for this field
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                need.clear()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void add()
                }
                // The form's own Escape closes the whole editor and drops the role picked so far.
                if (e.key === "Escape") {
                  e.stopPropagation()
                  close()
                }
              }}
              {...need.field}
              className={cx(
                "inner-field h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.6rem] text-[0.95rem] focus:border-brand focus:ring-1 focus:ring-brand",
                invalidBorder,
              )}
            />
            <Button size="sm" disabled={busy} busy={busy} onClick={() => void add()}>
              {x.addRole}
            </Button>
            <Button size="sm" variant="secondary" onClick={close}>
              {x.cancel}
            </Button>
          </div>
          {need.hint}
        </div>
      </Collapse>
    </div>
  )
}

/** What the document at a link's end is and where it lives, so the owner can judge the link before deciding. */
export function DocumentFacts({ entry }: { entry: MemoryEntry }) {
  const x = useMessages(explainedMessages)
  const lang = useLang()
  const doc = entry.document
  if (!doc) return null
  const folder = doc.path?.includes("/") ? doc.path.slice(0, doc.path.lastIndexOf("/")) : null
  return (
    <section className="flex flex-col gap-[0.4rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{x.document}</h3>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="selectable font-medium">{doc.title ?? doc.ref}</span>
        <CopyRef value={doc.ref} className="-my-1 -ml-[0.6rem] self-center" />
        {doc.url && <ExtLink href={doc.url}>{x.documentOpen}</ExtLink>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-[0.2rem] text-[0.92rem]">
        {folder && (
          <>
            <dt className="text-ink-dim">{x.documentFolder}</dt>
            <dd className="selectable break-all font-mono text-[0.88rem] text-ink-soft">{folder}</dd>
          </>
        )}
        {doc.modifiedAt && (
          <>
            <dt className="text-ink-dim">{x.documentChanged}</dt>
            <dd className="text-ink-soft">{formatDate(doc.modifiedAt, { dateStyle: "medium" }, lang)}</dd>
          </>
        )}
      </dl>
    </section>
  )
}
