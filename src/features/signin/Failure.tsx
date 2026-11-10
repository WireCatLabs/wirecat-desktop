import { Copy } from "lucide-react"
import { useState } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { type ExplainedFailure, explainFailure } from "@/domain/signin-failure"
import { openTool } from "@/features/tools"
import { useMessages } from "@/i18n"
import { OpenLink } from "@/shared/OpenLink"
import { ReportThis } from "@/shared/ReportThis"
import { useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { uiMessages } from "@/ui/messages"
import { signinMessages } from "./messages"
import { wizardMessages } from "./messages-wizard"
import type { SignInView } from "./Stages"

/** The failure of this view in the window's words, with what to offer; null before anything failed. */
export function explainView(s: SignInView): ExplainedFailure | null {
  if (s.phase !== "failed" || !s.failure || !s.tool || !s.profile) return null
  const entry = findTool(s.tool)
  const others = entry && !entry.signIn?.pick ? signInMethods(entry).filter((m) => m.id !== s.method) : []
  return explainFailure({
    tool: s.tool,
    profile: s.profile,
    message: s.failure.message,
    code: s.failure.code,
    reason: s.failure.reason ?? null,
    at: s.failedAt,
    otherMethod: others.length > 0,
    terminal: Boolean(entry?.setup),
    page: s.hintPage ?? undefined,
  })
}

/** The other way in the catalog has for this tool, if any. */
export function otherMethod(s: Pick<SignInView, "tool" | "method">) {
  const entry = s.tool ? findTool(s.tool) : undefined
  if (!entry || entry.signIn?.pick) return undefined
  return signInMethods(entry).find((m) => m.id !== s.method)
}

/**
 * What went wrong, the likely cause, and the one thing to do; the dialog's own Try again is the action when it is a
 * retry. The tool's own words stay under Details, for the curious and for a report.
 */
export function FailureCard({ s, explained }: { s: SignInView; explained: ExplainedFailure }) {
  const m = useMessages(signinMessages)
  const wm = useMessages(wizardMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const text = wm.failure[explained.reason]
  const actions = [explained.primary, explained.fallback].filter((a) => a !== null)
  const other = otherMethod(s)
  const close = () => useSignIn.getState().close()
  return (
    <ErrorNotice
      detail={
        <div className="flex flex-col gap-2">
          <p>{text.cause(name)}</p>
          <Disclosure summary={wm.details}>
            <p className="selectable font-mono text-[0.85rem] break-words text-ink-soft">{s.failure?.message}</p>
          </Disclosure>
        </div>
      }
      action={
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            if ((action === "update" || action === "toolPage") && tool)
              return (
                <Button
                  key={action}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    close()
                    openTool(tool.id)
                  }}
                >
                  {action === "update" ? wm.actions.update(name) : wm.actions.toolPage(name)}
                </Button>
              )
            if (action === "otherMethod" && other && s.tool && s.profile) {
              const { tool: id, profile, onFinish } = s
              return (
                <Button
                  key={action}
                  size="sm"
                  variant="secondary"
                  onClick={() => useSignIn.getState().start(id, profile, onFinish ?? undefined, other.id, true)}
                >
                  {m.switchTo(other.id, other.label)}
                </Button>
              )
            }
            if (action === "copy" && explained.copy) return <CopyCommand key={action} value={explained.copy} />
            if (action === "openPage" && explained.page) {
              const page = explained.page
              return (
                <OpenLink key={action} url={page}>
                  {wm.actions.openPage[explained.reason] ?? wm.actions.openPageOther}
                </OpenLink>
              )
            }
            return null
          })}
          <ReportThis
            what={`Signing in to ${name} as ${s.profile}`}
            tool={s.tool}
            error={s.failure?.message ?? ""}
            onOpen={close}
          />
        </div>
      }
    >
      <span className="font-medium">{text.title(name)}</span>
    </ErrorNotice>
  )
}

function CopyCommand({ value }: { value: string }) {
  const wm = useMessages(wizardMessages)
  const um = useMessages(uiMessages)
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<Copy className="size-4" aria-hidden />}
      title={value}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
      }}
    >
      {copied ? um.copied : wm.actions.copy}
    </Button>
  )
}
