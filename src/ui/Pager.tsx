import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMessages } from "@/i18n"
import { Button } from "./Button"
import { uiMessages } from "./messages"

/** Previous and Next around the page number; the caller keeps the page, or a cursor per page. */
export function Pager({
  page,
  hasMore,
  busy = false,
  onPage,
}: {
  page: number
  hasMore: boolean
  busy?: boolean
  onPage: (page: number) => void
}) {
  const m = useMessages(uiMessages)
  return (
    <nav aria-label={m.pages} className="flex items-center justify-center gap-3 text-[0.9rem] text-ink-dim">
      <Button
        size="sm"
        disabled={page <= 1 || busy}
        onClick={() => onPage(page - 1)}
        icon={<ChevronLeft className="size-4" aria-hidden />}
      >
        {m.previousPage}
      </Button>
      <span className="min-w-[6rem] text-center tabular-nums">{m.pageN(page)}</span>
      <Button size="sm" disabled={!hasMore || busy} onClick={() => onPage(page + 1)}>
        {m.nextPage}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  )
}
