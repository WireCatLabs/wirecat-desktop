import { Sparkles } from "lucide-react"
import { useId, useRef, useState } from "react"
import { type NameChoices, nameChoices, queryReason, type ValueOption, withoutPatterns } from "@/domain/search"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { QueryDraft as Draft, QueryWriter, SearchAnswer } from "@/platform/search-schemas"
import { errorText } from "@/shared/errors"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldFocus } from "@/ui/field"
import { focusInPlace } from "@/ui/motion"
import { StableText } from "@/ui/Skeleton"
import { searchMessages } from "./messages"
import { NameChoiceButtons } from "./NameChoices"

/** What one search with a limit of 1 says about a written query, before it is offered. */
type Checked =
  | { kind: "found"; count: number; more: boolean }
  /** Accepted without a count (too slow, too old), or the tool could not search just now: `message` says why. */
  | { kind: "unchecked"; message?: string }
  | { kind: "choose"; choices: NameChoices }
  | { kind: "refused"; message: string }

type State =
  | { kind: "idle" }
  | { kind: "empty" }
  | { kind: "writing" }
  | { kind: "checking"; by: QueryWriter }
  | { kind: "error"; message: string }
  | Exclude<Draft, { kind: "query" }>
  | { kind: "query"; query: string; by: QueryWriter; checked: Checked }

type Props = {
  tool: string | null
  /** The tour's example request, shown as already written into the query; nothing is sent. */
  example?: string | null
  /**
   * One search of the chosen profile with a limit of 1, so a query is offered only once the tool took it; null while
   * the tool or the profile is still to be chosen.
   */
  check: ((query: string) => Promise<SearchAnswer>) | null
  /** The people and chats the tool knows, for the choices when a name in the query fits several or nobody. */
  values: Readonly<Record<string, readonly ValueOption[]>>
  /** Says what is missing on the page, as the Search button does, when no tool or profile is chosen yet. */
  onNeedTool: () => void
  /** The query goes into the bar for the owner to check; the results show only once he presses Search. */
  onWritten: (query: string, named?: { field: string; id: string; label: string }) => void
}

const MAX_REQUEST = 500

/** What the tool's answer to the check means for the query; a query the parser refused comes back as `retry`. */
function checkedBy(query: string, answer: SearchAnswer, values: Props["values"]): Checked | "retry" {
  if (answer.kind === "hits") {
    const count = answer.total?.value ?? answer.hits.length
    return { kind: "found", count, more: answer.total?.relation === "gte" || (!answer.total && answer.hasMore) }
  }
  if (answer.kind === "queryError") return "retry"
  if (answer.kind === "failed") {
    const choices = nameChoices(query, answer.message, answer.candidates, values)
    // Any other refusal is the store's (nothing synced yet, held by another process), not the query's.
    return choices ? { kind: "choose", choices } : { kind: "unchecked", message: answer.message }
  }
  if (answer.kind === "timedOut") return { kind: "unchecked" }
  return { kind: "unchecked", message: answer.message }
}

/** The owner's words again, with only what the parser said about the last query: never a hit or a name it found. */
function retryRequest(request: string, query: string, answer: Extract<SearchAnswer, { kind: "queryError" }>) {
  const said = ` (The query ${query} was refused: ${answer.reason}, ${answer.message}. Write a valid one.)`
  return `${request.slice(0, Math.max(0, MAX_REQUEST - said.length))}${said}`.slice(0, MAX_REQUEST)
}

