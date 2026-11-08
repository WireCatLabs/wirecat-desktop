import { type Standing, standingTone } from "@/domain/relationships"
import { useMessages } from "@/i18n"
import { Pill } from "@/ui/Pill"
import { standingMessages } from "./messages-standing"

/** A relationship's standing in one word, with what it means on hover; the same chip wherever a relationship shows. */
export function StandingPill({ standing }: { standing: Standing }) {
  const m = useMessages(standingMessages)
  return (
    <span title={m.why[standing]}>
      <Pill tone={standingTone(standing)}>{m.standing[standing]}</Pill>
    </span>
  )
}
