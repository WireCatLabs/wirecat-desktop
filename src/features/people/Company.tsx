import { Building2, Check, LoaderCircle } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import type { MatchGroup } from "./groups"
import { peopleMessages } from "./messages"
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

/** What giving the mailbox to a company did, and what memo needs when it refused: a company's name, or which one. */
export function CompanyFollowUp({ group }: { group: MatchGroup }) {
  const m = useMessages(peopleMessages)
  const done = usePeople((s) => s.company[group.key])
  if (!done) return null
  if (!done.refused)
    return (
      <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
        <Check className="size-4 shrink-0 text-ok" aria-hidden />
        {m.companyDone(done.mailbox ?? group.mailbox ?? "")}
      </p>
    )
  const { reason, message, organizations } = done.refused
  const said = m.companyReasons[reason]
  return (
    <div className="flex flex-col gap-[0.5rem]">
      <ErrorNotice inline>{said ?? m.companyFailed}</ErrorNotice>
      {(reason === "organization.unnamed" || reason === "organization.ambiguous") && (
        <CompanyChoice group={group} organizations={organizations} />
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
}: {
  group: MatchGroup
  organizations: readonly { ref: string; name: string | null }[]
}) {
  const m = useMessages(peopleMessages)
  const busy = usePeople((s) => s.busy[group.key])
  const [name, setName] = useState("")
  const field = useId()
  const error = useFieldError(field)
  const send = (to: { organization?: string; name?: string }) =>
    void usePeople.getState().resolveMailbox(group.key, open(group), to)
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
