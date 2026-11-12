import { chosenReader } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import { useReaders } from "@/shared/readers-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Pill } from "@/ui/Pill"
import { ReaderLine } from "./AddReaderLine"
import { Refusal } from "./AddRefusal"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

/** Step 3: the suggested facts and tasks with ticks; only the ticked ones are kept, and they count at once. */
export function FactsStep() {
  const m = useMessages(addMessages)
  const batch = useAddSource((s) => s.batch)
  const skipped = useAddSource((s) => s.skipped)
  const reused = useAddSource((s) => s.reused)
  const busy = useAddSource((s) => s.busy)
  const { skip, skipAll, keep, suggest } = useAddSource.getState()
  const findings = batch?.findings ?? []
  const ticked = findings.filter((f) => !skipped.includes(f.id)).length
  const facts = findings.filter((f) => f.kind === "fact").length
  const reader = useReaders((s) => chosenReader(s.readers ?? []))
  const decided = batch !== null && batch.status !== "proposed"

  return (
    <div className="flex flex-col gap-[1rem]">
      {decided ? (
        <p className="text-[0.95rem] text-ink-soft">{m.alreadyDecided}</p>
      ) : findings.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.nothingFound}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <p className="font-medium">{m.suggested(facts, findings.length - facts)}</p>
              <p className="text-[0.9rem] text-ink-soft">{m.tickHint}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={ticked === findings.length} onClick={() => skipAll(false)}>
                {m.tickAll}
              </Button>
              <Button size="sm" variant="ghost" disabled={ticked === 0} onClick={() => skipAll(true)}>
                {m.untickAll}
              </Button>
            </div>
          </div>
          <ul className="flex flex-col rounded-inset border border-line">
            {findings.map((f) => (
              <li key={f.id} className="border-line not-first:border-t">
                <label className="flex cursor-pointer items-start gap-[0.8rem] px-[0.9rem] py-[0.7rem]">
                  <Checkbox
                    className="mt-[0.2rem]"
                    checked={!skipped.includes(f.id)}
                    onChange={(on) => skip(f.id, !on)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Pill>{m.findingKinds[f.kind] ?? f.kind}</Pill>
                    </span>
                    <span className="selectable mt-[0.25rem] block text-[1rem] font-medium">{f.text}</span>
                    {f.reason && (
                      <span className="selectable mt-[0.15rem] block text-[0.9rem] text-ink-soft">{f.reason}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {reused && !decided && <p className="text-[0.9rem] text-ink-soft">{m.reused}</p>}
      <ReaderLine />
      <Refusal />
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={!!busy} onClick={() => void keep()} busy={busy === "keep"}>
          {decided ? m.done : findings.length === 0 ? m.keepNone : m.keep(ticked)}
        </Button>
        {reused && reader && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => void suggest(reader.id, true)}
            busy={busy === "suggest"}
          >
            {m.readAgain}
          </Button>
        )}
      </div>
    </div>
  )
}
