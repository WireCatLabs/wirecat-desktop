import { useEffect, useState } from "react"
import { byOwner, dayKey, subjectOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { AgentCall, MemoryEntry } from "@/platform/memory-schemas"
import { Collapse } from "@/ui/Collapse"
import { Lamp } from "@/ui/Lamp"
import { authorOf, dayLabel, kindOf, timeOf } from "../labels"
import { memoryMessages } from "../messages"
import { v3Messages } from "./messages"
import { type Event, eventsOf } from "./model"

const live = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("live") === "1"
const LIVE_MS = 6000

export function Timeline({ entries, calls }: { entries: MemoryEntry[]; calls: AgentCall[] }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const [arrived, setArrived] = useState<Event | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!live) return
    const timer = setTimeout(() => {
      const at = new Date().toISOString()
      setArrived({
        kind: "call",
        key: "live",
        at,
        call: {
          id: "live",
          agent: "codex-nbb-evaluation",
          tool: "projects_evidence",
          tier: "read",
          status: "ok",
          error: null,
          at,
        },
      })
      requestAnimationFrame(() => setShown(true))
    }, LIVE_MS)
    return () => clearTimeout(timer)
  }, [])

  const events = eventsOf(entries, calls)
  const days: { day: string; events: Event[] }[] = []
  for (const e of events) {
    const day = dayKey(e.at)
    const last = days.at(-1)
    if (last?.day === day) last.events.push(e)
    else days.push({ day, events: [e] })
  }

  return (
    <div className="flex flex-col gap-[0.8rem]">
      <p className="flex items-center gap-[0.5rem] text-[0.9rem] text-ink-soft">
        <Lamp tone={live ? "busy" : "idle"} size="sm" />
        {live ? t.live : t.liveOff}
      </p>
      {events.length === 0 && !arrived ? (
        <p className={`${rack} px-[1.3rem] py-[0.9rem] text-[0.95rem] text-ink-soft`}>{t.timelineEmpty}</p>
      ) : (
        <div className={rack}>
          {arrived && (
            <Collapse open={shown}>
              <ul>
                <Line event={arrived} live />
              </ul>
            </Collapse>
          )}
          {days.map(({ day, events: list }) => (
            <section
              key={day}
              aria-label={dayLabel(list[0]?.at ?? day, m, lang)}
              className="border-line [&+&]:border-t"
            >
              <h3 className="px-[1.3rem] pt-[0.8rem] pb-[0.2rem] text-[0.9rem] font-medium text-ink-dim">
                {dayLabel(list[0]?.at ?? day, m, lang)}
              </h3>
              <ul>
                {list.map((e) => (
                  <Line key={e.key} event={e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

const rack = "rounded-[0.2rem] border border-line-strong bg-app"

function Line({ event, live: fresh = false }: { event: Event; live?: boolean }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const tone = event.kind === "call" ? (event.call.status === "ok" ? "ok" : "bad") : toneOfVerb(event.verb)

  return (
    <li className="grid grid-cols-[0.85rem_minmax(0,1fr)_auto] items-baseline gap-[0.9rem] px-[1.3rem] py-[0.5rem] text-[0.95rem]">
      <span className="self-center">
        <Lamp tone={fresh ? "busy" : tone} size="sm" />
      </span>
      <span className="min-w-0">{event.kind === "call" ? <Call call={event.call} /> : <Record event={event} />}</span>
      <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{timeOf(event.at, lang)}</span>
      {event.kind === "call" && event.call.status !== "ok" && (
        <span className="col-start-2 text-[0.9rem] text-bad">
          {t.failed}: {event.call.error ?? m.callFailed}
        </span>
      )}
    </li>
  )
}

const toneOfVerb = (verb: "proposed" | "confirmed" | "discarded") =>
  verb === "proposed" ? "warn" : verb === "confirmed" ? "ok" : "idle"

function Call({ call }: { call: AgentCall }) {
  const m = useMessages(memoryMessages)
  return (
    <span className="text-ink-soft">
      <span className="font-mono text-[0.85rem] text-ink">{call.agent ?? m.anAgent}</span>{" "}
      {m.calls[call.tool]?.toLocaleLowerCase() ?? (
        <>
          {m.called.toLocaleLowerCase()} <span className="font-mono text-[0.85rem]">{call.tool}</span>
        </>
      )}
    </span>
  )
}

function Record({ event }: { event: Extract<Event, { kind: "record" }> }) {
  const t = useMessages(v3Messages)
  const m = useMessages(memoryMessages)
  const e = event.entry
  const subject = subjectOf(e)
  const about = subject?.kind === "you" ? t.you : (subject?.name ?? null)
  const who = byOwner(e) || event.verb !== "proposed" ? t.you : authorOf(e, m)
  const what = e.findings ? t.what([["finding", e.findings.length]]) : kindOf(e.kind, m).toLocaleLowerCase()
  return (
    <span className="text-ink-soft">
      <span className={who === t.you ? "text-ink" : "font-mono text-[0.85rem] text-ink"}>{who}</span>{" "}
      {event.verb === "proposed" ? t.run(what) : t.decided[event.verb](what)}
      {about && (
        <>
          {" "}
          {t.forSubject} <span className="font-medium text-ink">{about}</span>
        </>
      )}
      {e.text && <span className="selectable mt-[0.1rem] block truncate text-[0.9rem] text-ink-dim">{e.text}</span>}
    </span>
  )
}