/** "Describe what you're looking for": the owner's words as the tool's query, written by an agent he set up. */
export function QueryDraft({ tool, example = null, check, values, onNeedTool, onWritten }: Props) {
  const m = useMessages(searchMessages)
  const id = useId()
  const [typed, setRequest] = useState("")
  const [real, setState] = useState<State>({ kind: "idle" })
  // The lists may arrive while the agent writes; the check reads them as they are when its answer comes.
  const known = useRef(values)
  known.current = values
  const request = example ?? typed
  const state: State =
    example === null ? real : { kind: "query", query: "", by: "claude-code", checked: { kind: "unchecked" } }
  const writing = state.kind === "writing" || state.kind === "checking"

  const write = async () => {
    if (writing) return
    if (!tool || !check) return onNeedTool()
    if (!request.trim()) {
      setState({ kind: "empty" })
      focusInPlace(document.getElementById(id))
      return
    }
    setState({ kind: "writing" })
    try {
      let asked = request.trim()
      for (let attempt = 0; attempt < 2; attempt++) {
        const draft = await platform.searchDraft(tool, asked)
        if (draft.kind !== "query") return setState(draft)
        setState({ kind: "checking", by: draft.by })
        const tried = (query: string) =>
          check(query).catch((e: unknown): SearchAnswer => ({ kind: "old", message: errorText(e) }))
        let query = draft.query
        let answer = await tried(query)
        // A tool on an older cli-core refuses part-of-name patterns, and a part inside a word on a large store; its
        // plain values still match part of a name, and a word's start every form of the word.
        const reason = answer.kind === "queryError" ? queryReason(answer.reason) : null
        const plain = reason === "unsupported-operator" || reason === "too-large" ? withoutPatterns(query) : null
        if (plain) {
          query = plain
          answer = await tried(query)
        }
        const checked = checkedBy(query, answer, known.current)
        if (checked === "retry" && answer.kind === "queryError" && attempt === 0) {
          asked = retryRequest(request.trim(), query, answer)
          setState({ kind: "writing" })
          continue
        }
        const final: Checked =
          checked === "retry"
            ? { kind: "refused", message: answer.kind === "queryError" ? answer.message : "" }
            : checked
        setState({ kind: "query", query, by: draft.by, checked: final })
        if (final.kind === "found" || final.kind === "unchecked") onWritten(query)
        return
      }
    } catch (e) {
      setState({ kind: "error", message: errorText(e) })
    }
  }

  const failure = (f: Extract<Draft, { kind: "failed" }>) =>
    f.reason === "signed-out"
      ? m.draft.why["signed-out"](f.by === "codex" ? "codex" : "claude-code")
      : f.reason === "other"
        ? f.message
        : m.draft.why[f.reason]

  const line =
    state.kind === "empty"
      ? { text: m.draft.empty, bad: true }
      : state.kind === "writing"
        ? { text: m.draft.writing, bad: false }
        : state.kind === "checking"
          ? { text: m.draft.checking(m.draft.by[state.by]), bad: false }
          : state.kind === "query"
            ? writtenLine(m, state)
            : state.kind === "failed"
              ? { text: m.draft.failed(m.draft.by[state.by], failure(state)), bad: true }
              : state.kind === "error"
                ? { text: m.draft.error(state.message), bad: true }
                : { text: m.draft.hint, bad: false }

  return (
    <div className="flex flex-col gap-[0.35rem]">
      <label htmlFor={id} className="text-[0.95rem] text-ink-dim">
        {m.draft.label}
      </label>
      <form
        className="flex flex-wrap items-start gap-[0.7rem]"
        onSubmit={(e) => {
          e.preventDefault()
          write()
        }}
      >
        <input
          id={id}
          value={request}
          onChange={(e) => {
            setRequest(e.target.value)
            if (state.kind === "empty") setState({ kind: "idle" })
          }}
          placeholder={m.draft.placeholder}
          autoComplete="off"
          aria-invalid={state.kind === "empty"}
          aria-describedby={`${id}-line`}
          className={`h-[2.8rem] min-w-0 flex-1 basis-[26rem] rounded-[0.4rem] border border-line-strong bg-app px-[0.9rem] text-[1.02rem] text-ink placeholder:text-ink-dim aria-[invalid=true]:border-bad ${fieldFocus}`}
        />
        <Button
          type="submit"
          size="lg"
          className="h-[2.8rem]"
          aria-busy={writing}
          icon={<Sparkles className={cx("size-4", writing && "animate-pulse")} aria-hidden />}
        >
          <StableText value={writing ? m.draft.busy : m.draft.write} variants={[m.draft.write, m.draft.busy]} />
        </Button>
      </form>
      <p
        id={`${id}-line`}
        role={line.bad ? "alert" : "status"}
        className={cx("min-h-[2.7rem] text-[0.9rem]", line.bad ? "text-bad" : "text-ink-dim")}
      >
        {line.text}
      </p>
      <Collapse open={state.kind === "query" && state.checked.kind === "choose"}>
        {state.kind === "query" && state.checked.kind === "choose" && (
          <NameChoiceButtons
            tool={tool}
            choices={state.checked.choices}
            onPick={(c) => {
              const field = state.checked.kind === "choose" ? state.checked.choices.field : "from"
              setState({ ...state, query: c.query, checked: { kind: "unchecked" } })
              onWritten(c.query, c.label ? { field, id: c.value, label: c.label } : undefined)
            }}
          />
        )}
      </Collapse>
      <Collapse open={state.kind === "query" && state.checked.kind === "unchecked" && Boolean(state.checked.message)}>
        {state.kind === "query" && state.checked.kind === "unchecked" && state.checked.message && (
          <ErrorNotice inline tone="warn" raw={state.checked.message}>
            {m.draft.uncheckedHow}
          </ErrorNotice>
        )}
      </Collapse>
      <Collapse open={state.kind === "query" && state.checked.kind === "refused"}>
        {state.kind === "query" && state.checked.kind === "refused" && (
          <ErrorNotice inline raw={`${state.query}\n${state.checked.message}`}>
            {m.draft.refusedHow}
          </ErrorNotice>
        )}
      </Collapse>
      <Collapse open={state.kind === "query" && state.by === "codex"}>
        <p className="text-[0.9rem] text-warn-ink">{m.draft.codexWarning}</p>
      </Collapse>
      <Collapse open={state.kind === "none"}>
        <div className="rounded-[0.45rem] border border-line bg-app px-[1rem] py-[0.8rem] text-[0.92rem]">
          <p className="font-medium text-ink">{m.draft.noneTitle}</p>
          <ol className="mt-[0.4rem] flex list-decimal flex-col gap-[0.25rem] pl-[1.2rem] text-ink-soft">
            {m.draft.ways.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
          <p className="mt-[0.5rem] text-ink-dim">{m.draft.noneMeanwhile}</p>
          <Button size="sm" variant="secondary" className="mt-[0.6rem]" onClick={() => useNav.getState().go("agents")}>
            {m.draft.goAgents}
          </Button>
        </div>
      </Collapse>
    </div>
  )
}

function writtenLine(
  m: (typeof searchMessages)["en"],
  state: Extract<State, { kind: "query" }>,
): { text: string; bad: boolean } {
  const by = m.draft.by[state.by]
  const c = state.checked
  if (c.kind === "found")
    return c.count === 0
      ? { text: m.draft.writtenNone(by), bad: false }
      : { text: m.draft.found(by, c.count, c.more), bad: false }
  if (c.kind === "choose") return { text: m.draft.choose(by, c.choices.field, c.choices.typed), bad: false }
  if (c.kind === "refused") return { text: m.draft.refused(by), bad: true }
  if (c.message) return { text: m.draft.unchecked(by), bad: false }
  return { text: m.draft.written(by), bad: false }
}
