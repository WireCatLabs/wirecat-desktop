import { Bug } from "lucide-react"
import { type Failure, failureReport } from "@/domain/report"
import { useMessages } from "@/i18n"
import { recentErrors } from "@/shared/errors"
import { sharedMessages } from "@/shared/messages"
import { currentPageName } from "@/shared/nav"
import { useReport } from "@/shared/report-store"
import { Button } from "@/ui/Button"

type Props = Omit<Failure, "message" | "page"> & {
  error: unknown
  page?: string | null
  log?: readonly string[]
  /** For a place that must step aside first, such as a dialog the report would cover. */
  onOpen?: () => void
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Opens the report form filled in from a failure. Nothing is sent until the owner presses Send there. */
export function reportFailure({ error, log, page, ...failure }: Omit<Props, "onOpen">) {
  const f = failureReport({
    ...failure,
    message: messageOf(error),
    page: page === undefined ? currentPageName() : page,
  })
  useReport.getState().start({
    tool: f.about,
    summary: f.summary,
    steps: f.steps,
    details: f.happened,
    errors: recentErrors(),
    ...(log ? { log } : {}),
  })
}

export function ReportThis({ onOpen, ...props }: Props) {
  const m = useMessages(sharedMessages)
  return (
    <Button
      size="sm"
      variant="ghost"
      title={m.reportThisTitle}
      icon={<Bug className="size-4" aria-hidden />}
      onClick={() => {
        onOpen?.()
        reportFailure(props)
      }}
    >
      {m.reportThis}
    </Button>
  )
}
