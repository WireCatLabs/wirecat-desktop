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
  it("shows won, lost, moved, new deals, new owners, new contacts, tasks and what it left out", () => {
    const crm = showReport(crmSection(now))
    const text = crm.textContent ?? ""
    expect(text).toContain("Northstar site")
    expect(text).toContain("Harbor fit-out: won")
    expect(text).toContain("Vector renewal: lost: price")
    expect(text).toContain("Atlas warehouse: New → Quote sent")
    expect(text).toContain("Cable supply: new")
    expect(text).toContain("Office move: new owner")
    expect(text).toContain("new contacts: 3")
    expect(text).toMatch(/Call about the contract — overdue by 2 hours/)
    expect(text).toMatch(/Send the quote — due today/)
    expect(text).toContain("Check the signed contract")
    expect(text).toContain("4 more")
    expect(within(crm).getByRole("button", { name: "Open: Atlas warehouse" })).toBeTruthy()
    expect(within(crm).getByRole("button", { name: "Open: Check the signed contract" })).toBeTruthy()
  })

  it("says the CRM copy is stale and names the CRM among the sources", () => {
    showReport(crmSection(now))
    expect(screen.getByRole("region", { name: "Sync" }).textContent).toContain("amo (sales): not updated for 1 day")
    expect(screen.getByText(/^Viewed over .*: CRM · 1 task/)).toBeTruthy()
  })

  it("shows CRM text as text: no markup, and no link from a web address in a title", () => {
    const crm = showReport({
      kind: "crm",
      items: [
        { type: "fact", topic: '<img src=x onerror="alert(1)">', detail: "new", channel: "crm", refs: [] },
        { type: "fact", topic: "https://evil.example/login", detail: "won", channel: "crm", refs: [] },
      ],
    })
    expect(crm.textContent).toContain('<img src=x onerror="alert(1)">: new')
    expect(crm.querySelector("img, a")).toBeNull()
    expect(within(crm).queryByRole("button", { name: /^Open/ })).toBeNull()
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
    })
    await useDigests.getState().show("2026-11-16")
    expect(useDigests.getState().shown["2026-11-16"]).toEqual({ state: "text", text: "Invoices: 2 due" })
  })
})
