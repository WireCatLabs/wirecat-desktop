import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { sharedMessages } from "@/shared/messages"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"

type Props = {
  /** What failed, in a plain sentence; the tool's own text goes in `raw`. */
  children: ReactNode
  raw: string
  /** The report's subject, in English: "Reading memory". */
  what: string
  onRetry: () => void
  busy?: boolean
}

/** A page that could not read what it shows: the same shape on every page, with one retry and a report. */
export function PageError({ children, raw, what, onRetry, busy = false }: Props) {
  const m = useMessages(sharedMessages)
  return (
    <ErrorNotice
      raw={raw}
      action={
        <>
          <Button size="sm" busy={busy} onClick={onRetry}>
            {m.tryAgain}
          </Button>
          <ReportThis what={what} error={raw} />
        </>
      }
    >
      {children}
    </ErrorNotice>
  )
}
