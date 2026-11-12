import { afterEach, expect, it, vi } from "vitest"
import type { StoreInfo, TableList } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { StorageArea } from "@/platform/schemas"
import { useStorage } from "@/shared/storage-store"

afterEach(() => vi.restoreAllMocks())

it("keeps the last folders, facts and tables on screen while it asks again", async () => {
  const areas: StorageArea[] = [{ id: "tg", folders: [], usedBy: ["tg"], kept: [] }]
  const info = { answeredBy: "tg" } as StoreInfo
  const tables = { answeredBy: "tg", available: true, measured: false, tables: [] } as TableList
  useStorage.setState({ areas, info, tables })
  let answer: (a: StorageArea[]) => void = () => undefined
  vi.spyOn(platform, "storage").mockReturnValue(new Promise((r) => (answer = r)))
  vi.spyOn(platform, "storeInfo").mockReturnValue(new Promise(() => undefined))
  vi.spyOn(platform, "storeTables").mockReturnValue(new Promise(() => undefined))

  void useStorage.getState().refresh()
  expect(useStorage.getState()).toMatchObject({ revalidating: true, areas, info, tables })

  const fresh: StorageArea[] = [{ id: "tg", folders: [], usedBy: [], kept: [] }]
  answer(fresh)
  await vi.waitFor(() => expect(useStorage.getState().areas).toEqual(fresh))
  expect(useStorage.getState().info).toBe(info)
})

it("keeps a failed delete on screen after the reload that follows it", async () => {
  vi.spyOn(platform, "clearStorage").mockRejectedValue(new Error("permission denied (os error 13)"))
  vi.spyOn(platform, "storage").mockResolvedValue([])

  await useStorage.getState().clear("tg")

  expect(useStorage.getState().actionError).toBe("permission denied (os error 13)")
  expect(useStorage.getState().error).toBeNull()
})
