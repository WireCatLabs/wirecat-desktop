import { ArrowUpFromLine, ExternalLink, EyeOff, HardDrive, ScrollText } from "lucide-react"
import type { ReactNode } from "react"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { privacyMessages } from "./messages"

export function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMessages(privacyMessages)
  const policy = `https://wirecat.dev/${useLang()}/privacy`
  const sent = [m.sends.news, m.sends.report, m.sends.tools, m.sends.update]

  return (
    <Dialog
      open={open}
      title={m.title}
      onClose={onClose}
      scroll
      actions={
        <Button variant="ghost" data-autofocus onClick={onClose}>
          {m.close}
        </Button>
      }
      footer={
        <button
          type="button"
          title={policy}
          onClick={() => platform.openUrl(policy)}
          className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
        >
          {m.policy}
          <ExternalLink className="size-[0.85em] shrink-0" strokeWidth={1.8} aria-hidden />
        </button>
      }
    >
      <div className="flex flex-col gap-5 pb-3">
        <p className="text-ink">{m.lead}</p>

        <Part icon={HardDrive} title={m.stays.title}>
          <p>{m.stays.text}</p>
        </Part>

        <Part icon={ArrowUpFromLine} title={m.sends.title}>
          <dl className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line bg-app-2">
            {sent.map((s) => (
              <div key={s.name} className="flex flex-col gap-0.5 px-4 py-2.5">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="text-[0.85rem] text-ink-dim">{s.when}</span>
                </dt>
                <dd className="text-[0.9rem]">{s.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[0.9rem] text-ink-dim">{m.sends.others}</p>
        </Part>

        <Part icon={ScrollText} title={m.logs.title}>
          <p>{m.logs.text}</p>
        </Part>

        <Part icon={EyeOff} title={m.never.title}>
          <p>{m.never.text}</p>
        </Part>
      </div>
    </Dialog>
  )
}

function Part({ icon: Icon, title, children }: { icon: typeof HardDrive; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-x-3">
      <Icon className="mt-[0.2rem] size-[1.1rem] text-ink-soft" strokeWidth={1.8} aria-hidden />
      <div className="min-w-0">
        <h3 className="mb-1 text-[0.95rem] font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </section>
  )
}
