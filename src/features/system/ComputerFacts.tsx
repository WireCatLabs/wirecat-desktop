import { useMessages } from "@/i18n"
import type { ProgramState } from "@/platform/schemas"
import { useSystem } from "@/shared/system-store"
import { Dialog } from "@/ui/Dialog"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { ManagedNode } from "./ManagedNode"
import { systemMessages } from "./messages"

// "24.19.0": the usual length, so the line does not move when real versions replace the placeholders.
const VERSION_CHARS = 7

function Item({ label, program, suffix }: { label: string; program: ProgramState | null; suffix?: string }) {
  const m = useMessages(systemMessages)
  const tone = !program ? "idle" : program.ok ? "ok" : "bad"
  const text = !program ? label : program.version ? `${label} ${program.version}` : m.missing(label)
  return (
    <li className="flex items-center gap-2" title={program?.problem ?? program?.path ?? undefined}>
      <Lamp size="sm" tone={tone} />
      <span className="font-mono">
        {text}
        {!program && (
          <>
            {" "}
            <Skeleton chars={VERSION_CHARS} />
          </>
        )}
      </span>
      {suffix && <span className="text-ink-soft">{suffix}</span>}
    </li>
  )
}

/** Whether Node.js or npm stops tools from installing, so the Help button can say so while its menu is closed. */
export function useComputerTrouble() {
  return useSystem((s) => Boolean(s.readiness && (!s.readiness.node.ok || !s.readiness.npm.ok)))
}

/** The operating system, Node.js and npm, as the Help menu shows them; hover a value to see where it was found. */
export function ComputerFacts({ id }: { id?: string }) {
  const r = useSystem((s) => s.readiness)
  const m = useMessages(systemMessages)
  return (
    <section
      id={id}
      aria-label={m.yourComputer}
      className="flex flex-col gap-[0.45rem] px-[0.7rem] pt-[0.5rem] pb-[0.6rem]"
    >
      <h2 className="text-[0.85rem] font-medium text-ink-dim">{m.yourComputer}</h2>
      <ul className="flex flex-col gap-[0.35rem] text-[0.9rem] whitespace-nowrap text-ink">
        <li className="flex items-center gap-2">
          <Lamp size="sm" tone={r ? "ok" : "idle"} />
          <span className="font-mono">{r ? `${r.os} ${r.arch}` : <Skeleton chars={5} label={m.checking} />}</span>
        </li>
        <Item label="Node.js" program={r?.node ?? null} {...(r?.managed?.active ? { suffix: "(WireCat)" } : {})} />
        <Item label="npm" program={r?.npm ?? null} />
      </ul>
    </section>
  )
}

/** WireCat's own Node.js: where it is and whether terminals find it. Opened from the Help menu. */
export function ManagedNodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMessages(systemMessages)
  return (
    <Dialog open={open} wide title={m.nodeDialog} onClose={onClose}>
      <ManagedNode />
    </Dialog>
  )
}
