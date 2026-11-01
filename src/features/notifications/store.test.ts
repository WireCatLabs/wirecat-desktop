import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import type { Notification } from "@/platform/notifications-schemas"
import { unread, useNotifications, visible } from "./store"

const note = (id: string, extra: Partial<Notification> = {}): Notification => ({
  id,
  severity: "info",
  title: { en: id },
  body: { en: "Text" },
  link: null,
  publishedAt: "2026-11-01T12:00:00Z",
  expiresAt: null,
  ...extra,
})

describe("notifications store", () => {
  beforeEach(() =>
    useNotifications.setState({ items: [], read: [], dismissed: [], checked: false, failed: false, open: false }),
  )
  afterEach(() => vi.restoreAllMocks())

  it("forgets read and removed ids the server no longer sends", async () => {
    useNotifications.setState({ read: ["a", "gone"], dismissed: ["gone"] })
    vi.spyOn(platform, "notifications").mockResolvedValue([note("a"), note("b")])

    await useNotifications.getState().check()

    expect(useNotifications.getState()).toMatchObject({ read: ["a"], dismissed: [], checked: true })
    expect(unread(useNotifications.getState()).map((n) => n.id)).toEqual(["b"])
  })

  it("keeps the last list when the server cannot be reached", async () => {
    useNotifications.setState({ items: [note("a")] })
    vi.spyOn(platform, "notifications").mockRejectedValue(new Error("offline"))

    await useNotifications.getState().check()

    expect(useNotifications.getState()).toMatchObject({ failed: true, items: [note("a")] })
  })

  it("hides an expired notification even from the stored list", () => {
    const items = [note("live"), note("old", { expiresAt: "2026-11-01T00:00:00Z" })]
    expect(visible({ items, dismissed: [] }, Date.parse("2026-11-02T00:00:00Z")).map((n) => n.id)).toEqual(["live"])
  })

  it("marks what was unread as read on opening, and keeps it marked new until the panel closes", () => {
    useNotifications.setState({ items: [note("a"), note("b")], read: ["a"] })

    useNotifications.getState().show()
    expect(useNotifications.getState()).toMatchObject({ open: true, fresh: ["b"], read: ["a", "b"] })

    useNotifications.getState().close()
    expect(useNotifications.getState()).toMatchObject({ open: false, fresh: [] })
  })
})
