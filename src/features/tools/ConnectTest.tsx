import { useEffect, useState } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { otherServerTools, quietDelay } from "@/domain/connect-guide"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { McpServerStatus } from "@/platform/mcp-server-schemas"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { CopyField } from "@/ui/CopyField"
import { DiscoveryHelp } from "./ConnectApp"
import { type AppId, testPrompt } from "./connect-apps"
import { Note, Para, Progress } from "./connect-parts"
import { appLabel, type TestState } from "./connect-steps"
import { openConnect } from "./go"
import { connectMessages } from "./messages-connect"

export function TestStep(props: {
  tool: CatalogTool
  app: AppId
  server: McpServerStatus
  test: TestState
  since: number
  quietFromStart: boolean
  onBack(): void
  onDone(): void
  onAgain(): void
}) {
  const { tool, app, server, test, since, quietFromStart, onBack, onDone, onAgain } = props
  const all = useMessages(connectMessages)
  const m = all.test
  const lang = useLang()
  const name = app === "other" ? all.theApp : all.apps[app].name
  const [quiet, setQuiet] = useState(quietFromStart)
  useEffect(() => {
    if (test.state !== "waiting" || quiet) return
    const t = setTimeout(() => setQuiet(true), quietDelay(since, Date.now()))
    return () => clearTimeout(t)
  }, [test.state, quiet, since])

  const loggedIn = test.state !== "waiting"
  const counts = test.state === "called" || (test.state === "connected" && test.counts)
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        <Progress state={loggedIn ? "done" : "busy"}>
          {loggedIn ? (
            <>
              {m.loggedIn(appLabel(test.client, lang))} <span className="text-ink-dim">{m.selfNamed}</span>
            </>
          ) : (
            m.waitingLogin(name)
          )}
        </Progress>
        {counts || !loggedIn ? (
          <Progress state={test.state === "called" ? "done" : loggedIn ? "busy" : "todo"}>
            {test.state === "called" ? (
              <>
                {m.firstCall} <span className="selectable font-mono">{test.client.lastTool}</span>
                {test.client.lastToolAt && (
                  <span className="text-ink-dim tabular-nums">
                    {m.at(formatDate(test.client.lastToolAt, { hour: "2-digit", minute: "2-digit" }, lang))}
                  </span>
                )}
              </>
            ) : (
              m.waitingCall
            )}
          </Progress>
        ) : null}
      </ul>
      {!loggedIn && <Para>{m.finishLogin(name)}</Para>}
      {loggedIn && test.state !== "called" && (
        <div className="flex flex-col gap-2">
          <Para>{m.askNow(name, tool.name)}</Para>
          <div className="max-w-[34rem]">
            <CopyField value={testPrompt(tool, all)} label={m.copyPrompt} />
          </div>
          {!counts && <Note>{m.noCounts(tool.bin, name, tool.name)}</Note>}
        </div>
      )}
      {test.state === "called" && (
        <>
          <Para>{m.reached(all.apps[app].name, tool.bin)}</Para>
          <NextSteps tool={tool} name={name} onAgain={onAgain} />
        </>
      )}
      {!loggedIn && quiet && <Troubleshoot name={name} tool={tool} app={app} server={server} />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {test.state === "called" || (loggedIn && !counts) ? (
          <Button size="sm" variant="primary" onClick={onDone}>
            {m.finish}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onBack}>
            {m.back(name)}
          </Button>
        )}
      </div>
    </>
  )
}

/** Rule 9: the goal is reached, so say what else is worth doing from here. */
function NextSteps({ tool, name, onAgain }: { tool: CatalogTool; name: string; onAgain(): void }) {
  const all = useMessages(connectMessages)
  const m = all.next
  const installs = useTools((s) => s.installs)
  const others = otherServerTools(tools, tool.id, installs)
  return (
    <div className="flex flex-col gap-2.5 rounded-[0.45rem] bg-app-2 px-4 py-3">
      <p className="text-[0.92rem] font-medium text-ink">{m.title}</p>
      <div className="flex max-w-[34rem] flex-col gap-1">
        <span className="text-[0.9rem] text-ink-soft">{m.ask(name)}</span>
        <CopyField value={testPrompt(tool, all)} label={m.copyPrompt} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onAgain}>
          {m.another}
        </Button>
        {others.map((t) => (
          <Button key={t.id} size="sm" variant="ghost" onClick={() => openConnect(t.id)}>
            {t.id === "memo" ? m.tooMemo : m.too(t.name)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("logs")}>
          {m.logs}
        </Button>
      </div>
    </div>
  )
}

function Troubleshoot(props: { name: string; tool: CatalogTool; app: AppId; server: McpServerStatus }) {
  const { name, tool, app, server } = props
  const m = useMessages(connectMessages).trouble
  return (
    <div className="flex flex-col gap-2 rounded-[0.45rem] bg-app-2 px-4 py-3">
      <p className="text-[0.92rem] font-medium text-ink">{m.title(name)}</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.88rem] text-ink-soft">
        <li>
          <span className="text-ink">{m.unreachable}</span>{" "}
          {m.unreachableFix(<span className="selectable font-mono text-ink">{server.connectorUrl}</span>)}
        </li>
        <li>
          <span className="text-ink">{m.badCode}</span> {m.badCodeFix}
        </li>
        <li>
          <span className="text-ink">{m.noPage}</span> {m.noPageFix(name)}
        </li>
      </ul>
      <DiscoveryHelp tool={tool} app={app} />
    </div>
  )
}
