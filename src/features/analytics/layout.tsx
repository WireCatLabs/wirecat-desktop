import type { ComponentType } from "react"
import { useMessages } from "@/i18n"
import { Load, Meetings, OpenTasks, ReplyTime, TaskSources, WaitingOnYou } from "./daily"
import { analyticsMessages } from "./messages"
import { Activity, Helps, Memory, Overview, Panel, People, Projects, StorageBreakdown, Tasks } from "./sections"
import { Attention, WeekTiles } from "./top"
import { Health, WhatChanged, WhenYouTalk } from "./views"

function When() {
  const m = useMessages(analyticsMessages)
  return (
    <Panel id="an-when" title={m.whenTitle} source="stats messages show --by hour">
      <p className="text-[0.9rem] text-ink-soft">{m.whenNote}</p>
      <WhenYouTalk />
    </Panel>
  )
}

function StandsOut() {
  const m = useMessages(analyticsMessages)
  return (
    <Panel id="an-changes" title={m.outliersTitle} source="stats messages show --by sender|chat|day">
      <WhatChanged />
    </Panel>
  )
}

function UpToDate() {
  const m = useMessages(analyticsMessages)
  return (
    <Panel id="an-health" title={m.health} source="runs list · status · store coverage">
      <p className="text-[0.9rem] text-ink-soft">{m.healthNote}</p>
      <Health />
    </Panel>
  )
}

/** Every card the page can show, by a stable id; a card fetches only while it is on screen. */
export const CARDS = {
  reply: ReplyTime,
  waiting: WaitingOnYou,
  load: Load,
  openTasks: OpenTasks,
  when: When,
  standsOut: StandsOut,
  people: People,
  activity: Activity,
  meetings: Meetings,
  tasks: Tasks,
  taskSources: TaskSources,
  projects: Projects,
  memory: Memory,
  helps: Helps,
  kept: Overview,
  breakdown: StorageBreakdown,
  upToDate: UpToDate,
  week: WeekTiles,
  attention: Attention,
} satisfies Record<string, ComponentType>

export type CardId = keyof typeof CARDS

/**
 * The page's order: sections top to bottom, cards in reading order inside each. Moving a section or a card is an edit
 * of this list and nothing else; the owner is choosing between layouts (plan, round 3).
 */
export type Section = { id: string; cards: readonly CardId[]; closed?: boolean }
/** `top` stands above the sections, full width; `tabs` puts the sections behind tabs instead of one under another. */
export type Layout = { top?: readonly CardId[]; sections: readonly Section[]; tabs?: boolean }

export const LAYOUT: readonly Section[] = [
  { id: "today", cards: ["reply", "waiting", "load", "openTasks"] },
  { id: "messages", cards: ["when", "standsOut", "people", "activity"] },
  { id: "meetings", cards: ["meetings"] },
  { id: "work", cards: ["tasks", "taskSources", "projects", "memory"] },
  { id: "agents", cards: ["helps"] },
  { id: "storage", cards: ["kept", "breakdown", "upToDate"] },
]

const AFTER: readonly Section[] = [
  { id: "messages", cards: ["activity", "people", "reply", "waiting", "when", "standsOut"] },
  { id: "tasks", cards: ["openTasks", "taskSources", "tasks", "projects", "memory"] },
  { id: "meetings", cards: ["meetings", "load"] },
  { id: "agents", cards: ["helps"] },
  { id: "archive", cards: ["kept", "breakdown", "upToDate"], closed: true },
]

/**
 * The three orders the owner is choosing between (NEED-256), opened with `?layout=a|b|c`; every card is in each.
 * A: this week first. B: what needs attention first. C: tabs for the week, trends and the archive.
 */
export const LAYOUTS: Record<string, Layout> = {
  current: { sections: LAYOUT },
  a: { top: ["week"], sections: AFTER },
  b: { top: ["attention"], sections: AFTER },
  c: {
    tabs: true,
    sections: [
      { id: "week", cards: ["week", "reply", "waiting", "openTasks", "load", "people", "taskSources", "meetings"] },
      { id: "trends", cards: ["activity", "when", "standsOut", "tasks", "projects", "memory", "helps"] },
      { id: "archive", cards: ["kept", "breakdown", "upToDate"] },
    ],
  },
}

export const chosenLayout = (): Layout =>
  LAYOUTS[new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("layout") ?? ""] ??
  (LAYOUTS.current as Layout)
