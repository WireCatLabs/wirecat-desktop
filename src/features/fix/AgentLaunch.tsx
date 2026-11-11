import { SquareTerminal } from "lucide-react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { useMessages } from "@/i18n"
import { AgentIcon } from "@/shared/AgentIcon"
import { safeStorage } from "@/shared/safe-storage"
import { SplitButton } from "@/ui/SplitButton"
import { fixMessages } from "./messages"
import { type Launchable, useLaunchable } from "./run-agent"

type Choice = { id: string | null; set(id: string): void }

/** The agent the owner last opened a prompt in, kept on this computer. */
export const useAgentChoice = create<Choice>()(
  persist((set) => ({ id: null, set: (id) => set({ id }) }), {
    name: "wirecat.agent-choice",
    storage: createJSONStorage(() => safeStorage),
    partialize: (s) => ({ id: s.id }),
  }),
)

type Props = {
  /** "Open in Claude Code": the main button's words for the chosen agent. */
  label: (name: string) => string
  /** The words while `opening` is the agent being started. */
  openingLabel: string
  opening: string | null
  onOpen: (agent: Launchable) => void
  /** Looks for agents only once true, as a panel that opens later wants. */
  enabled?: boolean
}

/**
 * One button for every agent WireCat can start: it opens the one last used, or the first found, and its menu lists
 * them all. An agent not found stays in the menu; picking it tells how to install it.
 */
export function AgentLaunch({ label, openingLabel, opening, onOpen, enabled = true }: Props) {
  const m = useMessages(fixMessages)
  const agents = useLaunchable(enabled)
  const remembered = useAgentChoice((s) => s.id)
  if (!agents?.length) return null
  const found = agents.filter((a) => a.found)
  const main = found.find((a) => a.id === remembered) ?? found[0]
  const pick = (a: Launchable) => {
    if (a.found) useAgentChoice.getState().set(a.id)
    onOpen(a)
  }
  return (
    <SplitButton
      {...(main
        ? {
            main: {
              label: opening === main.id ? openingLabel : label(main.name),
              onClick: () => pick(main),
              icon: <SquareTerminal className="size-4 text-ink-dim" aria-hidden />,
              disabled: opening !== null,
            },
          }
        : {})}
      items={agents.map((a) => ({
        label: a.name,
        icon: <AgentIcon id={a.id} className="size-4 shrink-0 text-ink-soft" />,
        ...(a.found ? {} : { note: m.notInstalled }),
        onSelect: () => pick(a),
      }))}
      menuLabel={m.pick}
      moreLabel={m.openInAgent}
    />
  )
}
