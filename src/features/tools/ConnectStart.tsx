import type { CatalogTool } from "@/domain/catalog"
import { type Failure, type Phase, portInUse, startProgress, type Tunnel } from "@/domain/connect-guide"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Link, Note, Progress } from "./connect-parts"
import { connectMessages } from "./messages-connect"
import { helperMessages } from "./messages-helper"

export function StartStep(props: {
  tool: CatalogTool
  tunnel: Tunnel
  phase: Phase
  failure: Failure | null
  approval: string | null
  onRetry(): void
  onBack(): void
}) {
  const { tool, tunnel, phase, failure, approval, onRetry, onBack } = props
  const m = useMessages(connectMessages).start
  const hm = useMessages(helperMessages)
  const { open, server } = startProgress(phase, failure)
  return (
    <>
      <ul className="flex flex-col gap-2">
        {tunnel === "tailscale" && <Progress state={open}>{m.funnel(tool.bin)}</Progress>}
        {tunnel === "wirecat" && <Progress state={open}>{hm.startStep(tool.bin)}</Progress>}
        {tunnel === "cloudflare" && <Progress state={open}>{m.tunnel(tool.bin)}</Progress>}
        <Progress state={server}>{m.server(tool.bin)}</Progress>
      </ul>
      {phase === "tunnel" && approval && (
        <p className="text-[0.92rem] text-ink">{m.approve(<Link href={approval}>{m.openAgain}</Link>)}</p>
      )}
      {phase === "tunnel" && tunnel === "tailscale" && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => platform.tailscaleStop()}>
            {m.stop}
          </Button>
        </div>
      )}
      {failure && phase === "failed" && (
        <>
          <ErrorNotice inline>{failure.message}</ErrorNotice>
          <Note>{portInUse(failure.message) ? m.portInUse : m.nothingLeft}</Note>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetry}>
              {m.tryAgain}
            </Button>
            <Button size="sm" variant="ghost" onClick={onBack}>
              {m.back}
            </Button>
          </div>
        </>
      )}
    </>
  )
}
