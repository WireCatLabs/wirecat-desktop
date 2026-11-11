import { Check } from "lucide-react"
import { type ComponentType, useEffect, useId, useLayoutEffect, useRef } from "react"
import {
  canOpen,
  computerGate,
  type Gate,
  nextStep,
  previousStep,
  primaryAction,
  skillInPlace,
  skipTarget,
  stepIndex,
} from "@/domain/onboarding-flow"
import { AgentsMatrix, useSkillMatrix } from "@/features/agents"
import { confirmChoices } from "@/features/settings"
import { useNode } from "@/features/system"
import { StillInstalling, useUnfinishedInstalls } from "@/features/tools"
import { useMessages } from "@/i18n"
import { STEPS, type StepId, useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Logo } from "@/ui/Logo"
import { uiMessages } from "@/ui/messages"
import { leaveBehind, reducedMotion, useLastChildren } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { Install, installChosen } from "./InstallStep"
import { type OnboardingText, onboardingMessages } from "./messages"
import { SignIn } from "./SignInStep"
import { Agents, Choose, Computer, Done, leave, Welcome } from "./steps"

const bodies: Record<StepId, ComponentType> = {
  welcome: Welcome,
  computer: Computer,
  choose: Choose,
  install: Install,
  agents: AgentsStep,
  signin: SignIn,
  done: Done,
}

function AgentsStep() {
  const chosen = useOnboarding((s) => s.chosen)
  return (
    <>
      <SkillWhy />
      <Agents matrix={<AgentsMatrix expected={chosen} />} />
    </>
  )
}

function SkillWhy() {
  const m = useMessages(onboardingMessages).agents.why
  return (
    <section aria-label={m.label} className="flex max-w-[62ch] flex-col gap-[0.8rem] text-body leading-relaxed">
      <p>
        {m.ask} <q className="font-medium text-ink">{m.example}</q>
      </p>
      <ul className="flex flex-col gap-[0.4rem] text-ink-soft">
        {m.points.map((point) => (
          <li key={point} className="flex gap-[0.6rem]">
            <span aria-hidden className="mt-[0.7rem] size-[0.3rem] shrink-0 rounded-full bg-brand" />
            {point}
          </li>
        ))}
      </ul>
      <p>{m.next}</p>
    </section>
  )
}

const gateText = (gate: Gate, m: OnboardingText["flow"]) =>
  gate === "checking"
    ? m.blockedChecking
    : gate === "settingUp"
      ? m.blockedSettingUp
      : gate === "node"
        ? m.blockedNode
        : null

const useComputerGate = () => {
  const readiness = useSystem((s) => s.readiness)
  const running = useNode((s) => s.running)
  const myself = useNode((s) => s.myself)
  return computerGate(readiness, running, myself)
}

