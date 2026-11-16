import { formatDate, useLang, useMessages } from "@/i18n"
import type { MatchSide } from "@/platform/people-schemas"
import { SourceIcon } from "@/shared/SourceIcon"
import { sideMessages } from "./messages-sides"

/** What a side of a match last said and where they work, so the owner can tell two people apart at a glance. */
export function SideContext({ side }: { side: MatchSide | undefined }) {
  const m = useMessages(sideMessages)
  const lang = useLang()
  if (!side) return null
  const business = [
    side.organizations.length > 0 && `${m.companies(side.organizations.length)}: ${side.organizations.join(", ")}`,
    side.deals.length > 0 && `${m.deals(side.deals.length)}: ${side.deals.join(", ")}`,
  ].filter(Boolean)
  return (
    <>
      {business.length > 0 && <p className="selectable text-[0.88rem] text-ink-soft">{business.join(" · ")}</p>}
      {side.last.length > 0 && (
        <ul aria-label={m.lastTouches} className="flex flex-col gap-[0.35rem] border-line border-t pt-[0.45rem]">
          {side.last.map((touch) => (
            <li key={`${touch.at}${touch.source}`} className="flex min-w-0 flex-col gap-[0.1rem] text-[0.88rem]">
              <span className="flex items-center gap-[0.4rem] text-[0.8rem] text-ink-dim tabular-nums">
                <SourceIcon provider={touch.source} className="text-ink-soft" labelled />
                {formatDate(touch.at, { dateStyle: "medium" }, lang)}
                {m.touchKinds[touch.kind] && <span>· {m.touchKinds[touch.kind]}</span>}
              </span>
              <span className="selectable line-clamp-2 break-words text-ink">
                {touch.from_me && <span className="text-ink-soft">{m.fromMe}: </span>}
                {touch.text ?? <span className="text-ink-dim">{m.noText}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
