import type { ComponentType } from "react"
import { useMessages } from "@/i18n"
import { MeetingDays, Meetings, ReplyTime, TaskSources, WaitingOnYou } from "./daily"
import { analyticsMessages } from "./messages"
import {
  Activity,
  Helps,
  Memory,
  MemoryWeeks,
  Overview,
  Panel,
  People,
  Projects,
  StorageBreakdown,
  Tasks,
} from "./sections"
import { WeekTiles } from "./top"
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
  memoryWeeks: MemoryWeeks,
  meetingDays: MeetingDays,
} satisfies Record<string, ComponentType>

export type CardId = keyof typeof CARDS

/**
 * The page's order: sections top to bottom, cards in reading order inside each. Moving a section or a card is an edit
 * of this list and nothing else; the owner is choosing between layouts (plan, round 3).
 */
export type Section = { id: string; cards: readonly CardId[]; closed?: boolean }

/** Above the sections, across the page: this week against the same days of last week (owner's choice, NEED-256 A). */
export const TOP: readonly CardId[] = ["week"]

/**
 * The page's order: sections top to bottom, cards in reading order inside each. Moving a section or a card is an edit
 * of this list and nothing else.
 */
export const LAYOUT: readonly Section[] = [
  { id: "messages", cards: ["activity", "people", "reply", "waiting", "when", "standsOut"] },
  { id: "meetings", cards: ["meetings", "meetingDays"] },
  { id: "tasks", cards: ["tasks", "taskSources", "projects", "memory", "memoryWeeks"] },
  { id: "agents", cards: ["helps"] },
  { id: "archive", cards: ["kept", "breakdown", "upToDate"], closed: true },
]
