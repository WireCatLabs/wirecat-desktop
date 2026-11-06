import { AlertTriangle } from "lucide-react"
import { useEffect, useRef } from "react"
import { type CatalogTool, findTool, isCommunity, ownerId } from "@/domain/catalog"
import { type Preflight, preflightWarns } from "@/domain/compat"
import { useMessages } from "@/i18n"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { focusInPlace } from "@/ui/motion"
import { preflightMessages } from "./messages-preflight"
import { namesOf } from "./StorageFit"

const nameOf = (id: string) => findTool(id)?.name ?? id
const ours = (id: string) => {
  const tool = findTool(id)
  return Boolean(tool && !isCommunity(tool))
}

/** Asked before an install or update that would leave a tool unable to open the shared store. */
export function PreflightNotice({ tool, preflight }: { tool: CatalogTool; preflight: Preflight | undefined }) {
  const owner = ownerId(tool.id)
  const op = useTools((s) => ((s.installs[owner]?.length ?? 0) > 0 ? "update" : "install"))
  const { proceed, cancel } = useTools.getState()
  const box = useRef<HTMLDivElement>(null)
  const warns = preflightWarns(preflight)
  const m = useMessages(preflightMessages)
  useEffect(() => {
    if (warns) focusInPlace(box.current?.querySelector<HTMLElement>("[data-recommended]") ?? null)
  }, [warns])
  if (!warns) return <p className="text-[0.95rem] text-ink-soft">{m.checking}</p>

  // The notice leaves with the click; focus goes back to the row's own button (Update, or Cancel once it runs).
  const answer = (go: () => void) => {
    const action = box.current?.closest("li")?.querySelector('[data-tour="tool-action"]')
    go()
    requestAnimationFrame(() => focusInPlace(action?.querySelector<HTMLElement>(":not([inert]) > button") ?? null))
  }
  const name = nameOf(owner)
  const fixes = preflight.stops.flatMap((s) => (s.fixedIn ? [s.id] : []))
  return (
    <div
      ref={box}
      role="alert"
      className="reveal w-full rounded-[0.4rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]"
    >
      <p className="flex items-center gap-2 font-medium text-ink">
        <AlertTriangle className="size-5 shrink-0 text-warn-ink" aria-hidden />
        {m.title(op, preflight.version ? `${name} ${preflight.version}` : name)}
      </p>
      {preflight.cannotOpen ? (
        <p className="mt-1.5 max-w-[70ch] text-ink-soft">{m.cannotOpen(name, ours(owner))}</p>
      ) : (
        <>
          <p className="mt-1.5 max-w-[70ch] text-ink-soft">{m.moves(op, name)}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-soft">
            {preflight.stops.map((s) => (
              <li key={s.id}>{s.fixedIn ? m.fixed(nameOf(s.id), s.fixedIn) : m.waits(nameOf(s.id), ours(s.id))}</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant={fixes.length > 0 ? "ghost" : "secondary"}
          data-recommended={fixes.length > 0 ? undefined : true}
          onClick={() => answer(() => cancel(owner))}
        >
          {m.notNow}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => answer(() => proceed(owner))}>
          {m.anyway(op)}
        </Button>
        {fixes.length > 0 && (
          <Button size="sm" variant="primary" data-recommended onClick={() => answer(() => proceed(owner, fixes))}>
            {m.both(op, name, namesOf(fixes))}
          </Button>
        )}
      </div>
    </div>
  )
}
