import { type RefObject, useEffect, useRef } from "react"
import { useLang, useMessages } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { showMeeting } from "@/shared/meeting-open"
import { DatePopover } from "@/ui/Calendar"
import { meetingLabel } from "./label"
import { MeetingLine } from "./MeetingChip"
import { meetingMessages } from "./messages"

/** Every meeting of one day, from a "+N": the calendar popover's frame, each line opening its meeting. */
export function DayList({
  day,
  meetings,
  anchor,
  onClose,
}: {
  day: string | null
  meetings: readonly MeetingRow[]
  anchor: RefObject<HTMLElement | null>
  onClose: (refocus: boolean) => void
}) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (day) list.current?.querySelector("button")?.focus()
  }, [day])
  const name = day
    ? new Date(`${day}T12:00:00`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })
    : ""
  return (
    <DatePopover open={day !== null} anchor={anchor} onClose={onClose} label={m.moreOn(name)}>
      <p className="px-[0.3rem] font-medium text-[0.9rem]">{name}</p>
      <ul ref={list} className="flex min-w-[16rem] max-w-[22rem] flex-col">
        {meetings.map((meeting) => (
          <li key={meeting.ref}>
            <button
              type="button"
              aria-label={meetingLabel(meeting, m, lang)}
              onClick={() => {
                // Back on the "+N" first, so the meeting's dialog returns focus there and not to a line that is gone.
                onClose(true)
                showMeeting(meeting.ref, meeting.title)
              }}
              className="w-full cursor-pointer rounded-control px-[0.3rem] text-left hover:bg-app-2"
            >
              <MeetingLine meeting={meeting} />
            </button>
          </li>
        ))}
      </ul>
    </DatePopover>
  )
}
