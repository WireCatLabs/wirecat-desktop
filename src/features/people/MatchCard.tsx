import { Check, LoaderCircle } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import type { Match } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { usePeople } from "./store"

/**
 * Two people WireCat thinks may be one. Same person joins them; Not the same asks the owner's reason. Decided, the
 * card stays where it is and says what happened (rule 9).
 */
export function MatchCard({ match, from }: { match: Match; from: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const decided = usePeople((s) => s.decided[match.id])
  const busy = usePeople((s) => s.busy[match.id])
  const failed = usePeople((s) => s.failed[match.id])
  const { decide } = usePeople.getState()
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState("")
  const field = useId()
  const hint = useId()
  const head = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking])
  const [a = "", b = ""] = match.persons
  const moving = match.joins === "identity" && match.identity
  const by = match.proposer
  const proposed = !by ? null : by.kind === "rule" ? m.foundBy : by.name ? m.suggestedBy(by.name) : m.suggestedByPerson
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />

  return (
    <article
      aria-labelledby={head}
      className="flex min-w-0 flex-col gap-[0.6rem] rounded-[0.45rem] border border-line bg-app px-[1rem] py-[0.85rem]"
    >
      <div>
        <h3 id={head} className="font-medium">
          {moving ? m.moveHeading(match.identity ?? "", name(b)) : m.joinHeading(name(a), name(b))}
        </h3>
        <p className="font-mono text-[0.85rem] text-ink-dim">
          {match.identity && match.with ? `${match.identity} · ${match.with}` : `${a} · ${b}`}
        </p>
      </div>
      {moving && <p className="text-[0.9rem] text-ink-soft">{m.moveHelp}</p>}
      {match.signal && m.signals[match.signal] && <p className="text-[0.95rem]">{m.signals[match.signal]}</p>}
      {match.candidates.length > 2 && (
        <p className="text-[0.9rem] text-ink-soft">{m.candidates(match.candidates.length)}</p>
      )}
      {match.reason && <p className="selectable text-[0.95rem]">{match.reason}</p>}
      {match.evidence.length > 0 && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.evidence} <span className="selectable font-mono">{match.evidence.join(", ")}</span>
        </p>
      )}
      {proposed && <p className="text-[0.85rem] text-ink-dim">{proposed}</p>}
      <AutoHeight swap={decided ? "done" : String(asking)}>
        {decided ? (
          <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
            <Check className="size-4 shrink-0 text-ok" aria-hidden />
            {m.decided[decided]}
          </p>
        ) : asking ? (
          <form
            className="flex flex-col gap-[0.45rem]"
            onSubmit={(e) => {
              e.preventDefault()
              if (why.trim()) void decide(from, match.id, "reject", why.trim())
            }}
          >
            <label htmlFor={field} className="text-[0.95rem] font-medium">
              {m.rejectWhy}
            </label>
            <input
              ref={input}
              id={field}
              maxLength={500}
              value={why}
              aria-describedby={hint}
              onChange={(e) => setWhy(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
              className="selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 text-[1rem]"
            />
            <p id={hint} className="text-[0.9rem] text-ink-soft">
              {m.rejectHint}
            </p>
            <span className="flex gap-2">
              <Button type="submit" size="sm" disabled={!why.trim() || !!busy} icon={busy ? spin : undefined}>
                {m.rejectNow}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
                {m.cancel}
              </Button>
            </span>
          </form>
        ) : (
          <span className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!!busy}
              icon={busy === "confirm" ? spin : undefined}
              onClick={() => void decide(from, match.id, "confirm")}
            >
              {m.confirm}
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setAsking(true)}>
              {m.reject}
            </Button>
          </span>
        )}
      </AutoHeight>
      {failed && <Refusal error={failed} />}
    </article>
  )
}
