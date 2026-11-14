import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  type DaySegment,
  daySpan,
  isDayLong,
  layoutDay,
  layoutWeekRow,
  localInstant,
  type MeetingTime,
  monthWindow,
  type Placed,
  placeWindow,
  realMinutes,
  splitByDay,
  timeOf,
  weekWindow,
} from "./meeting-layout"

// Node reads a new TZ on assignment; the owner's zone has both DST turns the design names.
let zone: string | undefined
beforeAll(() => {
  zone = process.env.TZ
  process.env.TZ = "Europe/Madrid"
})
afterAll(() => {
  process.env.TZ = zone
})

const MIN = 22.5
const seg = (key: string, startMin: number, endMin: number): DaySegment => ({
  key,
  startMin,
  endMin,
  fromBefore: false,
  goesOn: false,
})
const h = (hours: number) => hours * 60
/** `n` blocks fit side by side, and a covered one keeps as much. */
const cols = (n: number) => ({ block: 1 / n, indent: 1 / n })
const events = (placed: Placed[]) => placed.filter((p) => p.type === "event")
const more = (placed: Placed[]) => placed.filter((p) => p.type === "more")
const at = (s: string) => new Date(s)
const meeting = (key: string, start: string, end: string, allDay = false): MeetingTime => ({
  key,
  start: at(start),
  end: at(end),
  allDay,
})

describe("layoutDay", () => {
  it("gives meetings that do not overlap the whole width", () => {
    const placed = layoutDay([seg("a", h(9), h(10)), seg("b", h(11), h(12))], cols(4), MIN)
    expect(placed.map((p) => [p.left, p.width])).toEqual([
      [0, 1],
      [0, 1],
    ])
  })

  it("puts meetings that start together side by side, and touching ones one after another", () => {
    expect(layoutDay([seg("a", h(9), h(10)), seg("b", h(9), h(11))], cols(4), MIN).map((p) => p.width)).toEqual([
      0.5, 0.5,
    ])
    expect(layoutDay([seg("a", h(9), h(10)), seg("b", h(9.25), h(11))], cols(4), MIN).map((p) => p.width)).toEqual([
      0.5, 0.5,
    ])
    expect(layoutDay([seg("a", h(10), h(11)), seg("b", h(11), h(12))], cols(4), MIN).map((p) => p.width)).toEqual([
      1, 1,
    ])
  })

  it("draws a later meeting over an earlier one, shifted right, as Google Calendar does", () => {
    const placed = layoutDay([seg("a", h(9), h(11)), seg("b", h(9.5), h(10.5)), seg("c", h(10), h(12))], cols(4), MIN)
    expect(placed.map((p) => [p.type === "event" && p.key, p.left, p.width])).toEqual([
      ["a", 0, 1],
      ["b", 0.25, 0.75],
      ["c", 0.5, 0.5],
    ])
  })

  it("judges overlap by the drawn height, so two short calls a minute apart never cover each other", () => {
    const placed = layoutDay([seg("a", h(10), h(10) + 3), seg("b", h(10) + 4, h(10) + 7)], cols(4), MIN)
    expect(placed.map((p) => p.left)).toEqual([0, 0.5])
    expect(placed[0]?.endMin).toBe(h(10) + MIN)
  })

  it("lays a later meeting over the widest free span, past the left strip of each one it covers", () => {
    const placed = layoutDay([seg("a", h(9), h(10)), seg("b", h(9.5), h(11)), seg("c", h(10), h(12))], cols(4), MIN)
    expect(placed.map((p) => [p.type === "event" && p.key, p.left, p.width])).toEqual([
      ["a", 0, 1],
      ["b", 0.25, 0.75],
      ["c", 0.5, 0.5],
    ])
  })

  it("shows five at once where they fit: two that start together, one over them, two more beside it", () => {
    const placed = layoutDay(
      [
        seg("sprint", h(13), h(15)),
        seg("demo", h(13), h(14)),
        seg("interview", h(13.5), h(14.5)),
        seg("ops", h(14), h(15)),
        seg("coffee", h(14.25), h(14.75)),
      ],
      cols(4),
      MIN,
    )
    expect(more(placed)).toEqual([])
    expect(events(placed).map((p) => [p.key, p.left, p.width])).toEqual([
      ["sprint", 0, 0.5],
      ["demo", 0.5, 0.5],
      ["interview", 0.25, 0.25],
      ["ops", 0.5, 0.25],
      ["coffee", 0.75, 0.25],
    ])
  })

  it("caps five meetings at one time by the width: 80 % and +4, half and +4, or three and +2", () => {
    const five = ["a", "b", "c", "d", "e"].map((k) => seg(k, h(10), h(11)))
    const one = layoutDay(five, cols(1), MIN)
    expect(events(one).map((p) => [p.key, p.left, p.width])).toEqual([["a", 0, 0.8]])
    expect(more(one).map((p) => [p.keys.length, p.left, p.width])).toEqual([[4, 0.8, 0.2]])

    const two = layoutDay(five, cols(2), MIN)
    expect(events(two).map((p) => [p.key, p.width])).toEqual([["a", 0.5]])
    expect(more(two).map((p) => [p.keys.length, p.left])).toEqual([[4, 0.5]])

    const four = layoutDay(five, cols(4), MIN)
    expect(events(four).map((p) => p.key)).toEqual(["a", "b", "c"])
    expect(more(four).map((p) => [p.keys.length, p.left, p.width])).toEqual([[2, 0.75, 0.25]])
  })

  it("marks a meeting with no readable span by a +N at its own time, not one that starts later", () => {
    const placed = layoutDay(
      [
        seg("sprint", h(13), h(15)),
        seg("demo", h(13), h(14)),
        seg("interview", h(13.5), h(14.5)),
        seg("ops", h(14), h(15)),
        seg("coffee", h(14.25), h(14.75)),
      ],
      { block: 0.5, indent: 0.12 },
      MIN,
    )
    expect(events(placed).map((p) => p.key)).toEqual(["sprint", "demo", "ops"])
    expect(more(placed).map((p) => [p.keys, p.startMin])).toEqual([
      [["interview"], h(13.5)],
      [["coffee"], h(14.25)],
    ])
  })

  it("leaves every block and +N its title line and left strip, and gives the same picture twice", () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647
      return seed / 2_147_483_647
    }
    const many = Array.from({ length: 200 }, (_, i) => {
      const start = Math.floor(random() * 1_380)
      return seg(`m${i}`, start, start + 5 + Math.floor(random() * 120))
    })
    const overlaps = (p: Placed, q: Placed) => p.startMin < q.endMin && q.startMin < p.endMin
    const covers = (p: Placed, x: number, y: number) =>
      p.left - 1e-9 < x && x < p.left + p.width + 1e-9 && p.startMin <= y && y < p.endMin
    for (const cap of [1, 2, 4]) {
      const placed = layoutDay(many, cols(cap), MIN)
      expect(layoutDay([...many].reverse(), cols(cap), MIN)).toEqual(placed)
      placed.forEach((a, i) => {
        // The block's first line at its left edge, against everything drawn after it.
        const x = a.left + 0.01
        const y = a.startMin + MIN / 2
        for (const b of placed.slice(i + 1)) {
          expect(covers(b, x, y)).toBe(false)
          // A later block over this one starts past its left strip.
          if (b.type === "event" && overlaps(a, b) && b.left < a.left + a.width - 1e-9 && a.left < b.left + b.width)
            expect(b.left).toBeGreaterThanOrEqual(a.left + 1 / cap - 1e-9)
        }
      })
    }
  })

  it("keeps up to four at once on screen, and counts the rest in one +N", () => {
    const five = ["a", "b", "c", "d", "e"].map((k, i) => seg(k, h(10) + i * 15, h(12)))
    const placed = layoutDay(five, cols(4), MIN)
    expect(events(placed).map((p) => p.key)).toEqual(["a", "b", "c"])
    expect(more(placed).map((p) => [p.keys, p.left])).toEqual([[["d", "e"], 0.75]])
    expect(events(placed).every((p) => p.left + p.width <= 0.75 + 1e-9)).toBe(true)
  })
})

