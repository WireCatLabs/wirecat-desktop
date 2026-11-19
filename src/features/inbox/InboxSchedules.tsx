import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import { platform } from "@/platform/bridge"
import { AccountTitle } from "@/shared/AccountTitle"
import { errorText } from "@/shared/errors"
import { scheduleEditorMessages } from "@/shared/messages-schedule-editor"
import { useNeed } from "@/shared/needs"
import { profilesQuery } from "@/shared/query"
import { ScheduleEditor } from "@/shared/ScheduleEditor"
import { Button } from "@/ui/Button"
import { Lamp } from "@/ui/Lamp"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { EMAIL, scheduleKey, useInboxSchedule } from "./api"
import { inboxMessages } from "./messages"

const source = () => findTool(EMAIL)?.mailInbox ?? null

/**
 * Mail sorted by the AI model on a timer, one line per mail account, beside the digests' schedules: mail-cli's own
 * `schedule command … -- inbox --yes`. Nothing shows while Email cannot sort mail; the Inbox tab says why.
 */
export function InboxSchedules() {
  const m = useMessages(inboxMessages)
  const gap = useNeed({ anyOf: [EMAIL], minVersion: source()?.minVersion ?? null, signedIn: true })
  const profiles = useQuery({ ...profilesQuery(EMAIL), enabled: gap === null })
  const titleId = useId()
  if (gap || !source() || !profiles.data?.length) return null
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[0.7rem]">
      <SectionTitle id={titleId}>{m.schedulesTitle}</SectionTitle>
      <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">{m.schedulesIntro}</p>
      <ul className="flex flex-col divide-y divide-line rounded-pill border border-line">
        {profiles.data.map((p) => (
          <li key={p.name} className="px-4 py-3">
            <ScheduleLine profile={p.name} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ScheduleLine({ profile }: { profile: string }) {
  const m = useMessages(inboxMessages)
  const duration = useMessages(scheduleEditorMessages).duration
  const client = useQueryClient()
  const schedule = useInboxSchedule(profile)
  const choices = source()?.schedule.choices ?? []
  const [open, setOpen] = useState(false)
  const [every, setEvery] = useState(source()?.schedule.every ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const on = schedule.data?.state === "on" ? schedule.data : null
  const last = on?.last ?? null

  const change = (next: string | null) => {
    setSaving(true)
    setError(null)
    platform.mailInboxScheduleSet(EMAIL, profile, next).then(
      (answer) => {
        client.setQueryData(scheduleKey(profile), answer)
        setSaving(false)
        setOpen(false)
      },
      (e) => {
        setSaving(false)
        setError(errorText(e))
      },
    )
  }

  return (
    <section aria-label={m.scheduleRegion(profile)} className="flex flex-col gap-1">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-[8rem] font-medium text-ink">
          <AccountTitle tool={EMAIL} profile={profile} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[0.875rem] text-ink-dim">
          {schedule.isPending ? (
            <Skeleton chars={24} />
          ) : schedule.isError ? (
            m.scheduleReadFailed
          ) : on ? (
            <>
              <Lamp tone={last ? (last.exitCode === 0 ? "ok" : "bad") : "idle"} size="sm" />
              {on.every ? m.every(duration(on.every)) : m.when(on.when)} ·{" "}
              {last ? (last.exitCode === 0 ? m.lastOk(ago(last.at)) : m.lastFailed(ago(last.at))) : m.noRunYet}
            </>
          ) : null}
        </span>
        {!open && !schedule.isPending && !schedule.isError && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEvery(on?.every ?? source()?.schedule.every ?? choices[0] ?? "")
              setError(null)
              setOpen(true)
            }}
          >
            {on ? m.change : m.setUp}
          </Button>
        )}
      </div>
      <ScheduleEditor
        open={open}
        on={on !== null}
        choices={choices}
        every={every}
        onEvery={setEvery}
        saving={saving}
        error={error}
        onSave={() => change(every)}
        onOff={() => change(null)}
        onCancel={() => setOpen(false)}
        hint={m.scheduleHint}
      />
    </section>
  )
}
