import { useState } from "react"
import { crmToolOf } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { nameOf, useAccountNames } from "@/shared/account-names-store"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { useFieldError } from "@/ui/FieldError"

import { Choice } from "./Choice"
import { clientMessages } from "./messages"
import { useClients } from "./store"

/**
 * memo names no profile of the CRM's CLI for the account: memo's reason, and its profiles to choose from. Nothing is
 * preselected, so the owner always picks; with none to pick the card stays read only.
 */
export function ProfilePicker(props: { onChoose: (profile: string) => void; onCancel: (ref: string | null) => void }) {
  const m = useMessages(clientMessages)
  const asking = useClients((s) => s.asking)
  const [choice, setChoice] = useState<string | null>(null)
  const tool = asking ? (crmToolOf(asking.account.provider)?.name ?? asking.account.provider) : ""
  const toolId = asking ? (crmToolOf(asking.account.provider)?.id ?? null) : null
  const names = useAccountNames((n) => n.names)
  const need = useFieldError("clients-profile-pick")
  const picked = choice !== null && asking?.profiles.includes(choice) ? choice : null
  const close = (chosen: boolean) => {
    const ref = useClients.getState().asking?.move?.ref ?? null
    setChoice(null)
    need.clear()
    if (chosen && picked) return props.onChoose(picked)
    useClients.getState().ask(null)
    props.onCancel(ref)
  }
  const none = asking !== null && asking.profiles.length === 0
  return (
    <Dialog
      open={asking !== null}
      title={asking ? m.profileTitle(tool, asking.account.account) : ""}
      onClose={() => close(false)}
      actions={
        none ? (
          <Button size="sm" variant="primary" onClick={() => close(false)}>
            {m.close}
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => close(false)}>
              {m.cancel}
            </Button>
            <Button size="sm" variant="primary" onClick={() => (picked ? close(true) : need.fail(m.profileNeeded))}>
              {asking?.move ? m.profileMove : m.profileUse}
            </Button>
          </>
        )
      }
    >
      {asking && (
        <fieldset id="clients-profile-pick" className="flex flex-col gap-[0.6rem] border-0 p-0" {...need.field}>
          <legend className="mb-[0.6rem] flex flex-col gap-[0.4rem] text-[0.95rem] text-ink-soft">
            <span>{none ? m.profileNone(tool) : m.profileBody(tool)}</span>
            {asking.why && <span className="text-[0.9rem] text-ink-dim">{m.profileWhy(asking.why)}</span>}
          </legend>
          {asking.profiles.map((name) => (
            <Choice
              key={name}
              group="clients-profile-pick"
              checked={picked === name}
              onChange={() => {
                setChoice(name)
                need.clear()
              }}
            >
              {toolId && nameOf(names, toolId, name) ? `${nameOf(names, toolId, name)} (${name})` : name}
            </Choice>
          ))}
          {need.hint}
        </fieldset>
      )}
    </Dialog>
  )
}
