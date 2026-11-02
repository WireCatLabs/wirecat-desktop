import { type KeyboardEvent, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Cards } from "./cards"
import type { Section } from "./layout"
import { analyticsMessages } from "./messages"

/** The sections behind tabs: one shows at a time, the arrow keys move between tabs (WAI-ARIA tabs pattern). */
export function Tabs({ sections }: { sections: readonly Section[] }) {
  const m = useMessages(analyticsMessages)
  const [active, setActive] = useState(0)
  const base = useId()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (e: KeyboardEvent) => {
    const to = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: sections.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    const next = (to + sections.length) % sections.length
    setActive(next)
    tabs.current[next]?.focus()
  }
  const section = sections[active]
  return (
    <div className="flex flex-col gap-[1.1rem]">
      <div role="tablist" aria-label={m.tabsLabel} className="flex gap-1 border-line border-b" onKeyDown={move}>
        {sections.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${base}-t${i}`}
            aria-selected={i === active}
            aria-controls={`${base}-p`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cx(
              "-mb-px cursor-pointer border-b-2 px-3 py-2 text-[1rem] transition-colors duration-150",
              i === active ? "border-brand font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {m.tabs[s.id] ?? s.id}
          </button>
        ))}
      </div>
      {section && (
        <div
          id={`${base}-p`}
          role="tabpanel"
          aria-labelledby={`${base}-t${active}`}
          key={section.id}
          className="step-in grid grid-cols-1 gap-[1.5rem] lg:grid-cols-2"
        >
          <Cards ids={section.cards} />
        </div>
      )}
    </div>
  )
}
