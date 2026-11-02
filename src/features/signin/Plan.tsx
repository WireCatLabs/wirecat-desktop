import { Clock, ShieldCheck } from "lucide-react"
import { useMessages } from "@/i18n"
import { planFor, planMessages } from "./messages-plan"
import { useSignIn } from "./store"

/** Before anything runs: the steps the sign-in will take, how long, and what happens to what the owner shares. */
export function Plan() {
  const { tool, method } = useSignIn()
  const m = useMessages(planMessages)
  const plan = tool ? planFor(m, tool, method) : undefined
  const kept = [...(plan?.kept ?? []), m.wirecat]
  return (
    <div className="flex min-h-[19rem] flex-col gap-5 text-left">
      {plan && (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[1rem] font-semibold text-ink">{m.what}</h3>
          <ol className="flex flex-col gap-2">
            {plan.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[0.1rem] grid size-[1.3rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.8rem] text-brand tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="text-[0.95rem] leading-snug text-ink">{step}</span>
              </li>
            ))}
          </ol>
          {plan.time && (
            <p className="flex items-center gap-3 text-[0.9rem] text-ink-soft">
              <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
              <span>
                <span className="sr-only">{m.time}: </span>
                {plan.time}
              </span>
            </p>
          )}
        </section>
      )}
      <section className="flex flex-col gap-2 border-line border-t pt-4">
        <h3 className="text-[1rem] font-semibold text-ink">{m.kept}</h3>
        <ul className="flex flex-col gap-1.5">
          {kept.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[0.9rem] leading-snug text-ink-soft">
              <ShieldCheck className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ok" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
