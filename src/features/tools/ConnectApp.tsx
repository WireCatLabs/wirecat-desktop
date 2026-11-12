import { useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { McpServerStatus, OAuthSettings } from "@/platform/mcp-server-schemas"
import { ExtLink } from "@/shared/ExtLink"
import { errorText } from "@/shared/errors"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { APPS, type AppId, type AppStep, connectorName } from "./connect-apps"
import { Note, Para } from "./connect-parts"
import { LoginCode } from "./LoginCode"
import { connectMessages } from "./messages-connect"

export function ChooseStep({ tool, onChoose }: { tool: CatalogTool; onChoose(app: AppId): void }) {
  const m = useMessages(connectMessages)
  return (
    <>
      <Para>{m.choose(tool.name)}</Para>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["chatgpt", "claude", "other"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            className="flex flex-col items-start gap-0.5 rounded-inset border border-line-strong bg-app px-3.5 py-3 text-left transition-colors duration-(--motion-fast) hover:border-brand hover:bg-brand-soft/40"
          >
            <span className="text-[0.98rem] font-semibold text-ink">{m.apps[id].name}</span>
            <span className="text-[0.9rem] text-ink-soft">{m.apps[id].hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export function ConnectStep(props: { tool: CatalogTool; app: AppId; server: McpServerStatus; onAdded(): void }) {
  const { tool, app, server, onAdded } = props
  const m = useMessages(connectMessages)
  const spec = APPS[app]
  const words = m.apps[app]
  return (
    <>
      <Para>{m.connect.intro(tool.bin, app === "other" ? m.theApp : words.name)}</Para>
      <ol className="flex flex-col gap-3">
        {spec.steps.map((step, i) => (
          <li key={step.text} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
            <span className="pt-px text-[0.9rem] font-semibold text-ink-dim tabular-nums">{i + 1}.</span>
            <span className="text-[0.92rem] text-ink">
              {m.appSteps[step.text]}
              {step.link && (
                <>
                  {" "}
                  <ExtLink href={step.link.href}>{m.appLinks[step.link.label]}</ExtLink>
                </>
              )}
            </span>
            {step.copy && (
              <div className="col-start-2 max-w-[34rem]">
                <Copy step={step} tool={tool} server={server} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <Note>
        {words.limits}
        {spec.help && (
          <>
            {" "}
            <ExtLink href={spec.help}>{words.help}</ExtLink>.
          </>
        )}
      </Note>
      <DiscoveryHelp tool={tool} app={app} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={onAdded}>
          {m.connect.added}
        </Button>
      </div>
    </>
  )
}

/** BUG-15: an app that does not find the login settings under a path can be given them by hand. */
export function DiscoveryHelp({ tool, app }: { tool: CatalogTool; app: AppId }) {
  const [settings, setSettings] = useState<OAuthSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const all = useMessages(connectMessages)
  const m = all.connect
  const name = app === "other" ? all.theApp : all.apps[app].name
  const load = async () => {
    if (settings) return
    try {
      setSettings(await platform.mcpServerOAuth(tool.id))
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <div onClickCapture={load}>
      <Disclosure summary={m.discovery(name)}>
        <div className="flex flex-col gap-2.5">
          <Para>{m.discoveryWhy}</Para>
          <Note>{m.discoveryValues}</Note>
          {error && <ErrorNotice inline>{error}</ErrorNotice>}
          {settings && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <Field label={m.authorization} value={settings.authorizationEndpoint} copyLabel={m.copyAuthorization} />
              <Field label={m.token} value={settings.tokenEndpoint} copyLabel={m.copyToken} />
              {settings.registrationEndpoint && (
                <Field label={m.registration} value={settings.registrationEndpoint} copyLabel={m.copyRegistration} />
              )}
              <Field label={m.issuer} value={settings.issuer} copyLabel={m.copyIssuer} />
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  )
}

function Field({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[0.85rem] font-medium text-ink-dim">{label}</span>
      <CopyField value={value} label={copyLabel} />
    </div>
  )
}

function Copy({ step, tool, server }: { step: AppStep; tool: CatalogTool; server: McpServerStatus }) {
  const m = useMessages(connectMessages).copy
  if (step.copy === "url" && server.connectorUrl) return <CopyField value={server.connectorUrl} label={m.address} />
  if (step.copy === "name") return <CopyField value={connectorName(tool)} label={m.name} />
  if (step.copy === "code")
    return server.loginCode ? (
      <LoginCode server={{ ...server, loginCode: server.loginCode }} />
    ) : (
      <Note>{m.codeSoon}</Note>
    )
  return null
}