describe("windows", () => {
  it("starts a week on the language's first day and a month on the week holding its 1st, six weeks long", () => {
    expect(weekWindow("2026-11-13", 1).days).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ])
    expect(weekWindow("2026-11-13", 0).days[0]).toBe("2026-11-08")
    const month = monthWindow("2026-11-13", 1)
    expect([month.days[0], month.days.length, month.days.at(-1)]).toEqual(["2026-10-26", 42, "2026-12-06"])
  })

  it("crosses a year end", () => {
    expect(weekWindow("2027-01-01", 1).days.slice(0, 4)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
    ])
    expect(monthWindow("2027-01-15", 1).days[0]).toBe("2026-12-28")
  })

  it("ends a DST week at local midnight, 167 or 169 hours later, and names its ends with their offset", () => {
    const spring = weekWindow("2027-03-28", 1)
    expect((spring.to.getTime() - spring.from.getTime()) / 3_600_000).toBe(167)
    expect([localInstant(spring.from), localInstant(spring.to)]).toEqual([
      "2027-03-22T00:00:00+01:00",
      "2027-03-29T00:00:00+02:00",
    ])
    const autumn = weekWindow("2027-10-31", 1)
    expect((autumn.to.getTime() - autumn.from.getTime()) / 3_600_000).toBe(169)
  })
})

