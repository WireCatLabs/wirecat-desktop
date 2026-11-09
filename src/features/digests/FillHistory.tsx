import { History, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { formatUsd } from "@/domain/mail-agent"
import { useLang, useMessages } from "@/i18n"
import type { Backfill } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ProgressBar } from "@/ui/ProgressBar"
import { Segmented } from "@/ui/Segmented"
import { scheduleMessages } from "./messages-schedule"
import { backfillRange, useDigestSchedule } from "./schedule-store"
import { useDigests } from "./store"

const SPANS = ["7", "14", "30"] as const
type Span = (typeof SPANS)[number]

type Step =
  | { step: "pricing" }
  | { step: "priced"; days: number; skipped: number; estimateUsd: number | null }
  | { step: "building"; days: number }
  | { step: "done"; built: number; costUsd: number | null }
  | { step: "unsupported" }
  | { step: "failed"; message: string; priced: boolean }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

// One build at a time across the page; the dialog may close while it runs and reopen on its result.
let building: Promise<Backfill> | null = null

/**
 * "Fill history": memo's `digest backfill` for the last 7, 14 or 30 days. The price comes first (the command without
 * `--yes` builds nothing), the build only after the owner confirms that price, and each step stays in this dialog.
 */
export function FillHistory() {
  const m = useMessages(scheduleMessages).history
  const lang = useLang()
  const supported = useDigestSchedule((s) => s.backfill)
  const [open, setOpen] = useState(false)
  const [span, setSpan] = useState<Span>("7")
  const [step, setStep] = useState<Step>({ step: "pricing" })

  const price = (n: Span) => {
    setSpan(n)
    setStep({ step: "pricing" })
    const { from, to } = backfillRange(Number(n))
    platform.digestBackfill(from, to, false).then(
      (b) =>
        setStep(
          b.state === "estimate"
            ? { step: "priced", days: b.days, skipped: b.skipped, estimateUsd: b.estimateUsd }
            : b.state === "unsupported"
              ? { step: "unsupported" }
              : { step: "failed", message: "", priced: false },
        ),
      (e) => setStep({ step: "failed", message: messageOf(e), priced: false }),
    )
  }

  const build = (days: number) => {
    setStep({ step: "building", days })
    const { from, to } = backfillRange(Number(span))
    building ??= platform.digestBackfill(from, to, true)
    building
      .then(
        (b) =>
          setStep(
            b.state === "done"
              ? { step: "done", built: b.built, costUsd: b.costUsd }
              : { step: "failed", message: "", priced: true },
          ),
        (e) => setStep({ step: "failed", message: messageOf(e), priced: true }),
      )
      .finally(() => {
        building = null
        void useDigests.getState().load()
      })
  }

  if (supported === "no")
    return (
      <div className="flex flex-col gap-0.5">
        <Button size="sm" variant="secondary" disabled icon={<History className="size-4" aria-hidden />}>
          {m.fill}
        </Button>
        <p className="text-[0.82rem] text-ink-dim" title={m.needsUpdateHint}>
          {m.needsUpdate}
        </p>
      </div>
    )

  const close = () => setOpen(false)
  const actions =
    step.step === "priced" && step.days > 0 ? (
      <>
        <Button variant="ghost" onClick={close}>
          {m.close}
        </Button>
        <Button variant="primary" onClick={() => build(step.days)}>
          {m.build(step.estimateUsd === null ? null : formatUsd(step.estimateUsd, lang))}
        </Button>
      </>
    ) : (
      <Button variant={step.step === "done" ? "primary" : "ghost"} onClick={close}>
        {m.close}
      </Button>
    )

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={supported === null}
        onClick={() => {
          setOpen(true)
          if (step.step !== "building") price(span)
        }}
        icon={<History className="size-4" aria-hidden />}
      >
        {m.fill}
      </Button>
      <Dialog open={open} title={m.title} onClose={() => setOpen(false)} actions={actions}>
        <div className="flex flex-col gap-3 text-ink-soft">
          <p>{m.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-ink">{m.days}</span>
            <SpanChoice value={span} disabled={step.step === "building"} onChange={price} />
          </div>
          <Body step={step} />
        </div>
      </Dialog>
    </>
  )
}

function SpanChoice({ value, disabled, onChange }: { value: Span; disabled: boolean; onChange: (s: Span) => void }) {
  const m = useMessages(scheduleMessages).history
  return (
    <fieldset disabled={disabled} className="contents">
      <Segmented
        label={m.days}
        value={value}
        onChange={onChange}
        labelClass="inline"
        options={SPANS.map((s) => ({ value: s, label: m.span(Number(s)), icon: null }))}
      />
    </fieldset>
  )
}

function Body({ step }: { step: Step }) {
  const m = useMessages(scheduleMessages).history
  const lang = useLang()
  const usd = (v: number | null) => (v === null ? null : formatUsd(v, lang))
  switch (step.step) {
    case "pricing":
      return (
        <p className="flex items-center gap-2" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> {m.pricing}
        </p>
      )
    case "priced":
      return (
        <div aria-live="polite">
          <p className="font-medium text-ink">{m.estimate(step.days, step.skipped, usd(step.estimateUsd))}</p>
          {step.days > 0 && <p className="mt-1 text-[0.88rem] text-ink-dim">{m.priceNote}</p>}
        </div>
      )
    case "building":
      return (
        <div className="flex flex-col gap-2" aria-live="polite">
          <ProgressBar label={m.building(step.days)} value={null} decorative />
          <p>{m.building(step.days)}</p>
        </div>
      )
    case "done":
      return (
        <p className="font-medium text-ink" aria-live="polite">
          {m.done(step.built, usd(step.costUsd))}
        </p>
      )
    case "unsupported":
      return <p>{m.unsupported}</p>
    case "failed":
      return <ErrorNotice inline>{step.priced ? m.failed(step.message) : m.priceFailed(step.message)}</ErrorNotice>
  }
}
