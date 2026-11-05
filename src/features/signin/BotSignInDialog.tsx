import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { type BotStep, useBotSignIn } from "@/shared/bot-signin-store"
import { botMessages } from "@/shared/messages-bot"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Stepper, type StepState } from "@/ui/Stepper"
import { DoneStep, NAME_FORM, NameStep, TOKEN_FORM, TokenStep } from "./BotSteps"

const ORDER: BotStep[] = ["name", "token", "done"]

/**
 * Connects a bot of the messenger's own Bot API: a name the owner chooses, where to get the token, the token, then
 * the bot's name as the tool reported it. One surface; each step slides in where the last one was (rule 9).
 */
export function BotSignInDialog() {
  const s = useBotSignIn()
  const m = useMessages(botMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const at = ORDER.indexOf(s.step)
  const steps = ORDER.map((step, i) => ({
    label: m.steps[step],
    state: (i < at || s.step === "done" ? "done" : i === at ? (s.failure ? "failed" : "active") : "todo") as StepState,
  }))

  return (
    <Dialog
      open={tool !== undefined}
      wide
      scroll
      title={tool ? m.title(tool.name) : ""}
      onClose={s.close}
      actions={<Actions />}
    >
      {tool && (
        <div className="flex flex-col gap-4">
          <p className="text-[0.95rem] leading-snug text-ink-soft">{m.intro(tool.name, tool.bin)}</p>
          <Stepper steps={steps} />
          <div key={s.step} className="step-in">
            {s.step === "name" && <NameStep tool={tool} />}
            {s.step === "token" && <TokenStep tool={tool} />}
            {s.step === "done" && <DoneStep tool={tool} />}
          </div>
          <p role="status" className="sr-only">
            {s.checking ? m.announce.checking : s.step === "done" ? m.announce.connected : ""}
          </p>
        </div>
      )}
    </Dialog>
  )
}

function Actions() {
  const s = useBotSignIn()
  const m = useMessages(botMessages)
  if (s.step === "done")
    return (
      <Button variant="primary" onClick={s.close} data-autofocus>
        {m.done}
      </Button>
    )
  if (s.step === "name")
    return (
      <>
        <Button variant="secondary" onClick={s.close}>
          {m.cancel}
        </Button>
        <Button variant="primary" type="submit" form={NAME_FORM}>
          {m.next}
        </Button>
      </>
    )
  return (
    <>
      <Button variant="ghost" onClick={s.back} disabled={s.checking}>
        {m.back}
      </Button>
      <Button variant="secondary" onClick={s.close}>
        {s.failure ? m.close : m.cancel}
      </Button>
      <Button variant="primary" type="submit" form={TOKEN_FORM} disabled={s.checking}>
        {s.checking ? m.checking(findTool(s.tool ?? "")?.name ?? "") : m.connect}
      </Button>
    </>
  )
}
