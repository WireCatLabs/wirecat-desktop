import { Building2, Check, LoaderCircle } from "lucide-react"
import { useId, useState } from "react"
import { formatList, useLang, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import type { MatchGroup } from "./groups"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { sortMessages } from "./messages-sort"
import { Refusal } from "./Refusal"
import { usePeople } from "./store"

const open = (group: MatchGroup) => {
  const decided = usePeople.getState().decided
  return group.matches.filter((x) => !decided[x.id]).map((x) => x.id)
}

/** "Company mailbox": the card's shared address belongs to a company, so none of its people is joined by it. */
export function CompanyButton({ group }: { group: MatchGroup }) {
  const m = useMessages(peopleMessages)
  const busy = usePeople((s) => s.busy[group.key])
  return (
    <Button
      size="sm"
      disabled={!!busy}
      icon={
        busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Building2 className="size-4" aria-hidden />
        )
      }
      onClick={() => void usePeople.getState().resolveMailbox(group.key, open(group), {})}
    >
      {m.companyMailbox}
    </Button>
  )
}

/**
 * "Company address" on a match by name: the owner says which of the two people's addresses is a company's. The address
 * goes to the company, and the people stay apart and are not suggested again on it.
 */
export function CompanyAddress({
  group,
  addresses,
  onCancel,
}: {
  group: MatchGroup
  addresses: readonly string[]
  onCancel: () => void
}) {
  const m = useMessages(peopleMessages)
  const busy = usePeople((s) => s.busy[group.key])
  const asked = usePeople((s) => s.company[group.key]?.asked)
  const head = useId()
  return (
    <fieldset aria-labelledby={head} className="reveal flex flex-col gap-[0.45rem]">
      <legend id={head} className="text-[0.95rem] font-medium">
        {m.companyAddressAsk}
      </legend>
      <p className="text-[0.9rem] text-ink-soft">{m.companyAddressHelp}</p>
      <span className="flex flex-wrap items-center gap-2">
        {addresses.map((a) => (
          <Button
            key={a}
            size="sm"
            disabled={!!busy}
            aria-pressed={asked === a}
            icon={
              busy && asked === a ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Building2 className="size-4" aria-hidden />
              )
            }
            onClick={() => void usePeople.getState().resolveMailbox(group.key, open(group), { mailbox: a })}
          >
            <span className="selectable font-mono text-[0.88rem]">{a}</span>
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={onCancel}>
          {m.cancel}
        </Button>
      </span>
    </fieldset>
  )
}

/** What giving the mailbox to a company did, and what memo needs when it refused: a company's name, or which one. */
export function CompanyFollowUp({ group }: { group: MatchGroup }) {
  const m = useMessages(peopleMessages)
  const sm = useMessages(sortMessages)
  const lang = useLang()
  const done = usePeople((s) => s.company[group.key])
  if (!done) return null
  if (!done.refused && done.via === "organization")
    return (
      <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
        <Check className="size-4 shrink-0 text-ok" aria-hidden />
        {done.mailboxes.length > 0
          ? sm.oneCompanyDone(formatList(done.mailboxes, lang), done.name)
          : sm.oneCompanyMoved(done.name)}
      </p>
    )
  if (!done.refused)
    return (
      <div className="reveal flex flex-col gap-[0.6rem]">
        <p role="status" className="flex items-center gap-2 text-[0.95rem] text-ink-soft">
          <Check className="size-4 shrink-0 text-ok" aria-hidden />
          {m.companyDone(done.mailbox ?? group.mailbox ?? "")}
        </p>
        {done.organization && <MailboxUsers group={group} organization={done.organization} />}
      </div>
    )
  const { reason, message, organizations } = done.refused
  // On a match by name memo refuses an address that is not one of theirs at a company's domain.
  const said =
    !group.mailbox && reason === "identity.not-shared"
      ? m.companyAddressRefused
      : (m.companyReasons[reason] ?? sm.reasons[reason])
  return (
    <div className="flex flex-col gap-[0.5rem]">
      <ErrorNotice inline>{said ?? m.companyFailed}</ErrorNotice>
      {(reason === "organization.unnamed" || reason === "organization.ambiguous") && (
        <CompanyChoice group={group} organizations={organizations} via={done.via} />
      )}
      <Disclosure summary={m.details}>
        <p className="selectable font-mono text-[0.85rem] text-ink-soft">{message}</p>
      </Disclosure>
    </div>
  )
}

function CompanyChoice({
  group,
  organizations,
  via,
}: {
  group: MatchGroup
  organizations: readonly { ref: string; name: string | null }[]
  /** The answer that was refused: the company's name or choice goes back to it, not to the other one. */
  via: "mailbox" | "organization"
}) {
  const m = useMessages(peopleMessages)
  const busy = usePeople((s) => s.busy[group.key])
  const [name, setName] = useState("")
  const field = useId()
  const error = useFieldError(field)
  const send = (to: { organization?: string; name?: string }) => {
    const { resolveCompany, resolveMailbox } = usePeople.getState()
    void (via === "organization" ? resolveCompany : resolveMailbox)(group.key, open(group), to)
  }
  return (
    <div className="flex flex-col gap-[0.45rem]">
      {organizations.length > 0 && (
        <span className="flex flex-wrap items-center gap-2">
          {organizations.map((o) => (
            <Button key={o.ref} size="sm" disabled={!!busy} onClick={() => send({ organization: o.ref })}>
              {o.name ?? o.ref}
            </Button>
          ))}
        </span>
      )}
      <form
        className="flex flex-col gap-[0.45rem]"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) send({ name: name.trim() })
          else error.fail((l) => peopleMessages[l].companyNameNeeded)
        }}
      >
        <label htmlFor={field} className="text-[0.9rem] font-medium">
          {organizations.length > 0 ? m.companyOtherName : m.companyName}
        </label>
        <span className="flex flex-wrap items-center gap-2">
          <input
            id={field}
            maxLength={200}
            value={name}
            aria-invalid={error.field["aria-invalid"]}
            aria-describedby={error.field["aria-describedby"]}
            onChange={(e) => {
              error.clear()
              setName(e.target.value)
            }}
            className={cx(
              "selectable h-9 min-w-0 flex-1 basis-[14rem] rounded-[0.35rem] border border-line-strong bg-app px-3 text-[0.95rem]",
              invalidBorder,
            )}
          />
          <Button type="submit" size="sm" disabled={!!busy}>
            {m.companySave}
          </Button>
        </span>
        {error.hint}
      </form>
    </div>
  )
}

