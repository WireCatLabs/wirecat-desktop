/**
 * When a schedule runs, from the words memo prints in `schedule list` (cli-core's `describeWhen`): `every 30m`,
 * `every 2h`, `every 1d`, `daily at 09:00`, `once at <ISO time>`. Anything else is kept as written, so a newer form
 * still shows.
 */
export type ScheduleWhen =
  | { kind: "every"; minutes: number }
  | { kind: "daily"; at: string }
  | { kind: "once"; at: string }
  | { kind: "other"; text: string }

const MINUTES = { m: 1, h: 60, d: 1440 } as const

export function parseWhen(text: string): ScheduleWhen {
  const t = text.trim()
  const every = /^every (\d+)([mhd])$/.exec(t)
  if (every) {
    const minutes = Number(every[1]) * MINUTES[every[2] as keyof typeof MINUTES]
    if (minutes > 0) return { kind: "every", minutes }
  }
  const daily = /^daily at (\d{2}:\d{2})$/.exec(t)
  if (daily?.[1]) return { kind: "daily", at: daily[1] }
  const once = /^once at (.+)$/.exec(t)
  if (once?.[1] && !Number.isNaN(Date.parse(once[1]))) return { kind: "once", at: once[1] }
  return { kind: "other", text }
}
