import { useMessages } from "@/i18n"
import { sharedMessages } from "@/shared/messages"
import { Pill } from "@/ui/Pill"

/** Marks the tour's example rows as not the owner's; on the right, clear of the tour's panel. */
export function DemoNote() {
  const m = useMessages(sharedMessages).demo
  return (
    <p
      role="note"
      aria-label={m.label}
      className="reveal flex max-w-full flex-wrap items-center gap-[0.6rem] self-end rounded-rack border border-brand/40 border-dashed bg-brand-soft/40 px-[1.1rem] py-[0.7rem] text-[0.95rem] text-ink-soft"
    >
      <Pill tone="brand">{m.label}</Pill>
      {m.text}
    </p>
  )
}
