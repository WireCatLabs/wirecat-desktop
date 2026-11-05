import { ChevronRight } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { Collapse } from "./Collapse"
import { cx } from "./cx"
import { Skeleton } from "./Skeleton"

/** A quiet "more" link that folds its content open in place; a button, because `<details>` cannot animate in WebKit. */
export function Disclosure({
  summary,
  children,
  openWhen = false,
}: {
  summary: ReactNode
  children: ReactNode
  /** Opens it once this turns true, as when it holds the only way left; the owner can still fold it again. */
  openWhen?: boolean
}) {
  const [open, setOpen] = useState(openWhen)
  const id = useId()
  useEffect(() => {
    if (openWhen) setOpen(true)
  }, [openWhen])
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded text-left text-[0.875rem] font-medium text-brand hover:text-brand-hover"
      >
        <ChevronRight
          className={cx("size-4 shrink-0 transition-transform duration-(--motion-fast)", open && "rotate-90")}
          aria-hidden
        />
        {summary}
      </button>
      <Collapse open={open} id={id} className="pt-2">
        {children}
      </Collapse>
    </div>
  )
}

/** The closed summary line of a Disclosure whose text is still loading, at the same height. */
export function DisclosureSkeleton({ chars }: { chars: number }) {
  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[0.875rem]">
        <span className="size-4" />
        <Skeleton chars={chars} />
      </span>
    </div>
  )
}
