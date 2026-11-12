import { type ReactNode, useId, useState } from "react"
import { safeStorage } from "@/shared/safe-storage"
import { Collapse } from "@/ui/Collapse"
import { ExpandChevron } from "@/ui/ExpandChevron"

const KEY = "wirecat.analytics.sections"

function readOpen(): Record<string, boolean> {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) ?? "{}")
    return v && typeof v === "object" && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

const writeOpen = (id: string, open: boolean) => safeStorage.setItem(KEY, JSON.stringify({ ...readOpen(), [id]: open }))

/**
 * A section of the page that folds under its heading, remembered between visits. Folded, its panels unmount, so the
 * tools are not asked for what nobody looks at.
 */
export function Group({
  id,
  title,
  closed = false,
  children,
}: {
  id: string
  title: string
  /** Folded until the owner opens it once. */
  closed?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => readOpen()[id] ?? !closed)
  const body = useId()
  const toggle = () => {
    setOpen(!open)
    writeOpen(id, !open)
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
