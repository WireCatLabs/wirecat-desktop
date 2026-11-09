import { create } from "zustand"
import { applyChange, type Change } from "@/domain/groups"
import { platform } from "@/platform/bridge"
import type { GroupsRead } from "@/platform/groups-schemas"
import { errorText } from "@/shared/errors"

type Refusal = { change: Change; message: string }

type State = {
  read: GroupsRead | null
  readError: string | null
  /** A change Memo refused: the board is back to what Memo holds, and says why beside it. */
  refused: Refusal | null
  busy: boolean
  /** Groups the owner named that hold no account yet: Memo makes a group with its first account. */
  drafts: string[]
  load(): Promise<void>
  change(change: Change): Promise<boolean>
  draft(name: string): void
  dismiss(): void
}

const send = (c: Change) =>
  c.kind === "add"
    ? platform.groupsAdd(c.group, c.source)
    : c.kind === "remove"
      ? platform.groupsRemove(c.group, c.source)
      : platform.groupsMove(c.source, c.from, c.to)

const names = (read: GroupsRead | null) => (read?.kind === "ready" ? read.groups.map((g) => g.name) : [])

export const useGroups = create<State>()((set, get) => ({
  read: null,
  readError: null,
  refused: null,
  busy: false,
  drafts: [],
  async load() {
    set({ readError: null })
    try {
      set({ read: await platform.groupsRead() })
    } catch (e) {
      set({ readError: errorText(e) })
    }
  },
  async change(change) {
    const before = get().read
    if (before?.kind !== "ready" || get().busy) return false
    // The board shows the change at once and slides back if Memo refuses it, so a drop never waits on a spinner.
    set({ busy: true, refused: null, read: { ...before, groups: applyChange(before.groups, change) } })
    try {
      const read = await send(change)
      set({ read, busy: false, drafts: get().drafts.filter((d) => !names(read).includes(d)) })
      return true
    } catch (e) {
      set({ read: before, busy: false, refused: { change, message: errorText(e) } })
      return false
    }
  },
  draft(name) {
    if (!get().drafts.includes(name)) set({ drafts: [...get().drafts, name] })
  },
  dismiss() {
    set({ refused: null })
  },
}))
