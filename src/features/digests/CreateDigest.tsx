import { CalendarDays, Plus, Sun } from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import type { DigestItem, DigestSpec } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Pill } from "@/ui/Pill"
import { titleOf } from "./DigestTable"
import { type BookText, bookMessages } from "./messages-book"
import { type Can, DigestFields, focusProblem, NoHarness, problemOf } from "./ScheduleCard"
import { DEFAULT_CAPS, MORNING, useDigestBook } from "./schedule-store"

export type Template = "daily" | "weekly" | "own"

function freeLabel(base: string, taken: readonly string[], sep: string): string {
  const used = new Set(taken.map((t) => t.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) if (!used.has(`${base}${sep}${n}`.toLowerCase())) return `${base}${sep}${n}`
}

/** A name memo keys files by, from the template; `-2`, `-3` when it is taken. */
export const freeName = (base: string, taken: readonly string[]) => freeLabel(base, taken, "-")

/** A template's title, with " 2", " 3" when a digest already has it, so two rows from one template read apart. */
export const freeTitle = (base: string, taken: readonly string[]) => freeLabel(base, taken, " ")

export function draftOf(template: Template, digests: readonly DigestItem[], m: BookText): DigestSpec {
  const taken = digests.map((d) => d.name)
  const titles = digests.map((d) => titleOf(d, m))
  const base = { sources: [], routes: [], brief: null, scheduled: true, ...DEFAULT_CAPS }
  switch (template) {
    case "daily":
      // The first daily digest is the morning digest, so its brief, templates and past days carry on.
      return {
        ...base,
        name: freeName(taken.includes(MORNING) ? "daily-digest" : MORNING, taken),
        title: freeTitle(m.starter.daily, titles),
        times: ["08:30"],
        weekdays: [],
      }
    case "weekly":
      return {
        ...base,
        name: freeName("weekly-digest", taken),
        title: freeTitle(m.starter.weekly, titles),
        times: ["09:00"],
        weekdays: ["mon"],
        maxCostUsd: 1,
        maxCostPerDayUsd: 2,
      }
    case "own":
      return { ...base, name: freeName("digest", taken), title: "", times: ["08:30"], weekdays: [] }
  }
}

/**
 * The three ways to start a digest: two ready templates and an own one. With no digest yet it is the page; once there
 * are some it stays above the table, smaller, so every way to create one is still a click away.
 */
export function Starter(props: { can: Can; onPick: (t: Template) => void; compact?: boolean; morningRests?: boolean }) {
  const { can, onPick, compact = false, morningRests = false } = props
  const m = useMessages(bookMessages).starter
  const update = <span className="text-[0.85rem] text-ink-dim">{m.needsUpdate}</span>
  return (
    <section aria-labelledby="digest-starter" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className={cx("border-line border-b", compact ? "px-[1.1rem] py-[0.65rem]" : "px-[1.3rem] py-[1.1rem]")}>
        <h2 id="digest-starter" className={cx("font-semibold text-ink", compact ? "text-[0.95rem]" : "text-[1.05rem]")}>
          {compact ? m.more : m.title}
        </h2>
        {!compact && <p className="mt-1 text-ink-soft">{m.body}</p>}
      </div>
      <ul className="grid divide-line md:grid-cols-3 md:divide-x max-md:divide-y">
        <Choice
          compact={compact}
          icon={<Sun className="size-5" aria-hidden />}
          title={m.daily}
          body={m.dailyBody}
          badge={
            morningRests && (
              <InfoTip label={m.morningRests} trigger={<Pill size="sm">{m.restsBadge}</Pill>}>
                {m.morningRests}
              </InfoTip>
            )
          }
        >
          <Button variant="secondary" size="sm" onClick={() => onPick("daily")}>
            {m.setUp}
          </Button>
        </Choice>
        <Choice
          compact={compact}
          icon={<CalendarDays className="size-5" aria-hidden />}
          title={m.weekly}
          body={m.weeklyBody}
        >
          {!can.named && update}
          <Button variant="secondary" size="sm" disabled={!can.named} onClick={() => onPick("weekly")}>
            {m.setUp}
          </Button>
        </Choice>
        <Choice compact={compact} icon={<Plus className="size-5" aria-hidden />} title={m.own} body={m.ownBody}>
          {!can.named && update}
          <Button variant="secondary" size="sm" disabled={!can.named} onClick={() => onPick("own")}>
            {m.setUp}
          </Button>
        </Choice>
      </ul>
    </section>
  )
}

function Choice({
  compact,
  ...props
}: {
  compact: boolean
  icon: ReactNode
  title: string
  body: string
  /** A short state after the description, its explanation in a tooltip. */
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <li className={cx("flex flex-col", compact ? "gap-1.5 px-[1.1rem] py-[0.8rem]" : "gap-2 px-[1.3rem] py-[1.2rem]")}>
      <span className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-brand">{props.icon}</span>
        {props.title}
      </span>
      <p className={cx("flex-1 text-ink-soft", compact ? "text-[0.88rem]" : "text-[0.92rem]")}>
        {props.body}
        {props.badge && <span className="ml-[0.4rem] inline-flex align-middle">{props.badge}</span>}
      </p>
      <div className="mt-1 flex flex-col items-start gap-1.5">{props.children}</div>
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
  const [tried, setTried] = useState(false)
  const form = useRef<HTMLDivElement>(null)
  if (start !== shownFor) {
    setShownFor(start)
    setDraft(start)
    setOnDays((start?.weekdays.length ?? 0) > 0)
    setTried(false)
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
          <Button onClick={onClose}>{m.cancel}</Button>
          <Button
            variant="primary"
            disabled={!draft || working || !harness}
            onClick={async () => {
              if (!draft) return
              if (problem) {
                setTried(true)
                focusProblem(form.current)
                return
              }
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
        <div ref={form} className="flex flex-col gap-4">
          {!harness && <NoHarness />}
          <DigestFields
            spec={draft}
            onChange={setDraft}
            onDays={onDays}
            setOnDays={setOnDays}
            can={{ named: can.named }}
            creating
            shown={tried ? problem : null}
          />
          {failed?.name === draft.name && failed.what === "create" && (
            <ErrorNotice raw={failed.message} inline>
              {m.failedCreate}
            </ErrorNotice>
          )}
        </div>
      )}
    </Dialog>
  )
}
