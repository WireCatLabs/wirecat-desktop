import { useEffect, useId, useState } from "react"
import { useMessages } from "@/i18n"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { fieldClass } from "@/ui/field"
import { Pill } from "@/ui/Pill"
import { useAddPerson } from "./add"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { addPersonMessages } from "./messages-add"
import { usePeople } from "./store"

const CHECK_AFTER_MS = 300

/**
 * Adds a person by name. While the name is typed it lists people whose names start the same way, so a duplicate is
 * opened rather than made; the very same name asks once more before it is added.
 */
export function AddPerson() {
  const m = useMessages(addPersonMessages)
  const p = useMessages(peopleMessages)
  const name = usePersonName()
  const s = useAddPerson()
  const [draft, setDraft] = useState("")
  const [anyway, setAnyway] = useState(false)
  const field = useId()
  const need = useFieldError(field)
  const typed = draft.trim()
  useEffect(() => {
    const t = setTimeout(() => void useAddPerson.getState().check(typed), CHECK_AFTER_MS)
    return () => clearTimeout(t)
  }, [typed])
  const shown = s.checked === typed && typed !== "" ? s.similar : []
  const { reveal } = usePeople.getState()

  const submit = async () => {
    if (!typed) return need.fail((l) => addPersonMessages[l].addNameNeeded)
    // A press before the check answered still checks: a duplicate is never added unseen.
    const similar = s.checked === typed ? s.similar : await s.check(typed)
    if (!anyway && similar.some((p) => p.sameName)) {
      setAnyway(true)
      return need.fail((l) => addPersonMessages[l].addSame(typed))
    }
    if (await s.add(typed)) {
      setDraft("")
      setAnyway(false)
      need.clear()
    }
  }

  return (
    <section aria-label={m.addTitle} className="flex flex-col gap-[0.45rem]">
      <form
        noValidate
        className="flex flex-col gap-[0.35rem]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor={field} className="text-[0.95rem] font-medium">
          {m.addTitle}
        </label>
        <span className="flex flex-wrap items-center gap-2">
          <input
            id={field}
            maxLength={200}
            autoComplete="off"
            value={draft}
            placeholder={m.addHint}
            {...need.field}
            onChange={(e) => {
              need.clear()
              setAnyway(false)
              setDraft(e.target.value)
            }}
            className={cx(fieldClass, "selectable flex-1 basis-[16rem]", invalidBorder)}
          />
          <Button type="submit" size="sm" disabled={s.adding} busy={s.adding}>
            {anyway ? m.addAnyway : m.add}
          </Button>
        </span>
        {need.hint}
        <p className="text-[0.85rem] text-ink-dim">{m.addHelp}</p>
      </form>

      <Collapse open={shown.length > 0}>
        <div className="flex flex-col gap-[0.35rem] pt-1">
          <p className="text-[0.9rem] text-ink-soft">{m.addSimilar}</p>
          <ul className="flex flex-col rounded-inset border border-line">
            {shown.map((x) => {
              const who = name(x.ref, x.displayName ?? x.name)
              const contact = x.phone ?? x.email ?? (x.username ? `@${x.username}` : null)
              return (
                <li
                  key={x.ref}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-line px-[0.9rem] py-[0.45rem] not-first:border-t"
                >
                  <span className="font-medium">{who}</span>
                  {x.sameName && <Pill>{m.addSameMark}</Pill>}
                  {contact && contact !== who && (
                    <span className="selectable font-mono text-[0.85rem] text-ink-dim">{contact}</span>
                  )}
                  <Button size="sm" className="ml-auto" onClick={() => reveal(x.ref)}>
                    {p.openPerson(who)}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      </Collapse>

      {s.checkError && typed && (
        <ErrorNotice inline tone="warn" raw={s.checkError}>
          {m.addCheckFailed}
        </ErrorNotice>
      )}
      {s.addError && (
        <ErrorNotice raw={s.addError} action={<ReportThis what="Adding a person" error={s.addError} />}>
          {m.addFailed}
        </ErrorNotice>
      )}
      {s.added && (
        <p role="status" className="reveal flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]">
          {m.added(s.added.name)}
          <Button size="sm" onClick={() => s.added && reveal(s.added.ref)}>
            {p.openPerson(s.added.name)}
          </Button>
        </p>
      )}
    </section>
  )
}
