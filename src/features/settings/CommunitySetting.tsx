import { RotateCw } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { CommunityStatus } from "@/platform/community-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Switch } from "@/ui/Switch"
import { LeftOut } from "./LeftOut"
import { settingsMessages } from "./messages"

/**
 * Off by default: no community tool has been reviewed yet, and turning it on is the owner's own decision to trust a
 * review that checks how a tool is built and released, not what it does.
 */
export function CommunitySetting() {
  const m = useMessages(settingsMessages)
  const lang = useLang()
  const [status, setStatus] = useState<CommunityStatus | null>(null)
  const [atStart, setAtStart] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    platform
      .communityStatus()
      .then((s) => {
        setStatus(s)
        setAtStart(s.show)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const change = (show: boolean) => {
    if (!status) return
    setError(null)
    setStatus({ ...status, show })
    platform.setCommunityShown(show).catch((e) => {
      setStatus({ ...status, show: !show })
      setError(String(e))
    })
  }

  const changed = status !== null && atStart !== null && status.show !== atStart
  // A build without the list's key can still turn the switch off, never on.
  const locked = status === null || (!status.available && !status.show)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Switch id={id} checked={status?.show ?? false} disabled={locked} onChange={change} />
        <label htmlFor={id} className="font-medium">
          {m.community}
        </label>
        <InfoTip label={m.communityInfo} className="-ml-1.5">
          {m.communityHelp}
          {status && !status.available && <> {m.communityNoKey}</>}
        </InfoTip>
        <button
          type="button"
          className="text-brand underline hover:text-brand-hover"
          onClick={() => platform.openUrl(`https://wirecat.dev/${lang}/docs/build-create-cli`)}
        >
          {m.communityHow}
        </button>
      </div>
      <Collapse open={changed} className="flex flex-wrap items-center gap-3">
        <p className="text-[0.9rem] text-ink-soft">{status?.show ? m.communityOnNext : m.communityOffNext}</p>
        <Button
          size="sm"
          icon={<RotateCw className="size-4" strokeWidth={1.8} aria-hidden />}
          onClick={() => platform.restart()}
        >
          {m.restart}
        </Button>
      </Collapse>
      <LeftOut source="community" />
      <Collapse open={error !== null}>
        <ErrorNotice inline>{error}</ErrorNotice>
      </Collapse>
    </div>
  )
}
