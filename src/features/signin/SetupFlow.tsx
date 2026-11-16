import { LoaderCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { findTool } from "@/domain/catalog"
import { knownOf, type SetupDocument, textsOf } from "@/domain/setup-flow"
import { useLang, useMessages } from "@/i18n"
import { running, useSignIn } from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { BackButton } from "@/ui/BackButton"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { MOTION } from "@/ui/motion"
import { signinMessages } from "./messages"
import { flowMessages } from "./messages-flow"
import { Blocks, type FlowView } from "./SetupBlocks"
import { Stage } from "./Stages"
import { canGoBack, forgetSecrets, type Notice, useSetupFlow } from "./setup-flow-store"

/**
 * The sign-in of a tool that describes its own flow (`setup show`): its steps drawn with the app's own parts, its
 * answers checked by the tool on Continue, and saved only by the tool's `apply` run at the end.
 */
export function SetupFlowDialog({ doc, images }: { doc: SetupDocument; images: Record<string, string> }) {
  const s = useSignIn()
  const flow = useSetupFlow()
  const m = useMessages(signinMessages)
  const lang = useLang()
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (useSetupFlow.getState().doc !== doc) useSetupFlow.getState().open(doc)
  }, [doc])
  useEffect(() => () => forgetSecrets(), [])
  // The first field the tool refused takes focus, so the owner lands on what to fix.
  useEffect(() => {
    if (flow.refusals > 0) body.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()
  }, [flow.refusals])

  const step = flow.doc === doc ? doc.steps[flow.at] : undefined
  const t = textsOf(doc, lang)
  const view: FlowView = {
    doc,
    images,
    t,
    known: knownOf(doc, flow.answers, flow.results),
    answers: flow.answers,
    problems: flow.problems,
    domains: tool?.signIn?.links ?? [],
    answer: flow.answer,
    secret: flow.secret,
  }
  const runs = step?.kind === "run" && running(s.phase)

  return (
    <Dialog open={s.tool !== null} wide="xl" scroll title={m.title(name)} onClose={s.close} actions={<FlowActions />}>
      <div ref={body} className="flex flex-col gap-3 text-[1.1rem]">
        <p>{m.intro(<code className="font-mono text-ink">{s.profile}</code>, name)}</p>
        <AutoHeight swap={flow.at}>
          <Crossfade swap={flow.at} ms={MOTION.swap}>
            {step && (
              <section className="flex max-w-[44rem] flex-col gap-4 text-left" aria-labelledby="setup-step-title">
                <h3 id="setup-step-title" className="text-[1.25rem] font-semibold text-ink">
                  {t(step.title)}
                </h3>
                {flow.notice && <NoticeView notice={flow.notice} ended={step.kind === "done"} />}
                <Blocks blocks={step.blocks ?? []} view={view} />
                {runs && <Stage name={name} s={s} />}
              </section>
            )}
          </Crossfade>
        </AutoHeight>
      </div>
    </Dialog>
  )
}

function NoticeView({ notice, ended }: { notice: Notice; ended: boolean }) {
  const m = useMessages(flowMessages)
  if (notice.kind === "stuck") return <ErrorNotice>{m.stuck}</ErrorNotice>
  return (
    <ErrorNotice raw={notice.text}>
      {notice.kind === "check" ? m.checkFailed : ended ? m.runEnded : m.runFailed}
    </ErrorNotice>
  )
}

function FlowActions() {
  const s = useSignIn()
  const flow = useSetupFlow()
  const m = useMessages(flowMessages)
  const step = flow.doc?.steps[flow.at]
  if (!step) return null
  const back = canGoBack(flow) ? <BackButton onClick={flow.back} /> : null
  if (step.kind === "run")
    return (
      <Button variant="secondary" onClick={s.close} data-autofocus>
        {m.cancel}
      </Button>
    )
  if (step.kind === "done")
    return (
      <>
        {back}
        <Button variant="primary" onClick={s.close} data-autofocus>
          {s.phase === "done" ? m.done : m.close}
        </Button>
      </>
    )
  return (
    <>
      {back}
      <Button variant="secondary" onClick={s.close}>
        {m.cancel}
      </Button>
      <Button variant="primary" onClick={() => void flow.next()} busy={flow.checking} data-autofocus>
        {flow.checking ? m.checking : m.continue}
      </Button>
    </>
  )
}

/** While the tool says what its flow is: the dialog is already open where the flow will draw. */
export function SetupLoading() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const fm = useMessages(flowMessages)
  const name = (s.tool ? findTool(s.tool)?.name : undefined) ?? s.tool ?? ""
  return (
    <Dialog
      open={s.tool !== null}
      wide="xl"
      scroll
      title={m.title(name)}
      onClose={s.close}
      actions={
        <Button variant="secondary" onClick={s.close}>
          {fm.cancel}
        </Button>
      }
    >
      <div className="flex min-h-[19rem] flex-col items-center justify-center gap-3 text-[1.1rem]">
        <LoaderCircle className="size-8 text-brand motion-safe:animate-spin" aria-hidden />
        <p role="status">{fm.loading(name)}</p>
      </div>
    </Dialog>
  )
}
