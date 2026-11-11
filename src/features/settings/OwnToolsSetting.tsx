import { useEffect, useId, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import type { OwnStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { reloadAddedTools } from "@/shared/added-tools"
import { externalHref } from "@/shared/external-href"
import { ownToolsDocs } from "@/shared/own-tools-docs"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Switch } from "@/ui/Switch"
import { LeftOut } from "./LeftOut"
import { settingsMessages } from "./messages"

/** Off by default, and turned on only through its warning: these tools get every piece of data WireCat holds. */
export function OwnToolsSetting() {
  const m = useMessages(settingsMessages)
  const lang = useLang()
  const [status, setStatus] = useState<OwnStatus | null>(null)
  const [atStart, setAtStart] = useState<boolean | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    platform
      .ownToolsStatus()
      .then((s) => {
        setStatus(s)
        setAtStart(s.allowed)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const save = (allowed: boolean) => {
    if (!status) return
    setError(null)
    setStatus({ ...status, allowed })
    platform.setOwnToolsAllowed(allowed).then(reloadAddedTools, (e) => {
      setStatus({ ...status, allowed: !allowed })
      setError(String(e))
    })
  }

  const changed = status !== null && atStart !== null && status.allowed !== atStart
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Switch
          id={id}
          checked={status?.allowed ?? false}
          disabled={status === null}
          onChange={(on) => (on ? setAsking(true) : save(false))}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={id} className="min-w-0 font-medium">
            {m.own}
          </label>
          <InfoTip label={m.ownInfo} className="-ml-1.5">
            {m.ownHelp}
          </InfoTip>
          <button
            type="button"
            className="text-brand underline hover:text-brand-hover"
            onClick={() => platform.openUrl(ownToolsDocs(lang))}
            {...externalHref(ownToolsDocs(lang))}
          >
            {m.ownDocs}
          </button>
        </div>
      </div>
      {status?.flag && <p className="text-[0.9rem] text-ink-soft">{m.ownFlag}</p>}
      <Collapse open={changed}>
        <p role="status" className="text-[0.9rem] text-ink-soft">
          {status?.allowed ? m.ownOnNow : m.ownOffNow}
        </p>
      </Collapse>
      <LeftOut source="own" />
      <Collapse open={error !== null}>
        <ErrorNotice inline>{error}</ErrorNotice>
      </Collapse>
      <Dialog
        open={asking}
        title={m.ownWarnTitle}
        onClose={() => setAsking(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {m.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setAsking(false)
                save(true)
              }}
            >
              {m.ownAllow}
            </Button>
          </>
        }
      >
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[0.95rem]">
          {m.ownWarn.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}
