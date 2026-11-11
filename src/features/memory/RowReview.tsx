import { Check, LoaderCircle, TriangleAlert } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { can, causeOf, type ReviewChoice, reviewChoices } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry, SourceReview } from "@/platform/memory-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { savedAt } from "./labels"
import { reviewMessages } from "./messages-review"
import { canRevoke, useMemory } from "./store"

/** The "source changed" badge on a record's line: memo opened a review, and nothing changes until the owner decides. */
export function ReviewMarker({ cause }: { cause: string }) {
  const m = useMessages(reviewMessages)
  return (
    <Pill tone="warn">
      <TriangleAlert className="mr-[0.3rem] size-[0.85rem]" aria-hidden />
      {m.marker[causeOf(cause)]}
    </Pill>
  )
}

/** What the owner answered, said where the review was; it stays until the page is read again. */
export function ReviewAnswered({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(reviewMessages)
  const answer = useMemory((s) => s.reviewed[entry.ref])
  if (!answer || entry.sourceReview) return null
  return (
    <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
      <Check className="size-4 shrink-0 text-ok" aria-hidden />
      {m.done[answer]}
    </p>
  )
}

/** A record's open source review: each source then and now, what an agent said, and the owner's four answers. */
export function ReviewPanel({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(reviewMessages)
  const review = useMemory((s) => s.reviews[entry.ref])
  const marker = entry.sourceReview
  if (!marker) return null
  const cause = causeOf(review?.state === "ready" ? review.review.cause : marker.cause)
  return (
    <section
      aria-labelledby={`${entry.ref}-review`}
      className="flex min-w-0 flex-col gap-[0.9rem] rounded-[0.45rem] border border-warn/40 bg-app px-[1rem] py-[0.9rem]"
    >
      <div>
        <h3 id={`${entry.ref}-review`} className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="size-4 text-warn" aria-hidden />
          {m.heading[cause]}
        </h3>
        <p className="mt-1 text-[0.95rem] text-ink-soft">{m.intro}</p>
      </div>
      <AutoHeight swap={review?.state ?? "loading"}>
        {!review || review.state === "loading" ? (
          <Skeleton className="h-[5rem] w-full rounded-[0.35rem]" label={m.reading} />
        ) : review.state === "failed" ? (
          <ErrorNotice raw={review.error} inline>
            {m.readFailed}
          </ErrorNotice>
        ) : (
          <ReviewBody entry={entry} review={review.review} />
        )}
      </AutoHeight>
      <Answers entry={entry} />
    </section>
  )
}

function ReviewBody({ entry, review }: { entry: MemoryEntry; review: SourceReview }) {
  const m = useMessages(reviewMessages)
  const lang = useLang()
  const revoke = useMemory(canRevoke)
  const correctable = can(entry, revoke).correct
  const { startCorrect } = useMemory.getState()
  const by = (who: string | null) => (!who || who === "owner" ? m.you : who)
  return (
    <div className="flex flex-col gap-[0.9rem]">
      <ul className="flex flex-col gap-[0.8rem]">
        {review.sources.map((s, i) => (
          <li key={s.ref ?? `gone-${i}`} className="flex flex-col gap-[0.45rem]">
            <p className="text-[0.9rem] font-medium">
              {s.ref ? <span className="selectable font-mono">{s.ref}</span> : m.erased}
              {s.replacement && <span className="font-normal text-ink-soft"> · {m.replacedBy(s.replacement)}</span>}
            </p>
            {s.quote && (
              <p className="text-[0.9rem] text-ink-soft">
                {m.restsOn} <span className="selectable text-ink">“{s.quote}”</span>
              </p>
            )}
            <div className="grid gap-[0.6rem] md:grid-cols-2">
              <Version label={m.cited} text={s.cited} empty={m.unknownThen} />
              <Version label={m.now} text={s.now} empty={m.goneNow} />
            </div>
          </li>
        ))}
      </ul>
      {review.challenges.map((c) => (
        <div key={`${c.at}-${c.reason}`} className="text-[0.95rem]">
          <p className="text-ink-soft">
            {m.challenged(by(c.by))}
            {c.at && <span className="ml-2 font-mono text-[0.85rem] text-ink-dim">{savedAt(c.at, lang)}</span>}
          </p>
          <p className="selectable mt-[0.2rem]">{c.reason}</p>
          {c.evidence.length > 0 && (
            <p className="mt-[0.2rem] text-[0.9rem] text-ink-dim">
              {m.cites} <span className="selectable font-mono">{c.evidence.join(", ")}</span>
            </p>
          )}
        </div>
      ))}
      {review.suggestions.map((s) => (
        <div key={`${s.at}-${s.body}`} className="text-[0.95rem]">
          <p className="text-ink-soft">{m.suggests(by(s.author))}</p>
          <p className="selectable mt-[0.2rem]">{s.body}</p>
          {correctable && (
            <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => startCorrect(entry.ref, s.body)}>
              {m.useWording}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

function Version({ label, text, empty }: { label: string; text: string | null; empty: string }) {
  return (
    <div className="min-w-0 rounded-[0.35rem] border border-line bg-app-2/70 px-[0.8rem] py-[0.6rem]">
      <p className="text-[0.85rem] font-medium text-ink-dim">{label}</p>
      {text ? (
        <p className="selectable mt-[0.2rem] max-h-[12rem] overflow-y-auto whitespace-pre-line text-[0.95rem]">
          {text}
        </p>
      ) : (
        <p className="mt-[0.2rem] text-[0.95rem] text-ink-dim">{empty}</p>
      )}
    </div>
  )
}

/** Still true, Dismiss (with the owner's reason), Edit and No longer true; Edit opens the record's own correction. */
function Answers({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(reviewMessages)
  const revoke = useMemory(canRevoke)
  const busy = useMemory((s) => s.busy[entry.ref])
  const { answerReview, startCorrect } = useMemory.getState()
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState("")
  const field = useId()
  const hint = useId()
  const empty = useFieldError(field)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking])
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />
  const choices = reviewChoices(entry, revoke)
  const act = (choice: ReviewChoice) => {
    if (choice === "correct") startCorrect(entry.ref)
    else if (choice === "dismiss") setAsking(true)
    else answerReview(entry.ref, choice)
  }

  return (
    <AutoHeight swap={String(asking)}>
      {asking ? (
        <form
          className="flex flex-col gap-[0.45rem]"
          onSubmit={(e) => {
            e.preventDefault()
            if (!why.trim()) return empty.fail(m.whyEmpty)
            answerReview(entry.ref, "dismiss", why.trim())
          }}
        >
          <label htmlFor={field} className="text-[0.95rem] font-medium">
            {m.why}
          </label>
          <input
            ref={input}
            id={field}
            maxLength={2000}
            value={why}
            {...empty.field}
            aria-describedby={empty.error ? `${field}-error ${hint}` : hint}
            onChange={(e) => {
              setWhy(e.target.value)
              empty.clear()
            }}
            onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
            className={cx(
              "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 text-[1rem]",
              invalidBorder,
            )}
          />
          <p id={hint} className="text-[0.9rem] text-ink-soft">
            {m.whyHint}
          </p>
          {empty.hint}
          <span className="flex gap-2">
            <Button type="submit" size="sm" disabled={!!busy} icon={busy === "dismiss" ? spin : undefined}>
              {m.dismissNow}
            </Button>
            <Button size="sm" onClick={() => setAsking(false)}>
              {m.cancel}
            </Button>
          </span>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => (
            <Button
              key={choice}
              size="sm"
              variant={choice === "stillTrue" ? "secondary" : "ghost"}
              disabled={!!busy}
              title={m.answersHint[choice]}
              icon={busy === choice ? spin : undefined}
              onClick={() => act(choice)}
            >
              {m.answers[choice]}
            </Button>
          ))}
        </div>
      )}
    </AutoHeight>
  )
}
