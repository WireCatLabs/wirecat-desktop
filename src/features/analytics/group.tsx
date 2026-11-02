import { type ReactNode, useId, useState } from "react"
import { Collapse } from "@/ui/Collapse"
import { ExpandChevron } from "@/ui/ExpandChevron"

const KEY = "wirecat.analytics.closed"

function readClosed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

function writeClosed(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // No storage: the section still folds for this session.
  }
}

/**
 * A section of the page that folds under its heading, remembered between visits. Folded, its panels unmount, so the
 * tools are not asked for what nobody looks at.
 */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => !readClosed().includes(id))
  const body = useId()
  const toggle = () => {
    const next = !open
    setOpen(next)
    const closed = readClosed().filter((x) => x !== id)
    writeClosed(next ? closed : [...closed, id])
  }
  return (
    <section aria-labelledby={`${body}-h`} className="flex flex-col">
      <h2 id={`${body}-h`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={body}
          onClick={toggle}
          className="group flex w-full cursor-pointer items-center justify-between gap-3 border-line border-b py-2 text-left text-[1.2rem] font-semibold text-ink hover:text-brand"
        >
          {title}
          <ExpandChevron open={open} className="group-hover:text-brand" />
        </button>
      </h2>
      <Collapse open={open} id={body}>
        <div className="grid grid-cols-1 gap-[1.5rem] pt-[1.1rem] lg:grid-cols-2">{children}</div>
      </Collapse>
    </section>
  )
}
