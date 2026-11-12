import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react"
import { useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { pathFixPhase, pathFixProblem, shellName, shellOptions } from "@/domain/path-fix"
import { FixButton, FixPanel } from "@/features/fix"
import { formatList, type Lang, useLang, useMessages } from "@/i18n"
import type { PathFix } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { agentsMessages } from "./messages"
import { pathFixMessages } from "./messages-path-fix"
import { usePathFix } from "./path-fix"

export function PathFixButton({ tools, label }: { tools: readonly string[]; label?: string }) {
  const m = useMessages(agentsMessages).pathFix
  const fixing = usePathFix((s) => s.status.state === "fixing")
  return (
    <Button size="sm" disabled={fixing} onClick={() => usePathFix.getState().fix(tools)}>
      {fixing ? m.fixing : (label ?? m.fix)}
    </Button>
  )
}

/**
 * What the last Fix changed, and the one thing left for the owner: a restart; when a new terminal still misses the
 * tools, which shell their terminal runs; and when that does not help either, the line to add by hand and why it may
 * not take.
 */
export function PathFixResult({ agent, manual }: { agent: string; manual: string | null }) {
  const m = useMessages(agentsMessages)
  const status = usePathFix((s) => s.status)
  const shown = status.state === "done" || status.state === "failed"
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const windows = usePathFix((s) => s.windows)
  const done = status.state === "done" ? status : null
  const phase = done ? pathFixPhase(done.fix, done.picked, windows) : null
  const files = done ? [...new Set(done.fix.shells.flatMap((s) => s.files))] : []
  return (
    <Collapse open={shown}>
      <div className="flex flex-col gap-2 pt-2">
        {done && phase === "reached" && (
          <p className="flex items-start gap-2 text-[0.9rem] text-ink">
            <CheckCircle2 aria-hidden className="mt-[0.15rem] size-4 shrink-0 text-ok" />
            <span aria-live="polite">
              {done.fix.added.length > 0
                ? m.pathFix.added(done.fix.added.join(", "), files.join(", ") || done.fix.file, agent)
                : m.pathFix.already(agent)}
            </span>
          </p>
        )}
        {done && phase !== "reached" && <StillMissing fix={done.fix} picked={done.picked} />}
        <Collapse open={phase === "pick"}>{done && <ShellPicker />}</Collapse>
        <Collapse open={phase === "hand"}>{done && <ByHand fix={done.fix} />}</Collapse>
        {status.state === "failed" && (
          <>
            <ErrorNotice
              inline
              detail={status.error}
              action={<FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />}
            >
              {m.pathFix.failed}
            </ErrorNotice>
            <FixPanel
              id={fixId}
              open={fixOpen}
              problem={{
                what: "Adding the folders of WireCat tools to the user's PATH",
                error: status.error,
                hint: manual ? `Add this line to the shell's startup file: ${manual}` : null,
              }}
            />
            {manual && (
              <>
                <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.pathFix.manual}</p>
                <CopyField value={manual} label={m.copyCommand} />
              </>
            )}
          </>
        )}
      </div>
    </Collapse>
  )
}

const toolNames = (ids: readonly string[], lang: Lang) =>
  formatList(
    ids.map((id) => findTool(id)?.name ?? id),
    lang,
  )

/** Which tools a new terminal still misses, and what each shell WireCat wrote to answered. */
function StillMissing({ fix, picked }: { fix: PathFix; picked: string | null }) {
  const m = useMessages(pathFixMessages)
  const lang = useLang()
  const names = toolNames(fix.unreachable, lang)
  const chosen = picked && picked !== "hand" ? shellName(picked) : null
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="flex items-start gap-2 text-[0.9rem] text-ink">
        <TriangleAlert aria-hidden className="mt-[0.15rem] size-4 shrink-0 text-warn" />
        <span>{chosen ? m.pickedMisses(chosen, names) : m.stillMissing(names)}</span>
      </p>
      {fix.shells.length > 0 && (
        <>
          <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.shellsLead}</p>
          <ul aria-label={m.shellsLabel} className="flex flex-col gap-2 text-[0.9rem]">
            {fix.shells.map((s) => (
              <li key={s.name} className="flex flex-col">
                <span>
                  <span className="font-medium text-ink">{s.name}</span>
                  {s.primary && <span className="text-ink-dim"> · {m.terminal}</span>}
                  <span className="text-ink-dim"> · </span>
                  <span className={s.finds ? "text-ok" : s.finds === false ? "text-bad" : "text-ink-dim"}>
                    {s.finds ? m.finds : s.finds === false ? m.misses : m.silent}
                  </span>
                </span>
                <code className="selectable font-mono text-[0.85rem] break-all text-ink-soft">
                  {s.files.join(", ")}
                </code>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Asked once a check fails: the terminal may run another shell than the account lists. */
function ShellPicker() {
  const m = useMessages(pathFixMessages)
  const choices = usePathFix((s) => s.shells)
  const status = usePathFix((s) => s.status)
  const checking = status.state === "fixing" ? status.shell : null
  const options = shellOptions(choices?.shells ?? [])
  return (
    <fieldset className="mt-1 flex flex-col gap-2 rounded-inset bg-app-2/60 p-4">
      <legend className="float-left mb-1 p-0 text-[0.95rem] font-medium text-ink">{m.pickTitle}</legend>
      <p className="clear-left max-w-[70ch] text-[0.9rem] text-ink-soft">{m.pickHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        {choices === null && <CircleDashed aria-hidden className="size-4 animate-spin text-ink-dim" />}
        {options.map((program) => (
          <Button
            key={program}
            size="sm"
            disabled={status.state === "fixing"}
            aria-label={`${shellName(program)} (${program})`}
            onClick={() => usePathFix.getState().pickShell(program)}
          >
            {checking === program ? (
              m.checking(shellName(program))
            ) : (
              <>
                {shellName(program)}
                <span className="font-mono text-[0.8rem] text-ink-dim">{program}</span>
              </>
            )}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          disabled={status.state === "fixing"}
          onClick={() => usePathFix.getState().byHand()}
        >
          {m.byHand}
        </Button>
      </div>
    </fieldset>
  )
}

/** The last way left: the exact line and file, how to try it, why it may still fail, and an agent to look. */
function ByHand({ fix }: { fix: PathFix }) {
  const m = useMessages(agentsMessages)
  const p = useMessages(pathFixMessages)
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const windows = usePathFix((s) => s.windows)
  const bins = fix.unreachable.map((id) => findTool(id)?.bin ?? id)
  const first = bins[0] ?? "tg"
  return (
    <div className="mt-1 flex flex-col gap-2">
      {fix.manual && (
        <>
          <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{windows ? p.manualWindows : p.manualTo(fix.file)}</p>
          <CopyField value={fix.manual} label={m.copyCommand} />
        </>
      )}
      <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
        {p.tryIt(<code className="selectable font-mono text-[0.85rem] text-ink">{first} --version</code>)}
      </p>
      {!windows && (
        <>
          <p className="text-[0.9rem] text-ink-soft">{p.whyTitle}</p>
          <ul className="ml-5 flex max-w-[70ch] list-disc flex-col gap-1 text-[0.9rem] text-ink-soft">
            {p.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
      <div>
        <FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />
      </div>
      <FixPanel id={fixId} open={fixOpen} problem={pathFixProblem(fix, bins)} />
    </div>
  )
}
