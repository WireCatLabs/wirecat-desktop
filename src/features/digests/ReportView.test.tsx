import * as v from "valibot"
import { describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { ReportSchema } from "@/platform/digest-schemas"
import { crmHealth, crmSection } from "@/platform/mock-crm-digest"
import { render, screen, within } from "@/testing/render"
import { ReportView } from "./ReportView"
import { useDigests } from "./store"

const now = Date.parse("2026-11-16T09:00:00")

const documentOf = (section: Record<string, unknown>) => ({
  format: "wirecat.report/1",
  kind: "morning-digest",
  date: "2026-11-16",
  summary: null,
  sections: [section],
  health: crmHealth,
  scope: {
    from: new Date(now - 86_400_000).toISOString(),
    to: new Date(now).toISOString(),
    sources: [{ kind: "crm", accounts: 1 }],
    counts: { chats: 0, mail: 0, tasks: 1, meetings: 0 },
  },
})

const showReport = (section: Record<string, unknown>) => {
  const report = v.parse(ReportSchema, documentOf(section))
  render(<ReportView report={report} now={now} />)
  return screen.getByRole("region", { name: "CRM" })
}

describe("a CRM digest", () => {
  it("shows won, lost, moved, new deals, new owners, tasks and what it left out", () => {
    const crm = showReport(crmSection(now))
    const text = crm.textContent ?? ""
    expect(text).toContain("Northstar site · won")
    expect(text).toContain("Vector renewal: lost: price")
    expect(text).toContain("Atlas warehouse: New → Quote sent")
    expect(text).toContain("Cable supply: new")
    expect(text).toContain("Office move: new owner")
    expect(text).toMatch(/Call about the contract — overdue by 2 hours/)
    expect(text).toMatch(/Send the quote — due today/)
    expect(text).toContain("5 more")
    expect(within(crm).getByRole("button", { name: "Open: Northstar site · won" })).toBeTruthy()
    expect(within(crm).getByRole("button", { name: "Open: Atlas warehouse" })).toBeTruthy()
  })

  it("shows a won deal without an amount, new contacts as one count and the tasks the stage rules opened", () => {
    const crm = showReport({
      kind: "crm",
      items: [
        { type: "fact", topic: "Harbor fit-out", detail: "won", channel: "crm", refs: ["deal:13"] },
        { type: "fact", topic: "new contacts", detail: "3", count: 3, refs: [] },
        { type: "task", topic: "Check the signed contract", channel: "crm", refs: ["task:CRM-7"] },
      ],
    })
    expect(crm.textContent).toContain("Harbor fit-out: won")
    expect(crm.textContent).toContain("new contacts: 3")
    expect(within(crm).getByRole("button", { name: "Open: Check the signed contract" })).toBeTruthy()
  })

  it("names a stale CRM by its tool, offers Fix, and names the CRM among the sources", () => {
    showReport(crmSection(now))
    const sync = screen.getByRole("region", { name: "Sync" })
    expect(sync.textContent).toContain("Bitrix24 (sales): not updated for 1 day")
    expect(within(sync).getByRole("button", { name: "Fix: Bitrix24 (sales)" })).toBeTruthy()
    expect(screen.getByText(/^Viewed over .*: CRM · 1 task/)).toBeTruthy()
  })

  it("shows CRM text as text: no markup, and only the ref opens anything, never a web address in a title", () => {
    const crm = showReport({
      kind: "crm",
      items: [
        { type: "fact", topic: '<img src=x onerror="alert(1)">', detail: "new", channel: "crm", refs: [] },
        { type: "fact", topic: "https://evil.example/login", detail: "won", channel: "crm", refs: ["deal:1"] },
      ],
    })
    expect(crm.textContent).toContain('<img src=x onerror="alert(1)">: new')
    expect(crm.textContent).toContain("https://evil.example/login: won")
    expect(crm.querySelector("img, a")).toBeNull()
    const opens = within(crm).getAllByRole("button", { name: /^Open/ })
    expect(opens.map((b) => b.getAttribute("aria-label"))).toEqual(["Open: https://evil.example/login"])
  })
})

describe("a digest with a section this app does not know", () => {
  it("shows as the run's text rather than half a page", async () => {
    const document = documentOf({ kind: "invoices", items: [] })
    vi.spyOn(platform, "digestShow").mockResolvedValue({
      date: "2026-11-16",
      stamp: "s",
      document,
      text: "Invoices: 2 due",
      refused: false,
      invalid: null,
    })
    await useDigests.getState().show("2026-11-16")
    expect(useDigests.getState().shown["2026-11-16"]).toMatchObject({
      state: "text",
      refused: true,
      field: "sections.0.kind",
    })
  })
})

describe("a digest memo's check refused", () => {
  it("is told apart from an older run's text, with the field that failed", async () => {
    vi.spyOn(platform, "digestShow").mockResolvedValue({
      date: "2026-11-24",
      stamp: "s",
      document: null,
      text: '```json\n{ "format": "wirecat.report/1" }\n```',
      refused: true,
      invalid: "sections[0].items[7].since",
    })
    await useDigests.getState().show("2026-11-24")
    expect(useDigests.getState().shown["2026-11-24"]).toMatchObject({
      state: "text",
      refused: true,
      field: "sections[0].items[7].since",
    })
  })
})