/**
 * Who of the card's people writes from the company's mailbox. memo has no link between a person and one address, so
 * each is saved as the organization's contact: the mailbox stays the company's and the people stay apart.
 */
function MailboxUsers({ group, organization }: { group: MatchGroup; organization: string }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  const busy = usePeople((s) => s.busy[group.key])
  const saved = usePeople((s) => s.mailboxUsers[group.key])
  const failed = usePeople((s) => s.failed[group.key])
  const [picked, setPicked] = useState<string[]>([])
  const list = useId()
  const head = useId()
  const error = useFieldError(list)
  if (saved && saved.length > 0 && !failed)
    return (
      <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
        <Check className="size-4 shrink-0 text-ok" aria-hidden />
        {m.mailboxUsersSaved(
          formatList(
            saved.map((r) => name(r)),
            lang,
          ),
        )}
      </p>
    )
  return (
    <fieldset aria-labelledby={head} className="flex flex-col gap-[0.45rem]">
      <legend id={head} className="text-[0.95rem] font-medium">
        {m.mailboxUsersAsk}
      </legend>
      <p className="text-[0.9rem] text-ink-soft">{m.mailboxUsersHelp}</p>
      <div
        id={list}
        tabIndex={-1}
        aria-invalid={error.field["aria-invalid"]}
        aria-describedby={error.field["aria-describedby"]}
        className="flex flex-wrap gap-x-[1.1rem] gap-y-[0.4rem]"
      >
        {group.people.map((ref) => {
          const box = `${list}-${ref}`
          return (
            <label key={ref} htmlFor={box} className="flex min-w-0 cursor-pointer items-center gap-[0.45rem]">
              <Checkbox
                id={box}
                checked={picked.includes(ref)}
                onChange={(on) => {
                  error.clear()
                  setPicked((p) => (on ? [...p, ref] : p.filter((x) => x !== ref)))
                }}
              />
              <span className="min-w-0 truncate">{name(ref)}</span>
            </label>
          )
        })}
      </div>
      {error.hint}
      <span>
        <Button
          size="sm"
          disabled={!!busy}
          icon={busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
          onClick={() => {
            if (picked.length === 0) return error.fail((l) => peopleMessages[l].mailboxUsersNone)
            void usePeople.getState().saveMailboxUsers(group.key, organization, picked)
          }}
        >
          {m.mailboxUsersSave}
        </Button>
      </span>
      {failed && <Refusal error={failed} />}
    </fieldset>
  )
}
