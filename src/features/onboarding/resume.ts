import { tools } from "@/domain/catalog"
import { accountReady, computerGate, type Progress, resumeAt, skillInPlace } from "@/domain/onboarding-flow"
import { skillCell, skillColumns } from "@/domain/skills"
import { platform } from "@/platform/bridge"
import { useAgents } from "../agents/store"
import { HOME_SECTION, useNav } from "../nav"
import { useNode } from "../system/node-store"
import { useSystem } from "../system/store"
import { useTools } from "../tools/store"
import { useOnboarding } from "./store"

const signsIn = (t: (typeof tools)[number]) => Boolean(t.setup || t.signIn?.command)

const runningInstalls = () =>
  Object.entries(useTools.getState().sessions)
    .filter(([, s]) => s.operation === "install" && !s.outcome)
    .map(([id]) => id)

async function readProgress(): Promise<Progress> {
  const { reached } = useOnboarding.getState()
  if (!useTools.getState().checked) await useTools.getState().refresh()
  if (!useSystem.getState().readiness) await useSystem.getState().refresh()
  const nodeReady = computerGate(useSystem.getState().readiness, false, useNode.getState().myself) === null
  const { installs } = useTools.getState()
  const installed = tools.filter((t) => installs[t.id]?.length)
  const base = { reached, nodeReady, installed: installed.length, installing: runningInstalls().length > 0 }
  const none = { agentFound: false, skillInAgent: false, signedOut: 0 }
  if (base.installing || installed.length === 0) return { ...base, ...none }

  const withSkill = installed.filter((t) => t.skill)
  const [, ...accounts] = await Promise.all([
    useAgents.getState().load(withSkill.map((t) => t.id)),
    ...installed.filter(signsIn).map((t) =>
      platform.listProfiles(t.id).then(
        (profiles) => accountReady(profiles, !t.setup),
        () => true,
      ),
    ),
  ])
  const { agents, skills } = useAgents.getState()
  const targets = skillColumns(agents).map((c) => c.target)
  const kinds = withSkill.flatMap((t) =>
    targets.map(
      (target) =>
        skillCell({
          target,
          cliVersion: installs[t.id]?.[0]?.version ?? null,
          report: skills[t.id]?.report,
          error: skills[t.id]?.error,
        }).kind,
    ),
  )
  return {
    ...base,
    agentFound: (agents ?? []).some((a) => a.foundBy !== null),
    skillInAgent: skillInPlace(kinds),
    signedOut: accounts.filter((ready) => !ready).length,
  }
}

let latest = 0

/**
 * Opens the setup where the computer stands. `start` is the app opening on a setup never finished: with nothing
 * left, it closes and the home page shows. `reopen` is the owner asking for it: with nothing left, Done says so.
 */
export async function resumeSetup(from: "start" | "reopen") {
  const call = ++latest
  useOnboarding.setState({ open: true, resuming: true })
  let to: ReturnType<typeof resumeAt>
  try {
    to = resumeAt(await readProgress())
  } catch {
    to = useOnboarding.getState().step
  }
  // The owner may have left or picked a step meanwhile; that wins over a late answer.
  if (call !== latest || !useOnboarding.getState().resuming) return
  if (to === "home" && from === "start") {
    useOnboarding.getState().finish()
    useNav.getState().go(HOME_SECTION)
    return
  }
  const step = to === "home" ? "done" : to
  const running = step === "install" ? runningInstalls() : []
  useOnboarding.setState((s) => ({ chosen: [...new Set([...s.chosen, ...running])] }))
  useOnboarding.getState().go(step)
}
