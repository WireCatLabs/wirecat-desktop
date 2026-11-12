import type { ReactNode } from "react"
import { Button } from "@/ui/Button"

export function Para({ children }: { children: ReactNode }) {
  return <p className="max-w-[62ch]">{children}</p>
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[62ch] text-[0.9rem] text-ink-dim">{children}</p>
}

/** A tunnel guide's download button; beside it how the file is checked, or `stop` while it downloads. */
export function DownloadRow(props: {
  label: string
  busy: boolean
  checksum: string
  stop?: ReactNode
  onDownload(): void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="primary" onClick={props.onDownload} disabled={props.busy}>
        {props.label}
      </Button>
      {props.busy && props.stop ? props.stop : <span className="text-[0.9rem] text-ink-dim">{props.checksum}</span>}
    </div>
  )
}
