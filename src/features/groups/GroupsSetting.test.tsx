import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { ALL, type Group } from "@/domain/groups"
import { platform } from "@/platform/bridge"
import type { GroupsRead } from "@/platform/groups-schemas"
import { render, screen, within } from "@/testing/render"
import { GroupsSetting } from "./GroupsSetting"

afterEach(() => vi.restoreAllMocks())

const tgWork = {
  source: "telegram:2",
  provider: "telegram",
  profiles: ["tg work"],
  alsoIn: ["personal"],
  scope: "work",
}
const tgHome = { source: "telegram:1", provider: "telegram", profiles: ["tg personal"], alsoIn: [], scope: "personal" }
const mail = { source: "email:me@work.example", provider: "email", profiles: [], alsoIn: [], scope: "work" }

const groups: Group[] = [
  { name: "work", members: [tgWork], suggested: [] },
  { name: "personal", members: [tgHome, { ...tgWork, alsoIn: ["work"] }], suggested: [] },
  {
    name: ALL,
    members: [mail, { ...tgHome, alsoIn: ["personal"] }, { ...tgWork, alsoIn: ["work", "personal"] }],
    suggested: [],
  },
]
const ready: GroupsRead = { kind: "ready", groups, unresolved: [] }

const column = (name: RegExp) => within(screen.getByRole("region", { name }))

it("shows all first, every saved group, and the account that is in two of them", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue(ready)
  render(<GroupsSetting />)
  const regions = await screen.findAllByRole("region", { name: /accounts$/ })
  expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual([
    "All, 3 accounts",
    "work, 1 accounts",
    "personal, 2 accounts",
  ])
  expect(column(/^work/).getByText("Also in personal")).toBeInTheDocument()
  expect(column(/^All/).getByText("email:me@work.example")).toBeInTheDocument()
  expect(column(/^All/).queryByText(/^Also in/)).toBeNull()
})

it("moves an account from the keyboard, and puts it back with Memo's reason when Memo refuses", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue(ready)
  const move = vi.spyOn(platform, "groupsMove").mockRejectedValue(new Error("email names more than this account"))
  render(<GroupsSetting />)
  await screen.findByRole("region", { name: /^personal/ })
  await userEvent.click(column(/^personal/).getByRole("combobox", { name: "Groups for tg personal" }))
  await userEvent.click(screen.getByRole("option", { name: "Move to work" }))
  expect(move).toHaveBeenCalledWith("telegram:1", "personal", "work")
  expect(await screen.findByText(/Memo did not change the groups: email names more/)).toBeInTheDocument()
  expect(column(/^personal/).getByText("tg personal")).toBeInTheDocument()
  expect(column(/^work/).queryByText("tg personal")).toBeNull()
})

it("adds from all, never takes from it, and makes a new group with its first account", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue(ready)
  const add = vi.spyOn(platform, "groupsAdd").mockImplementation(async (group, source) => ({
    ...ready,
    groups: [{ name: group, members: [{ ...mail, source }], suggested: [] }, ...groups],
  }))
  render(<GroupsSetting />)
  await userEvent.type(await screen.findByRole("textbox", { name: "New group" }), "clients")
  await userEvent.click(screen.getByRole("button", { name: "Create" }))
  await userEvent.click(column(/^All/).getByRole("combobox", { name: "Groups for email:me@work.example" }))
  expect(screen.queryByRole("option", { name: /^Move to/ })).toBeNull()
  await userEvent.click(screen.getByRole("option", { name: "Add to clients" }))
  expect(add).toHaveBeenCalledWith("clients", "email:me@work.example")
  expect(await column(/^clients/).findByText("email:me@work.example")).toBeInTheDocument()
})

it("refuses a group name Memo would refuse before asking it", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue(ready)
  render(<GroupsSetting />)
  await userEvent.type(await screen.findByRole("textbox", { name: "New group" }), "all")
  await userEvent.click(screen.getByRole("button", { name: "Create" }))
  expect(screen.getByText("All and bots already mean something to Memo.")).toBeInTheDocument()
})

it("says the groups arrive with the next update on an older memo", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue({ kind: "old", version: "0.131.51" })
  render(<GroupsSetting />)
  expect(await screen.findByText(/Memo 0.131.51 has no account groups yet/)).toBeInTheDocument()
})

it("puts an account on the work side from all", async () => {
  vi.spyOn(platform, "groupsRead").mockResolvedValue(ready)
  const scope = vi.spyOn(platform, "groupsScope").mockResolvedValue(ready)
  render(<GroupsSetting />)
  await screen.findByRole("region", { name: /^All/ })
  const switches = column(/^All/).getAllByRole("group", { name: /^Personal or work/ })
  expect(switches).toHaveLength(3)
  expect(column(/^work/).queryByRole("group", { name: /^Personal or work/ })).toBeNull()
  await userEvent.click(column(/^All/).getByRole("radio", { name: "Work", checked: false }))
  expect(scope).toHaveBeenCalledWith("telegram:1", "work")
})

it("shows no personal or work switch on a memo before account scopes", async () => {
  const old = groups.map((g) => ({ ...g, members: g.members.map((x) => ({ ...x, scope: null })) }))
  vi.spyOn(platform, "groupsRead").mockResolvedValue({ ...ready, groups: old })
  render(<GroupsSetting />)
  await screen.findByRole("region", { name: /^All/ })
  expect(screen.queryByRole("group", { name: /^Personal or work/ })).toBeNull()
})
