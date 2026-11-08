import { ALL, applyChange, type Change, type Group } from "@/domain/groups"
import type { GroupsRead } from "./groups-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// The groups block's stand-in for memo, with made-up accounts only. `?groups=none` has no saved group, `old` an older
// memo, `missing` no memo. `?groups-fail=read` fails the read; `?groups-fail=write` refuses every change as memo does a
// saved entry that names more than one account.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("groups")
const fail = params.get("groups-fail")

const member = (source: string, profiles: string[]) => ({
  source,
  provider: source.slice(0, source.indexOf(":")),
  profiles,
  alsoIn: [],
})

const TG_HOME = member("telegram:1001", ["tg personal"])
const TG_WORK = member("telegram:1002", ["tg work"])
const MAX = member("max:2001", ["max personal"])
const WA = member("whatsapp:34600000001", ["wa personal"])
const B24 = member("bitrix24:acme.example", ["b24 work"])
const MAIL = member("email:me@work.example", [])

function seed(): Group[] {
  const every = [B24, MAIL, MAX, TG_HOME, TG_WORK, WA]
  if (scenario === "none") return [{ name: ALL, members: every, suggested: [] }]
  const start: Group[] = [
    { name: "work", members: [TG_WORK, MAIL], suggested: [B24.source] },
    { name: "personal", members: [TG_HOME, MAX, WA], suggested: [] },
    { name: ALL, members: every, suggested: [] },
  ]
  // tg work is in both: the duplicate the page highlights.
  return applyChange(start, { kind: "add", group: "personal", source: TG_WORK.source })
}

const REFUSED = "email names more than this account — change the group with config set"

export function groupsMock(): Pick<Platform, "groupsRead" | "groupsAdd" | "groupsRemove" | "groupsMove"> {
  let groups = seed()
  const ready = (): GroupsRead => ({ kind: "ready", groups, unresolved: [] })
  const write = async (change: Change) => {
    await delay(500)
    if (fail === "write") throw new Error(REFUSED)
    groups = applyChange(groups, change)
    return ready()
  }
  return {
    async groupsRead() {
      await delay(600)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.51" }
      if (fail === "read") throw new Error("another process holds the store (store.busy); try again in a minute")
      return ready()
    },
    groupsAdd: (group, source) => write({ kind: "add", group, source }),
    groupsRemove: (group, source) => write({ kind: "remove", group, source }),
    groupsMove: (source, from, to) => write({ kind: "move", source, from, to }),
  }
}
