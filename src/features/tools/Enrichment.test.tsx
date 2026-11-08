import { afterEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { EnrichmentStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { fireEvent, render, screen, within } from "@/testing/render"
import { Enrichment } from "./Enrichment"

const memo = findTool("memo") as NonNullable<ReturnType<typeof findTool>>
const estimate = { records: 10_444, inputTokens: 689_496, outputTokens: 691_880, usd: 0.5186 }
const off: EnrichmentStatus = {
  on: false,
  provider: null,
  model: null,
  endpoint: null,
  consentedAt: null,
  records: 10_444,
  enriched: 0,
  pending: 10_444,
  estimate: { ...estimate, usd: null },
  deleted: null,
}
const on: EnrichmentStatus = {
  ...off,
  on: true,
  provider: "openai",
  model: "gpt-4o-mini",
  endpoint: "https://api.openai.com/v1",
  consentedAt: "2026-11-08T09:12:00.000Z",
  enriched: 16,
  pending: 10_428,
  estimate,
}

afterEach(() => vi.restoreAllMocks())

it("is offered only for memo, with one fixed provider and model", () => {
  expect(memo.enrichment).toMatchObject({ provider: "OpenAI", host: "api.openai.com", model: "gpt-4o-mini" })
  expect(findTool("tg")?.enrichment).toBeNull()
})

it("turns on only after the consent step shows what is sent, to whom, how many records and the cost", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  const preview = vi.spyOn(platform, "enrichmentPreview").mockResolvedValue({ ...off, estimate })
  const turnOn = vi.spyOn(platform, "enrichmentOn").mockResolvedValue({ ...on, enriched: 0, pending: 10_444 })
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))

  const consent = await screen.findByRole("region", { name: "What turning it on sends" })
  expect(preview).toHaveBeenCalledWith("memo")
  expect(await within(consent).findByText(/from every account: 10,444 records now/)).toBeInTheDocument()
  expect(within(consent).getByText("It goes to OpenAI (api.openai.com), model gpt-4o-mini.")).toBeInTheDocument()
  expect(
    within(consent).getByText(/costs about \$0\.52 \(689,496 input and 691,880 output tokens\)/),
  ).toBeInTheDocument()
  expect(turnOn).not.toHaveBeenCalled()

  fireEvent.click(within(consent).getByRole("button", { name: "Send 10,444 records to OpenAI and turn on" }))

  expect(await screen.findByText(/Search rewriting is on/)).toBeInTheDocument()
  expect(turnOn).toHaveBeenCalledWith("memo")
  expect(screen.getByText(/10,444 records wait: they are rewritten at the next syncs/)).toBeInTheDocument()
})

it("cancelling the consent step sends nothing", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  vi.spyOn(platform, "enrichmentPreview").mockResolvedValue({ ...off, estimate })
  const turnOn = vi.spyOn(platform, "enrichmentOn")
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))
  await screen.findByText(/10,444 records now/)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

  expect(await screen.findByRole("button", { name: "Turn on…" })).toBeInTheDocument()
  expect(turnOn).not.toHaveBeenCalled()
})

it("asks before turning off, says the model's text is deleted, then says how much was", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: on })
  const turnOff = vi.spyOn(platform, "enrichmentOff").mockResolvedValue({ ...off, deleted: 16 })
  render(<Enrichment tool={memo} />)

  expect(await screen.findByText(/16 of 10,444 records rewritten/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Turn off…" }))
  const dialog = await screen.findByRole("dialog", { name: "Turn off and delete the model's text?" })
  expect(within(dialog).getByText(/deletes the facts and questions the model wrote for 16 records/)).toBeInTheDocument()
  expect(turnOff).not.toHaveBeenCalled()

  fireEvent.click(within(dialog).getByRole("button", { name: "Turn off and delete" }))

  expect(
    await screen.findByText("Off. Deleted the model's text for 16 records. Nothing more is sent."),
  ).toBeInTheDocument()
  expect(turnOff).toHaveBeenCalledWith("memo")
})

it("shows memo's words when turning on fails, and stays off", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  vi.spyOn(platform, "enrichmentPreview").mockResolvedValue({ ...off, estimate })
  vi.spyOn(platform, "enrichmentOn").mockRejectedValue(new Error("only the owner turns enrichment on"))
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))
  fireEvent.click(await screen.findByRole("button", { name: /^Send 10,444 records/ }))

  expect(await screen.findByText("Could not turn it on: only the owner turns enrichment on")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /^Send 10,444 records/ })).toBeEnabled()
})

it("says a memo without the command needs an update", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "old", version: "0.131.50" })
  render(<Enrichment tool={memo} />)

  expect(
    await screen.findByText("Memo 0.131.50 cannot rewrite records yet. It comes with a Memo update."),
  ).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Turn on…" })).toBeNull()
})
