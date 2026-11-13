import { useQuery } from "@tanstack/react-query"
import { ChevronRight, FileText } from "lucide-react"
import { useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { contextLines } from "@/domain/search-context"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { ClientCall } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { errorText } from "./errors"
import { callMessages } from "./messages-calls"
import { profilesQuery } from "./query"

const minutes = (ms: number | null) => {
  if (ms === null) return null
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * A client's calls and recorded meetings, as cli-core lists them, newest first. The title is the source's own line:
 * a phone line writes the direction, the manager and the client's number there. A row folds open in place and reads
 * the call in the tool that recorded it, as the profile the owner picks.
 */
export function ClientCalls({ calls, help }: { calls: readonly ClientCall[]; help: string }) {
  const m = useMessages(callMessages)
  if (calls.length === 0) return null
  return (
    <section className="flex min-w-0 flex-col gap-[0.5rem]" aria-label={m.title}>
      <div>
        <h3 className="font-medium">{m.title}</h3>
        <p className="text-[0.9rem] text-ink-soft">{help}</p>
      </div>
      <ul className="flex flex-col rounded-inset border border-line">
        {calls.map((c) => (
          <CallRow key={c.ref} call={c} />
        ))}
      </ul>
    </section>
  )
}

function CallRow({ call }: { call: ClientCall }) {
  const m = useMessages(callMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const id = useId()
  const when = call.startedAt
    ? formatDate(call.startedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, lang)
    : null
  return (
    <li className="border-line not-first:border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-start gap-[0.6rem] px-[0.8rem] py-[0.55rem] text-left hover:bg-app-3 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ChevronRight
          className={cx(
            "mt-[0.2rem] size-4 shrink-0 text-ink-dim transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="flex min-w-0 flex-1 flex-col gap-[0.15rem]">
          <span className="selectable line-clamp-2 break-words">{call.title ?? m.untitled}</span>
          <span className="flex flex-wrap items-center gap-x-[0.6rem] gap-y-[0.2rem] text-[0.85rem] text-ink-soft">
            <span className="font-mono tabular-nums">
              {[when, minutes(call.durationMs)].filter(Boolean).join(" · ")}
            </span>
            {call.hasTranscript && (
              <Pill size="sm" tone="brand">
                <FileText className="mr-1 inline size-3" aria-hidden />
                {m.transcript}
              </Pill>
            )}
          </span>
        </span>
      </button>
      <Collapse open={open} id={id}>
        <div className="px-[0.8rem] pb-[0.8rem] pl-[2.2rem]">
          <CallDetail call={call} />
        </div>
      </Collapse>
    </li>
  )
}

/** Never a profile picked for the owner: each of the tool's profiles is a button, and the chosen one reads the call. */
function CallDetail({ call }: { call: ClientCall }) {
  const m = useMessages(callMessages)
  const tool = call.tool ? findTool(call.tool) : undefined
  const profiles = useQuery({ ...profilesQuery(call.tool ?? ""), enabled: tool !== undefined })
  const [profile, setProfile] = useState<string | null>(null)
  if (!tool) return <p className="text-[0.9rem] text-ink-soft">{m.noTool(call.provider)}</p>
  if (profiles.isPending) return <Skeleton className="h-[2rem] w-full rounded-control" label={m.reading} />
  if (profiles.isError)
    return (
      <ErrorNotice inline raw={errorText(profiles.error)}>
        {m.noProfiles(tool.name)}
      </ErrorNotice>
    )
  const names = (profiles.data ?? []).map((p) => p.name)
  if (names.length === 0) return <p className="text-[0.9rem] text-ink-soft">{m.noProfiles(tool.name)}</p>
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <div className="flex flex-wrap items-center gap-[0.5rem]">
        <span className="text-[0.9rem] text-ink-soft">{m.openIn(tool.name)}</span>
        {names.map((p) => (
          <Button key={p} size="sm" variant={p === profile ? "primary" : "secondary"} onClick={() => setProfile(p)}>
            {p}
          </Button>
        ))}
      </div>
      {profile && <Opened call={call} tool={tool.id} profile={profile} />}
    </div>
  )
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)

function Opened({ call, tool, profile }: { call: ClientCall; tool: string; profile: string }) {
  const m = useMessages(callMessages)
  const read = useQuery({
    queryKey: ["call", tool, profile, call.meetingId],
    queryFn: () => platform.callOpen(tool, profile, call.meetingId, call.hasTranscript),
  })
  if (read.isPending) return <Skeleton className="h-[4rem] w-full rounded-control" label={m.reading} />
  if (read.isError)
    return (
      <ErrorNotice inline raw={errorText(read.error)}>
        {m.failed}
      </ErrorNotice>
    )
  const item = (read.data.show as { item?: { participants?: unknown[] } } | null)?.item
  const people = (item?.participants ?? []).map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>
    const person = (p.person ?? null) as Record<string, unknown> | null
    return { key: `${i}`, name: text(person?.name) ?? text(p.name), role: text(p.role) }
  })
  const lines = read.data.transcript ? contextLines("meetings", read.data.transcript, {}) : []
  return (
    <div className="reveal flex flex-col gap-[0.6rem] text-[0.92rem]">
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-x-[1rem] gap-y-[0.2rem]">
          {people.map((p) => (
            <li key={p.key} className="selectable">
              {p.name ?? m.unnamed}
              {p.role && <span className="text-ink-dim"> · {m.roles[p.role] ?? p.role}</span>}
            </li>
          ))}
        </ul>
      )}
      {call.hasTranscript &&
        (lines.length === 0 ? (
          <p className="text-ink-soft">{m.emptyTranscript}</p>
        ) : (
          <ol className="flex max-h-[18rem] flex-col gap-[0.35rem] overflow-y-auto rounded-control bg-app-2 p-[0.6rem]">
            {lines.map((l) => (
              <li key={l.key} className="selectable grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-[0.6rem]">
                <span className="font-mono text-[0.82rem] tabular-nums text-ink-dim">{minutes(l.at)}</span>
                <span>
                  {l.who && <span className="font-medium">{l.who}: </span>}
                  {l.text}
                </span>
              </li>
            ))}
          </ol>
        ))}
    </div>
  )
}
