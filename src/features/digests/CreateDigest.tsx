import { CalendarDays, Plus, Sun } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useMessages } from "@/i18n"
import type { DigestItem, DigestSpec } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { type BookText, bookMessages } from "./messages-book"
import { type Can, DigestFields, NoHarness, problemOf } from "./ScheduleCard"
import { DEFAULT_CAPS, MORNING, useDigestBook } from "./schedule-store"

export type Template = "daily" | "weekly" | "own"

/** A name memo keys files by, from the template; `-2`, `-3` when it is taken. */
export function freeName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`
}

export function draftOf(template: Template, taken: readonly string[], m: BookText): DigestSpec {
  const base = { sources: [], routes: [], brief: null, scheduled: true, ...DEFAULT_CAPS }
  switch (template) {
    case "daily":
      // The first daily digest is the morning digest, so its brief, templates and past days carry on.
      return {
        ...base,
        name: freeName(taken.includes(MORNING) ? "daily-digest" : MORNING, taken),
        title: m.starter.daily,
        times: ["08:30"],
        weekdays: [],
      }
    case "weekly":
      return {
        ...base,
        name: freeName("weekly-digest", taken),
        title: m.starter.weekly,
        times: ["09:00"],
        weekdays: ["mon"],
        maxCostUsd: 1,
        maxCostPerDayUsd: 2,
      }
    case "own":
      return { ...base, name: freeName("digest", taken), title: "", times: ["08:30"], weekdays: [] }
  }
}

/** The three ways to start when there is no digest yet: two ready templates and an own one. */
export function Starter({ can, onPick }: { can: Can; onPick: (t: Template) => void }) {
  const m = useMessages(bookMessages).starter
  const update = <span className="text-[0.85rem] text-ink-dim">{m.needsUpdate}</span>
  return (
    <section aria-labelledby="digest-starter" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="border-line border-b px-[1.3rem] py-[1.1rem]">
        <h2 id="digest-starter" className="text-[1.05rem] font-semibold text-ink">
          {m.title}
        </h2>
        <p className="mt-1 text-ink-soft">{m.body}</p>
      </div>
      <ul className="grid divide-line md:grid-cols-3 md:divide-x max-md:divide-y">
        <Choice icon={<Sun className="size-5" aria-hidden />} title={m.daily} body={m.dailyBody}>
          <Button variant="secondary" size="sm" onClick={() => onPick("daily")}>
            {m.setUp}
          </Button>
        </Choice>
        <Choice icon={<CalendarDays className="size-5" aria-hidden />} title={m.weekly} body={m.weeklyBody}>
          <Button variant="secondary" size="sm" disabled={!can.named} onClick={() => onPick("weekly")}>
            {m.setUp}
          </Button>
          {!can.named && update}
        </Choice>
        <Choice icon={<Plus className="size-5" aria-hidden />} title={m.own} body={m.ownBody}>
          <Button variant="secondary" size="sm" disabled={!can.named} onClick={() => onPick("own")}>
            {m.setUp}
          </Button>
          {!can.named && update}
        </Choice>
      </ul>
    </section>
  )
}

function Choice(props: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-[1.3rem] py-[1.2rem]">
      <span className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-brand">{props.icon}</span>
        {props.title}
      </span>
      <p className="flex-1 text-[0.92rem] text-ink-soft">{props.body}</p>
      <div className="flex flex-wrap items-center gap-2">{props.children}</div>
    </li>
  )
}

/** The create form in a dialog, prefilled from a template; saved with `digest add`. */
export function CreateDialog({
  start,
  can,
  harness,
  onClose,
}: {
  start: DigestSpec | null
  can: Can
  harness: boolean
  onClose: () => void
}) {
  const m = useMessages(bookMessages).form
  const { busy, failed, save, openDigest } = useDigestBook()
  const [draft, setDraft] = useState(start)
  const [onDays, setOnDays] = useState((start?.weekdays.length ?? 0) > 0)
  const [shownFor, setShownFor] = useState(start)
  if (start !== shownFor) {
    setShownFor(start)
    setDraft(start)
    setOnDays((start?.weekdays.length ?? 0) > 0)
  }
  const working = draft !== null && busy[draft.name] === "save"
  const problem = draft && problemOf(draft, onDays)

  return (
    <Dialog
      open={start !== null}
      title={m.createTitle}
      onClose={onClose}
      wide
      scroll
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={!draft || working || problem !== null || !harness}
            onClick={async () => {
              if (!draft) return
              if (await save({ ...draft, title: draft.title.trim() }, true)) {
                onClose()
                openDigest(draft.name)
              }
            }}
          >
            {working ? m.creating : m.create}
          </Button>
        </>
      }
    >
      {draft && (
        <div className="flex flex-col gap-4">
          {!harness && <NoHarness />}
          <DigestFields
            spec={draft}
            onChange={setDraft}
            onDays={onDays}
            setOnDays={setOnDays}
            can={{ named: can.named }}
            brief={can.named}
          />
          {failed?.name === draft.name && failed.what === "create" && (
            <ErrorNotice inline>{m.failedCreate(failed.message)}</ErrorNotice>
          )}
        </div>
      )}
    </Dialog>
  )
}

export const takenNames = (digests: readonly DigestItem[]) => digests.map((d) => d.name)
