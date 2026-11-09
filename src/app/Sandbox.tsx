import { FlaskConical } from "lucide-react"
import { useMessages } from "@/i18n"
import { useSandbox } from "@/shared/sandbox-store"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { appMessages } from "./messages"

/** Across the top of every page of a `bin/sandbox` copy, and never dismissed: the copy looks like the real app. */
export function SandboxBanner() {
  const name = useSandbox((s) => s.name)
  const m = useMessages(appMessages)
  if (!name) return null
  return (
    <p
      role="status"
      className="flex items-center gap-[0.6rem] border-warn border-b bg-warn/25 px-[1.3rem] py-[0.5rem] font-medium text-[0.95rem] text-ink"
    >
      <FlaskConical className="size-[1.1rem] shrink-0 text-warn-ink" strokeWidth={1.8} aria-hidden />
      {m.sandbox.banner(name)}
    </p>
  )
}

/** Asked before a sign-in in a test copy, because a real account's whole history would sync into it. */
export function SandboxConfirm() {
  const asking = useSandbox((s) => s.asking !== null)
  const answer = useSandbox((s) => s.answer)
  const m = useMessages(appMessages)
  return (
    <Dialog
      open={asking}
      title={m.sandbox.title}
      onClose={() => answer(false)}
      actions={
        <>
          <Button variant="secondary" onClick={() => answer(false)} data-autofocus>
            {m.sandbox.cancel}
          </Button>
          <Button variant="danger" onClick={() => answer(true)}>
            {m.sandbox.proceed}
          </Button>
        </>
      }
    >
      <p className="text-[1.05rem] leading-relaxed">{m.sandbox.warning}</p>
    </Dialog>
  )
}
