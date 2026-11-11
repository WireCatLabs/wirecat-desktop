import { LogIn } from "lucide-react"
import type { ReactNode } from "react"
import { type CatalogTool, signsInHere } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { signInLostMessages } from "./messages-signin-lost"
import { useTerminal } from "./terminal-store"

/** A new sign-in for this account: in the window where the tool can, in a terminal otherwise. */
export function reconnect(tool: CatalogTool, profile: string, onDone?: () => void) {
  if (signsInHere(tool)) useSignIn.getState().start(tool.id, profile, onDone)
  else void useTerminal.getState().open(tool.id, profile)
}

/**
 * The one way an ended sign-in is told, in any tool: what happened in plain words, Reconnect, and the tool's own words
 * under Details. `keyring` is the sign-in that is there but could not be read, where waiting comes first.
 */
export function SignInLost(props: {
  tool: CatalogTool
  profile: string | null
  cause?: "ended" | "keyring"
  details?: ReactNode
  inline?: boolean
  onReconnect?: () => void
}) {
  const { tool, profile, cause = "ended", details, inline = false } = props
  const m = useMessages(signInLostMessages)
  const go = props.onReconnect ?? (profile ? () => reconnect(tool, profile) : null)
  return (
    <ErrorNotice
      tone="warn"
      inline={inline}
      action={
        tool.setup && go ? (
          <Button
            size="sm"
            variant={cause === "ended" ? "primary" : "secondary"}
            onClick={go}
            icon={<LogIn className="size-4" aria-hidden />}
          >
            {m.reconnect}
          </Button>
        ) : undefined
      }
      detail={
        <div className="flex flex-col gap-2">
          <p>{cause === "ended" ? `${m.why} ${m.next}` : m.keyringNext}</p>
          {details && <Disclosure summary={m.details}>{details}</Disclosure>}
        </div>
      }
    >
      {cause === "ended" ? m.ended(tool.name, profile ?? tool.name) : m.keyring(tool.name)}
    </ErrorNotice>
  )
}
