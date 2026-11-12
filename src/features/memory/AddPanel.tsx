import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import { useMessages } from "@/i18n"
import { useReaders } from "@/shared/readers-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { SectionTitle } from "@/ui/SectionTitle"
import { DoneStep } from "./AddDoneStep"
import { FactsStep } from "./AddFactsStep"
import { SavedStep } from "./AddSavedStep"
import { SourceStep } from "./AddSourceStep"
import { STEPS, useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

export const PANEL_TITLE = "add-to-memory-title"

/**
 * Add to Memory: one surface above the Memory page's list, four steps sliding in place (rule 9). It closes only when
 * the owner says so; a failed step keeps what an earlier step saved.
 */
export function AddPanel() {
  const m = useMessages(addMessages)
  const open = useAddSource((s) => s.open)
  const step = useAddSource((s) => s.step)
  const failed = useAddSource((s) => s.error !== null)
  const readers = useReaders((s) => s.readers)
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (open && readers === null) void useReaders.getState().load()
  }, [open, readers])

  const n = STEPS.indexOf(step) + 1
  return (
    <Collapse open={open}>
      <section
        aria-labelledby={PANEL_TITLE}
        className="rounded-rack border border-line-strong bg-app px-[1.3rem] pt-[1.1rem] pb-[1.3rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionTitle id={PANEL_TITLE} ref={title} tabIndex={-1} className="outline-none">
              {m.title}
            </SectionTitle>
            {step === "source" && <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">{m.intro}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-[0.35rem]">
              <span aria-hidden className="flex gap-[0.3rem]">
                {STEPS.map((s, i) => (
                  <span
                    key={s}
                    className={cx(
                      "h-[0.25rem] w-[1.6rem] rounded-full transition-colors duration-(--motion-fast)",
                      i < n - 1 ? "bg-brand" : i === n - 1 ? (failed ? "bg-bad" : "bg-brand") : "bg-line-strong",
                    )}
                  />
                ))}
              </span>
              <span aria-live="polite" className="text-[0.85rem] text-ink-dim">
                {m.stepOf(m.steps[step], n, STEPS.length)}
              </span>
            </div>
            <button
              type="button"
              aria-label={m.close}
              title={m.close}
              onClick={() => useAddSource.getState().close()}
              className="grid size-8 cursor-pointer place-items-center rounded-control text-ink-dim transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <AutoHeight swap={step} className="mt-[1.1rem]">
          <div key={step} className="step-in">
            {step === "source" ? (
              <SourceStep />
            ) : step === "saved" ? (
              <SavedStep />
            ) : step === "facts" ? (
              <FactsStep />
            ) : (
              <DoneStep />
            )}
          </div>
        </AutoHeight>
      </section>
    </Collapse>
  )
}
