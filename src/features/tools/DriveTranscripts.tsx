import { FileText } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import type { TranscriptsFound } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { NEEDS_UPDATE } from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { driveMessages } from "./messages-drive"

export const TRANSCRIPT_MODES = ["include", "skip", "exclude"] as const
export type TranscriptMode = (typeof TRANSCRIPT_MODES)[number]

export type TranscriptsFailed = Extract<TranscriptsFound, { result: "failed" }>
type Found = { state: "loading" } | { state: "ready"; found: TranscriptsFound }
type Saved = { state: "idle" } | { state: "saving" } | { state: "saved" } | { state: "failed"; message: string }

const isMode = (value: unknown): value is TranscriptMode =>
  typeof value === "string" && (TRANSCRIPT_MODES as readonly string[]).includes(value)

/**
 * Meet transcripts and Gemini notes for one Drive profile: what drive's `transcripts list` finds (they sit in the
 * organizers' Drives, outside the owner's folders), and the profile's `transcripts` setting as three choices. Nothing
 * is chosen until the owner picks, as drive imports nothing while the setting is unset.
 */
export function DriveTranscripts(props: {
  tool: string
  profile: string
  /** A failed search in the surface's own words, such as a sign-in that expired; a plain notice otherwise. */
  failed?: (found: TranscriptsFailed, retry: () => void) => ReactNode
  /** The next step once the owner chose to add them, such as Sync now. */
  afterInclude?: ReactNode
  onChosen?: (mode: TranscriptMode) => void
  /** Inside a panel with its own heading, such as the account's folders, one level below it. */
  nested?: boolean
}) {
  const { tool, profile, failed, afterInclude, onChosen, nested = false } = props
  const Heading = nested ? "h6" : "h3"
  const m = useMessages(driveMessages).transcripts
  const heading = useId()
  const name = useId()
  const [found, setFound] = useState<Found>({ state: "loading" })
  const [mode, setMode] = useState<TranscriptMode | null>(null)
  // The choices wait for the saved one: a click before it arrives would be overwritten by it.
  const [read, setRead] = useState(false)
  const [saved, setSaved] = useState<Saved>({ state: "idle" })
  const latest = useRef(0)
  // The last choice drive accepted, to go back to when a later one is refused.
  const kept = useRef<TranscriptMode | null>(null)

  const find = useCallback(async () => {
    setFound({ state: "loading" })
    try {
      setFound({ state: "ready", found: await platform.driveTranscriptsFind(tool, profile) })
    } catch (e) {
      setFound({ state: "ready", found: { result: "failed", message: errorText(e), code: null, reason: null } })
    }
  }, [tool, profile])

  useEffect(() => {
    void find()
  }, [find])

  useEffect(() => {
    let live = true
    platform.settingsShow(tool, profile).then(
      ({ rows }) => {
        const row = rows.find((r) => r.key === "transcripts" && r.origin === "profile")
        if (!live) return
        if (isMode(row?.value)) {
          setMode(row.value)
          kept.current = row.value
        }
        setRead(true)
      },
      () => live && setRead(true),
    )
    return () => {
      live = false
    }
  }, [tool, profile])

  const choose = async (next: TranscriptMode) => {
    const call = ++latest.current
    setMode(next)
    setSaved({ state: "saving" })
    try {
      await platform.settingsSet(tool, profile, false, "transcripts", JSON.stringify(next))
      kept.current = next
      if (call !== latest.current) return
      setSaved({ state: "saved" })
      onChosen?.(next)
    } catch (e) {
      if (call !== latest.current) return
      setMode(kept.current)
      setSaved({ state: "failed", message: m.saveFailed(errorText(e)) })
    }
  }

  const tooOld = found.state === "ready" && found.found.result === "failed" && found.found.code === NEEDS_UPDATE

  return (
    <section
      aria-labelledby={heading}
      className={`flex w-full max-w-[34rem] flex-col gap-3 text-left ${nested ? "border-t border-line pt-3" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <Heading id={heading} className={`${nested ? "text-[0.9rem]" : "text-[1.15rem]"} font-semibold text-ink`}>
          {m.title}
        </Heading>
        <p className={`${nested ? "text-[0.85rem]" : "text-body"} leading-snug text-ink-soft`}>{m.lead}</p>
      </div>

      <AutoHeight swap={found.state === "loading" ? "loading" : found.found.result}>
        {found.state === "loading" ? (
          <div className="flex flex-col gap-1.5" role="status" aria-label={m.loading}>
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : found.found.result === "found" ? (
          <FoundList count={found.found.count} titles={found.found.titles} />
        ) : failed && !tooOld ? (
          failed(found.found, find)
        ) : (
          <ErrorNotice
            inline
            raw={tooOld ? null : found.found.message}
            action={
              tooOld ? undefined : (
                <Button size="sm" variant="secondary" onClick={find}>
                  {m.retry}
                </Button>
              )
            }
          >
            {tooOld ? m.needsUpdate : m.findFailed}
          </ErrorNotice>
        )}
      </AutoHeight>

      {!tooOld && !read && <Skeleton className="h-24 w-full" />}
      {!tooOld && read && (
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[0.95rem] font-medium text-ink">{m.choose}</legend>
          <div className="flex flex-col gap-2">
            {TRANSCRIPT_MODES.map((option) => (
              <label key={option} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={name}
                  value={option}
                  checked={mode === option}
                  onChange={() => void choose(option)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col gap-0.5 rounded-control border border-line-strong px-3 py-2.5 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                  <span className="text-[0.95rem] font-medium text-ink">{m.choices[option].name}</span>
                  <span className="text-[0.8rem] leading-snug text-ink-soft">{m.choices[option].detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Collapse open={saved.state !== "idle"}>
        {saved.state === "failed" ? (
          <ErrorNotice inline>{saved.message}</ErrorNotice>
        ) : (
          <p role="status" className="text-[0.9rem] text-ink">
            {saved.state === "saving" ? m.saving : mode ? m.saved[mode] : null}
          </p>
        )}
      </Collapse>
      {saved.state === "saved" && mode === "include" && afterInclude}
    </section>
  )
}

function FoundList({ count, titles }: { count: number; titles: string[] }) {
  const m = useMessages(driveMessages).transcripts
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[0.9rem] font-medium text-ink">{m.found(count)}</p>
      {titles.length > 0 && (
        <ul className="flex flex-col gap-1">
          {titles.map((title, i) => (
            // Docs of a recurring meeting can share a name.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed once shown
            <li key={i} className="flex min-w-0 items-center gap-2 text-[0.9rem] text-ink-soft">
              <FileText className="size-4 shrink-0 text-ink-dim" aria-hidden />
              <span className="truncate">{title}</span>
            </li>
          ))}
          {count > titles.length && (
            <li className="pl-6 text-[0.85rem] text-ink-dim">{m.more(count - titles.length)}</li>
          )}
        </ul>
      )}
    </div>
  )
}
