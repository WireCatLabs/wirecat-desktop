import * as v from "valibot"
import { create } from "zustand"
import {
  blocksOf,
  currentOf,
  DryRunSchema,
  type Field,
  knownOf,
  nextOf,
  type Outcome,
  pathAnswers,
  problemsHere,
  SETUP_LIMITS,
  type SetupDocument,
  visibleFields,
} from "@/domain/setup-flow"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { useSignIn } from "@/shared/signin-store"

/**
 * Passwords typed in the flow, by input id: outside the store, so no snapshot carries them, and wiped once sent to the
 * tool or when the flow closes.
 */
const secrets = new Map<string, string>()
export const typedSecret = (id: string) => secrets.get(id) ?? ""
export const forgetSecrets = () => secrets.clear()

type FlowState = {
  /** The document this state walks; a new one starts the walk over. */
  doc: SetupDocument | null
  at: string
  /** The steps visited before `at`, in order; Back returns along it. */
  history: string[]
  answers: Record<string, unknown>
  results: Record<string, Outcome>
  /** The tool's word on an input of the step on screen, from its dry run. */
  problems: Record<string, string>
  /** What stopped the step as a whole: a walk with no way on, a dry run that failed, or the run that led here. */
  notice: Notice | null
  checking: boolean
  /** Counts the dry runs that refused a field here, so focus moves to it once per Continue, not on every key. */
  refusals: number
  moves: number
  open(doc: SetupDocument): void
  answer(id: string, value: unknown): void
  secret(id: string, value: string): void
  next(): Promise<void>
  back(): void
  /** For captures and tests: follows the edges from the start with the answers given, without checking them. */
  walkTo(step: string, answers: Record<string, unknown>): void
}

export type Notice = { kind: "stuck" } | { kind: "check" | "run"; text: string }

const START = {
  doc: null,
  at: "",
  history: [],
  answers: {},
  results: {},
  problems: {},
  notice: null,
  checking: false,
  refusals: 0,
  moves: 0,
}

const fieldsOf = (doc: SetupDocument, step: string): Field[] =>
  blocksOf(doc.steps[step]?.blocks).flatMap(({ block }) =>
    block.type === "input" || block.type === "choice" ? [block as Field] : [],
  )

/** A step's fields start with the profile's current value or the default; a secret always starts empty. */
const seeded = (doc: SetupDocument, step: string, answers: Record<string, unknown>) => {
  const out = { ...answers }
  for (const field of fieldsOf(doc, step)) {
    if (out[field.id] !== undefined || (field.type === "input" && field.input === "password")) continue
    const value = currentOf(field, doc.values) ?? field.default
    if (value !== undefined) out[field.id] = typeof value === "number" ? String(value) : value
  }
  return out
}

export const useSetupFlow = create<FlowState>()((set, get) => {
  const visited = () => [...get().history, get().at]

  /** Moves to `to`; a run step starts at once, with the answers of the path. */
  const enter = (to: string | undefined, notice: Notice | null = null) => {
    const { doc, at, history, answers, moves } = get()
    if (!doc) return
    if (to === undefined || !doc.steps[to] || moves + 1 >= SETUP_LIMITS.transitions)
      return set({ notice: { kind: "stuck" }, checking: false })
    set({
      at: to,
      history: [...history, at],
      answers: seeded(doc, to, answers),
      problems: {},
      notice,
      checking: false,
      moves: moves + 1,
    })
    const step = doc.steps[to]
    if (step?.kind !== "run") return
    const sent = JSON.stringify(pathAnswers(doc, get().history, get().answers, secrets, get().results))
    secrets.clear()
    const name = step.result ?? to
    useSignIn.getState().startSetupRun(sent, (e) => {
      const flow = get()
      if (flow.doc !== doc || flow.at !== to || e.event === "stopped") return
      const outcome: Outcome = e.event === "done" ? { outcome: "ok" } : { outcome: "error", code: e.code ?? "failed" }
      const results = { ...flow.results, [name]: outcome }
      set({ results })
      enter(
        nextOf(step, knownOf(doc, flow.answers, results)),
        e.event === "failed" ? { kind: "run", text: e.message } : null,
      )
    })
  }

  return {
    ...START,
    open(doc) {
      forgetSecrets()
      set({ ...START, doc, at: doc.start, answers: seeded(doc, doc.start, {}) })
    },
    answer(id, value) {
      set((s) => ({ answers: { ...s.answers, [id]: value }, problems: omit(s.problems, id) }))
    },
    secret(id, value) {
      secrets.set(id, value)
      set((s) => ({ problems: omit(s.problems, id) }))
    },
    async next() {
      const { doc, at, checking } = get()
      const { tool, profile } = useSignIn.getState()
      const step = doc?.steps[at]
      if (!doc || !step || checking || !tool || !profile) return
      set({ checking: true, notice: null })
      const answers = pathAnswers(doc, visited(), get().answers, secrets, get().results)
      let checked: v.InferOutput<typeof DryRunSchema>
      try {
        checked = v.parse(DryRunSchema, await platform.setupCheck(tool, profile, JSON.stringify(answers)))
      } catch (e) {
        if (get().doc === doc && get().at === at)
          set({ checking: false, notice: { kind: "check", text: errorText(e) } })
        return
      }
      if (get().doc !== doc || get().at !== at) return
      const known = knownOf(doc, get().answers, get().results)
      const problems = problemsHere(checked, visibleFields(step.blocks, known))
      if (Object.keys(problems).length > 0) return set((s) => ({ checking: false, problems, refusals: s.refusals + 1 }))
      // A stop on a step before this one would mean an answer there changed under it; say so rather than move on.
      if (!checked.valid && checked.at !== at && visited().includes(checked.at))
        return set({
          checking: false,
          notice: { kind: "check", text: checked.errors.map((e) => `${e.input} ${e.message}`).join("; ") },
        })
      enter(nextOf(step, known))
    },
    back() {
      const { doc, history } = get()
      if (!doc) return
      // A run step is never entered by going back: it would run again by itself.
      const kept = [...history]
      let to = kept.pop()
      while (to !== undefined && doc.steps[to]?.kind === "run") to = kept.pop()
      if (to === undefined) return
      set({ at: to, history: kept, problems: {}, notice: null, checking: false })
    },
    walkTo(step, answers) {
      const { doc } = get()
      if (!doc) return
      set({ answers: { ...get().answers, ...answers } })
      for (let i = 0; i < SETUP_LIMITS.transitions && get().at !== step; i++) {
        const here: SetupDocument["steps"][string] | undefined = doc.steps[get().at]
        const to = here && nextOf(here, knownOf(doc, get().answers, get().results))
        if (!to || doc.steps[to]?.kind === "run") break
        set((s) => ({ at: to, history: [...s.history, s.at], answers: seeded(doc, to, s.answers) }))
      }
    },
  }
})

const omit = (record: Record<string, string>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

/** Whether Back leads anywhere from the step on screen: a step may forbid it, and a done step allows it only by name. */
export const canGoBack = (s: Pick<FlowState, "doc" | "at" | "history">) => {
  const step = s.doc?.steps[s.at]
  if (!step || !s.history.some((h) => s.doc?.steps[h]?.kind !== "run")) return false
  return step.kind === "done" ? step.back === true : step.back !== false
}
