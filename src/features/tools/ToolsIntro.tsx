import { X } from "lucide-react"
import { useState } from "react"
import { TOOLS_INTRO_KEY } from "@/domain/storage-keys"
import { useMessages } from "@/i18n"
import { openSection } from "@/shared/go-tool"
import { useOnboarding } from "@/shared/onboarding-store"
import { safeStorage } from "@/shared/safe-storage"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { LinkButton } from "@/ui/LinkButton"
import { toolsMessages } from "./messages"

const readHidden = () => safeStorage.getItem(TOOLS_INTRO_KEY) === "hidden"
const writeHidden = () => safeStorage.setItem(TOOLS_INTRO_KEY, "hidden")

/** Static text on the first frame, so the list below never moves; only the action at the right waits for the scan. */
export function ToolsIntro() {
  const [hidden, setHidden] = useState(readHidden)
  const none = useTools((s) => s.checked && !Object.values(s.installs).some((copies) => copies.length > 0))
  const m = useMessages(toolsMessages).intro
  if (hidden && !none) return null
  const em = (text: string) => <span className="font-medium text-ink">{text}</span>
  const link = (text: string) => <LinkButton onClick={() => openSection("agents")}>{text}</LinkButton>
  const steps = [m.install(em), m.signIn(em), m.connect(link)]

  return (
    <section
      aria-label={m.label}
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-inset border border-line bg-app-2/60 px-[1.3rem] py-[1rem]"
    >
      <div className="min-w-0 max-w-[80ch] flex-1">
        <p className="text-[0.95rem] leading-relaxed text-ink">{m.text}</p>
        <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] text-ink-soft">
          {steps.map((step, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: three fixed steps, never reordered
            <li key={n}>
              <span className="mr-1.5 font-mono text-ink-dim">{n + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      {none ? (
        <Button variant="primary" onClick={() => useOnboarding.getState().reopen("choose")}>
          {m.choose}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={m.hide}
          title={m.hide}
          icon={<X className="size-4" aria-hidden />}
          onClick={() => {
            writeHidden()
            setHidden(true)
          }}
        />
      )}
    </section>
  )
}
