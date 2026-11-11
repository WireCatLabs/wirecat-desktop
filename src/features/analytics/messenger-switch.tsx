import { useRef, useState } from "react"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { CountRow } from "@/platform/analytics-schemas"
import { Segmented } from "@/ui/Segmented"
import { analyticsMessages } from "./messages"
import { MESSENGERS } from "./store"

/** The messengers with something to show; the owner's own row (`me`) alone is nothing to rank or chart. */
const messengersWith = (bySource: Readonly<Record<string, readonly CountRow[]>>) =>
  MESSENGERS.map((x) => x.id as string).filter((id) => bySource[id]?.some((r) => r.key !== "me" && r.count > 0))

/** One card's messenger: the list keeps its last answer while a new count loads, so the switch does not vanish. */
export function useMessengerChoice(bySource: Readonly<Record<string, readonly CountRow[]>>, loading: boolean) {
  const [chosen, choose] = useState("all")
  const ids = useRef<string[]>([])
  if (!loading) ids.current = messengersWith(bySource)
  return { ids: ids.current, picked: ids.current.includes(chosen) ? chosen : "all", choose }
}

/** One card's own choice of messenger, offered only when there is more than one to choose from. */
export function MessengerSwitch(props: { ids: readonly string[]; value: string; onChange: (id: string) => void }) {
  const m = useMessages(analyticsMessages)
  if (props.ids.length < 2) return null
  return (
    <Segmented
      size="md"
      label={m.messengerLabel}
      value={props.value}
      onChange={props.onChange}
      options={[
        { value: "all", label: m.allMessengers },
        ...props.ids.map((id) => ({ value: id, label: findTool(id)?.name ?? id })),
      ]}
    />
  )
}
