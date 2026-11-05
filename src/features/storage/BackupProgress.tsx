import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { ProgressBar } from "@/ui/ProgressBar"
import { type Progress, percent } from "./backup-store"
import { backupMessages } from "./messages-backup"

export function BackupProgress({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const m = useMessages(backupMessages)
  const pct = percent(progress)
  // The tool seals in one run and prints nothing until it ends, so there is no share done to show.
  const unknown = progress.step === "encrypting"
  return (
    <div className="flex items-center gap-4">
      <span className="min-w-[10.5rem] shrink-0 text-[0.9rem] text-ink-soft">{m.step[progress.step]}…</span>
      <ProgressBar
        label={m.step[progress.step]}
        value={unknown ? null : pct}
        unknown="pulse"
        pace="fast"
        className="flex-1"
      />
      <span className="w-[3rem] shrink-0 text-right font-mono text-[0.875rem] tabular-nums text-ink-soft">
        {unknown ? "" : `${pct}%`}
      </span>
      {/* Stopping the tool mid-seal leaves its plain copy of the whole store beside it, so sealing runs to the end. */}
      {unknown ? (
        <span className="min-w-[4.6rem] shrink-0 text-right text-[0.85rem] text-ink-dim">{m.cantStop}</span>
      ) : (
        <Button variant="ghost" size="sm" className="min-w-[4.6rem]" onClick={onCancel}>
          {m.cancel}
        </Button>
      )}
    </div>
  )
}
