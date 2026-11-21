import { costText } from "@/domain/inbox"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { accountTitle, useAccountNames } from "@/shared/account-names-store"
import { goAiModel } from "@/shared/go-ai-model"
import { openTool } from "@/shared/go-tool"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { EMAIL } from "./api"
import { type InboxText, inboxMessages } from "./messages"
import { type RunState, useInbox } from "./store"

/** Memo asking first is a question for the owner, not a failure. */
const asks = (state: RunState) => state.phase === "failed" && state.refusal === "ask"

const TONE: Record<RunState["phase"], LampTone> = { waiting: "idle", running: "doing", done: "ok", failed: "bad" }

/** What the refusal asks the owner to do, where the page can take him there. */
function Fix(props: { state: RunState; profile: string; sorting: boolean; m: InboxText }) {
  const { state, profile, sorting, m } = props
  if (state.phase !== "failed") return null
  switch (state.refusal) {
    case "ask":
      return (
        <Button size="sm" variant="primary" disabled={sorting} onClick={() => void useInbox.getState().send(profile)}>
          {m.send}
        </Button>
      )
    case "noModel":
    case "noKey":
    case "localOnly":
    case "denied":
      return (
        <Button size="sm" variant="ghost" onClick={goAiModel}>
          {m.goAiModel}
        </Button>
      )
    case "notSynced":
    case "old":
      return (
        <Button size="sm" variant="ghost" onClick={() => openTool(EMAIL)}>
          {m.goTools}
        </Button>
      )
    default:
      return null
  }
}

function words(state: RunState, m: InboxText, lang: string) {
  switch (state.phase) {
    case "waiting":
      return m.waiting
    case "running":
      return m.running
    case "done": {
      const { listed, model, costUsd } = state.run
      return [m.done(listed), model, costUsd == null ? null : costText(costUsd, lang)].filter(Boolean).join(" · ")
    }
    case "failed":
      return m.refusal[state.refusal]
  }
}

/** The last Sort now, one line per account: its turn, then what it sorted or why the tool refused, with the fix. */
export function SortRuns() {
  const m = useMessages(inboxMessages)
  const lang = useLang()
  const runs = useInbox((s) => s.runs)
  const sorting = useInbox((s) => s.sorting)
  const names = useAccountNames((s) => s.names)
  return (
    <Collapse open={runs.length > 0}>
      <section aria-label={m.progress} className="flex flex-col gap-[0.6rem] rounded-pill border border-line px-4 py-3">
        <ul className="flex flex-col gap-[0.5rem]">
          {runs.map(({ profile, state }) => (
            <li key={profile} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Lamp tone={asks(state) ? "warn" : TONE[state.phase]} size="sm" />
                <span className="font-medium text-ink">{accountTitle(names, EMAIL, profile)}</span>
                <span
                  aria-live="polite"
                  className={asks(state) ? "text-ink" : state.phase === "failed" ? "text-bad" : "text-ink-soft"}
                >
                  {words(state, m, lang)}
                </span>
                <Fix state={state} profile={profile} sorting={sorting} m={m} />
              </div>
              {state.phase === "failed" && (
                <div className="pl-5 text-[0.9rem] text-ink-soft">
                  {/* For "ask", what the tool would send and where, in the owner's language when the tool said it in numbers. */}
                  {state.refusal === "ask" ? (
                    <p className="selectable">
                      {state.ask
                        ? m.ask({
                            ...state.ask,
                            tokens: formatNumber(state.ask.tokens, lang),
                            cost:
                              state.ask.estimatedCostUsd == null ? null : costText(state.ask.estimatedCostUsd, lang),
                          })
                        : state.message}
                    </p>
                  ) : (
                    <Disclosure summary={m.details}>
                      <p className="selectable">{state.message}</p>
                    </Disclosure>
                  )}
                </div>
              )}
              {state.phase === "done" && state.run.notes.length > 0 && (
                <ul className="pl-5 text-[0.9rem] text-ink-soft">
                  {state.run.notes.map((note) => (
                    <li key={note} className="selectable">
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Collapse>
  )
}