/** The setup steps take the sidebar's place while the flow is open. */
export function SetupSteps({ onExit }: { onExit: () => void }) {
  const step = useOnboarding((s) => s.step)
  const resuming = useOnboarding((s) => s.resuming)
  const m = useMessages(onboardingMessages)
  const ui = useMessages(uiMessages)
  const current = resuming ? -1 : stepIndex(step)
  // The sidebar must not jump past the Node.js gate that holds Continue on Your computer.
  const gate = useComputerGate()
  return (
    <aside
      className="reveal flex w-[12rem] shrink-0 flex-col border-line border-r bg-wall xl:w-[13.5rem]"
      data-tauri-drag-region
    >
      <div className="flex h-[7rem] items-center px-[1.5rem] pb-[0.6rem]" data-tauri-drag-region>
        <Logo className="flex h-[2.3rem] items-center gap-[0.75rem] [&>svg:last-child]:h-[40%]" />
      </div>
      <nav aria-label={m.flow.stepsNav}>
        <ol className="flex flex-col gap-[0.15rem]">
          {STEPS.map((s, i) => {
            const here = i === current
            const done = i < current
            const shut = !canOpen(s, gate)
            return (
              <li key={s} className="relative">
                {/* The track between two dots fills as the setup passes it, so the list reads as progress. */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-[calc(50%+0.6rem)] left-[2.1rem] h-[1.25rem] w-[2px] -translate-x-1/2 transition-colors duration-(--motion-slow)",
                      done ? "bg-brand" : "bg-line-strong",
                    )}
                  />
                )}
                <button
                  type="button"
                  aria-current={here ? "step" : undefined}
                  aria-disabled={shut || undefined}
                  title={shut ? (gateText(gate, m.flow) ?? undefined) : undefined}
                  onClick={shut ? undefined : () => useOnboarding.getState().go(s)}
                  className={cx(
                    "relative flex min-h-[2.3rem] w-full items-center gap-[0.75rem] px-[1.5rem] py-[0.3rem] text-left text-[0.95rem] leading-tight",
                    here
                      ? "font-semibold text-ink"
                      : shut
                        ? "cursor-not-allowed text-ink-dim"
                        : "text-ink-soft hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-brand transition-transform duration-(--motion-normal)",
                      here ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cx(
                      "grid size-[1.2rem] shrink-0 place-items-center rounded-full font-mono text-[0.85rem] tabular-nums",
                      "transition-colors duration-(--motion-slow)",
                      here
                        ? "bg-brand text-brand-ink"
                        : done
                          ? "bg-brand-soft text-brand"
                          : "bg-wall ring-1 ring-idle ring-inset",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {m.steps[s]}
                  {done && <span className="sr-only">{ui.stepDone}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="mt-auto flex flex-col gap-[0.4rem] px-[1.1rem] pb-[1.6rem]">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => {
            leave()
            useOnboarding.getState().later()
            onExit()
          }}
        >
          {m.flow.later}
        </Button>
        <p className="px-[0.75rem] text-[0.85rem] leading-snug text-ink-dim">{m.flow.laterNote}</p>
      </div>
    </aside>
  )
}

/** The step's frame, held while the setup reads what this computer already has, so no step shows and then jumps. */
function Resuming() {
  const m = useMessages(onboardingMessages).flow
  return (
    <main aria-busy="true" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[48rem] flex-col gap-[1.5rem] px-[2.1rem] pt-[2.4rem]">
        <div className="flex flex-col gap-[0.8rem]">
          <Skeleton className="h-[2.1rem] w-[16rem]" label={m.resuming} />
          <Skeleton className="h-[1.6rem] w-full max-w-[40rem]" />
        </div>
        <Skeleton className="h-[12rem] w-full" />
      </div>
    </main>
  )
}

export function Onboarding(props: { onExit: () => void; onTour: () => void }) {
  const resuming = useOnboarding((s) => s.resuming)
  return resuming ? <Resuming /> : <Steps {...props} />
}

function Steps({ onExit, onTour }: { onExit: () => void; onTour: () => void }) {
  const step = useOnboarding((s) => s.step)
  const chosen = useOnboarding((s) => s.chosen)
  const m = useMessages(onboardingMessages)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const installs = useTools((s) => s.installs)
  const heading = useRef<HTMLHeadingElement>(null)
  const scroller = useRef<HTMLElement>(null)
  const headingId = useId()
  const shown = useRef(step)
  const stage = useRef<HTMLDivElement>(null)
  const { go, finish } = useOnboarding.getState()
  // The Install and Done steps show each install in place; the others say only that one is still going.
  const stillInstalling = useUnfinishedInstalls().length > 0 && step !== "install" && step !== "done"
  const computer = useComputerGate()
  const blockedId = useId()

  useEffect(() => {
    useTools.getState().refresh()
  }, [])

  // Move focus to the new heading so a screen reader announces the step; not on first open, where it would jump.
  useEffect(() => {
    if (shown.current === step) return
    shown.current = step
    scroller.current?.scrollTo?.({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
    heading.current?.focus({ preventScroll: true })
  }, [step])
  // The step that left fades out where it was while the new one slides in over it.
  const left = useRef(step)
  const previous = useLastChildren(stage)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a ref from useLastChildren, read when the switch happens
  useLayoutEffect(() => {
    const el = stage.current
    const view = scroller.current
    if (left.current === step || !el || !view) return
    left.current = step
    const gone = previous.current.filter((c) => !c.isConnected)
    const height = view.scrollTop + view.clientHeight - el.offsetTop
    leaveBehind(gone, el, { top: 0, left: 0, width: el.clientWidth, height })
  }, [step])

  const page = m.pages[step]
  const Body = bodies[step]
  const toInstall = chosen.filter((id) => !installs[id]?.length).length
  // Until one skill is in place, Continue leaves the step without the thing it is for, so Install leads instead.
  const hasSkill = useSkillMatrix().rows.some((r) => skillInPlace(r.cells.map((c) => c.cell.kind)))
  const quietContinue = step === "agents" && !hasSkill

  const close = (tour: boolean) => {
    leave()
    finish()
    onExit()
    if (tour) onTour()
  }

  const kind = primaryAction(step, toInstall, nodeReady)
  const primary: { label: string; run: () => void } =
    kind === "start"
      ? {
          label: m.flow.getStarted,
          run: () => {
            confirmChoices()
            go(nextStep(step, chosen.length))
          },
        }
      : kind === "install"
        ? {
            label: m.flow.installTools(toInstall),
            run: () => {
              installChosen()
              go(nextStep(step, chosen.length))
            },
          }
        : kind === "tour"
          ? // Done leads into the window itself; the tour ends on the first guide, so the guides wait until then.
            { label: m.flow.tour, run: () => close(true) }
          : { label: m.flow.continue, run: () => go(nextStep(step, chosen.length)) }

  // Tools cannot install without Node.js, so the computer step holds until it is ready or the owner takes it on.
  const blocked = step === "computer" ? gateText(computer, m.flow) : null
  const skipTo = skipTarget(step)
  const skip = skipTo ? () => go(skipTo) : null
  const back = previousStep(step)

  return (
    <main ref={scroller} aria-labelledby={headingId} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className={cx(
          "mx-auto flex min-h-full max-w-[48rem] flex-col gap-[1.5rem] px-[2.1rem] pt-[2.4rem]",
          step === "welcome" ? "justify-center pb-[4rem]" : "pb-0",
        )}
      >
        {/* Each step slides in where the last one was; the footer below stays put. */}
        <div ref={stage} className="relative flex flex-col">
          <div key={step} className="step-in flex flex-col gap-[1.5rem]">
            <div className="flex flex-col gap-[0.8rem]">
              <h1
                ref={heading}
                id={headingId}
                tabIndex={-1}
                className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]"
                style={{ outline: "none" }}
              >
                {page.title}
              </h1>
              <p className="max-w-[60ch] text-[1.05rem] leading-relaxed text-ink-soft">{page.lead}</p>
            </div>

            <Body />
          </div>
        </div>

        {step === "welcome" ? (
          <div>
            <Button variant="primary" size="lg" onClick={primary.run}>
              {primary.label}
            </Button>
          </div>
        ) : (
          // Pinned to the bottom of the window, so a step's content loading or growing never moves it.
          <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-line border-t bg-wall pt-[1.2rem] pb-[2.2rem]">
            {back && (
              <Button variant="ghost" onClick={() => go(back)}>
                {m.flow.back}
              </Button>
            )}
            {/* Crossfade keeps the old reason on screen while it fades, so the description lives outside it, once. */}
            {blocked && (
              <span id={blockedId} hidden>
                {blocked}
              </span>
            )}
            {/* Why Continue is held, or that an install started earlier is still running: it outlives its step. */}
            <Crossfade
              swap={blocked ? `blocked:${blocked}` : stillInstalling ? "busy" : "idle"}
              className="min-w-0 flex-1 px-2"
            >
              {blocked ? (
                <p className="text-right text-[0.95rem] leading-snug text-ink-soft">{blocked}</p>
              ) : (
                stillInstalling && <StillInstalling />
              )}
            </Crossfade>
            {skip && (
              <Button variant="ghost" onClick={skip}>
                {m.flow.skip}
              </Button>
            )}
            {step === "done" && (
              <Button variant="ghost" onClick={() => close(false)}>
                {m.flow.openTools}
              </Button>
            )}
            <Button
              data-setup-next
              variant={quietContinue ? "secondary" : "primary"}
              size="lg"
              aria-disabled={blocked ? true : undefined}
              aria-describedby={blocked ? blockedId : undefined}
              className={cx(blocked && "cursor-not-allowed opacity-45 hover:bg-brand")}
              onClick={blocked ? undefined : primary.run}
            >
              {primary.label}
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