describe("splitByDay", () => {
  const week = weekWindow("2026-11-13", 1).days

  it("cuts a meeting at midnight into two segments of one meeting", () => {
    const parts = splitByDay(meeting("late", "2026-11-12T22:00:00+01:00", "2026-11-13T01:30:00+01:00"), week)
    expect([...parts.entries()].map(([d, s]) => [d, s.startMin, s.endMin, s.fromBefore, s.goesOn])).toEqual([
      ["2026-11-12", h(22), 1_440, false, true],
      ["2026-11-13", 0, 90, true, false],
    ])
  })

  it("draws 01:30–03:30 on the spring-forward day from line to line, and says it lasted one hour", () => {
    const m = meeting("spring", "2027-03-28T01:30:00+01:00", "2027-03-28T03:30:00+02:00")
    const part = splitByDay(m, weekWindow("2027-03-28", 1).days).get("2027-03-28")
    expect([part?.startMin, part?.endMin, realMinutes(m)]).toEqual([90, 210, 60])
  })

  it("draws the fall-back day's repeated hour without turning a block upside down", () => {
    const days = weekWindow("2027-10-31", 1).days
    const twice = meeting("twice", "2027-10-31T01:30:00+02:00", "2027-10-31T02:30:00+01:00")
    const part = splitByDay(twice, days).get("2027-10-31")
    expect([part?.startMin, part?.endMin, realMinutes(twice)]).toEqual([90, 150, 120])

    const back = meeting("back", "2027-10-31T02:40:00+02:00", "2027-10-31T02:10:00+01:00")
    const drawn = splitByDay(back, days).get("2027-10-31")
    expect([drawn?.startMin, drawn?.endMin]).toEqual([160, 190])
  })
})

describe("the all-day row", () => {
  const week = weekWindow("2026-11-13", 1).days

  it("files a timed meeting under days only when it covers a whole local day", () => {
    expect(isDayLong(meeting("a", "2026-11-12T09:00:00+01:00", "2026-11-14T09:00:00+01:00"))).toBe(true)
    expect(isDayLong(meeting("b", "2026-11-12T09:00:00+01:00", "2026-11-13T09:00:00+01:00"))).toBe(false)
    expect(isDayLong(meeting("c", "2026-11-13T00:00:00+01:00", "2026-11-14T00:00:00+01:00"))).toBe(true)
  })

  it("reads an all-day end as exclusive, and clips a span to the row", () => {
    const one = meeting("one", "2026-11-13T00:00:00+01:00", "2026-11-14T00:00:00+01:00", true)
    expect(daySpan(one, week)).toEqual({ key: "one", from: 4, to: 4, fromBefore: false, goesOn: false })
    const long = meeting("long", "2026-11-05T00:00:00+01:00", "2026-11-20T00:00:00+01:00", true)
    expect(daySpan(long, week)).toEqual({ key: "long", from: 0, to: 6, fromBefore: true, goesOn: true })
  })

  it("packs spans in lanes and counts a hidden lane on every day it covers", () => {
    const spans = [
      { key: "a", from: 0, to: 2, fromBefore: false, goesOn: false },
      { key: "b", from: 1, to: 4, fromBefore: false, goesOn: false },
      { key: "c", from: 2, to: 3, fromBefore: false, goesOn: false },
      { key: "d", from: 3, to: 6, fromBefore: false, goesOn: false },
    ]
    const { lanes, hidden } = layoutWeekRow(spans, 2)
    expect(lanes.map((l) => [l.key, l.lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["d", 0],
    ])
    expect(hidden).toEqual([0, 0, 1, 1, 0, 0, 0])
  })
})

describe("timeOf and placeWindow", () => {
  const week = weekWindow("2026-11-13", 1).days

  it("reads an all-day day as the computer's midnight, and a missing end from the duration", () => {
    const day = timeOf({ ref: "e", startedAt: "2026-11-13", endedAt: "2026-11-14", durationMs: null, allDay: true })
    expect(day?.start.getHours()).toBe(0)
    expect(day && daySpan(day, week)).toMatchObject({ from: 4, to: 4 })
    const call = timeOf({
      ref: "c",
      startedAt: "2026-11-12T10:00:00+01:00",
      endedAt: null,
      durationMs: 42 * 60_000,
      allDay: false,
    })
    expect(call && realMinutes(call)).toBe(42)
    expect(timeOf({ ref: "x", startedAt: null, endedAt: null, durationMs: null, allDay: false })).toBeNull()
  })

  it("puts timed meetings in their days and day-long ones in the row", () => {
    const times = [
      meeting("a", "2026-11-12T10:00:00+01:00", "2026-11-12T11:00:00+01:00"),
      meeting("b", "2026-11-12T00:00:00+01:00", "2026-11-14T00:00:00+01:00", true),
    ]
    const { segments, rows } = placeWindow(times, week)
    expect(segments.get("2026-11-12")?.map((s) => s.key)).toEqual(["a"])
    expect(rows[0]?.map((s) => [s.key, s.from, s.to])).toEqual([["b", 3, 4]])
  })
})
