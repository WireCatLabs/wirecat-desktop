import { afterEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { EnrichmentStatus, EnrichmentTarget } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { act, fireEvent, render, screen, within } from "@/testing/render"
import { Enrichment } from "./Enrichment"
import { useSync } from "./sync-store"

const memo = findTool("memo") as NonNullable<ReturnType<typeof findTool>>
const target = (provider: string, model: string, host: string, present = false): EnrichmentTarget => ({
  provider,
  model,
  endpointHost: host,
  key: present
    ? { present: true, source: "keyring", envVar: "OPENAI_API_KEY" }
    : { present: false, source: null, envVar: provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY" },
  priceKnown: true,
})
const off: EnrichmentStatus = {
  on: false,
  consentedAt: null,
  target: target("openai", "gpt-4o-mini", "api.openai.com"),
  records: 10_444,
  enriched: 0,
  pending: 10_444,
  estimate: { records: 10_444, inputTokens: 689_496, outputTokens: 731_080, usd: 0.5421 },
  perSync: 600,
  syncsNeeded: 18,
  offered: [
    { provider: "openai", model: "gpt-4o-mini", default: true, usdPerMillionInput: 0.15, usdPerMillionOutput: 0.6 },
    {
      provider: "anthropic",
      model: "claude-haiku-5-5",
      default: false,
      usdPerMillionInput: 0.1,
      usdPerMillionOutput: 0.5,
    },
  ],
  measured: { rewordedOff: 0.62, rewordedOn: 0.79, ownWordsFirstOff: 0.54, ownWordsFirstOn: 0.48 },
  deleted: null,
}
const on: EnrichmentStatus = {
  ...off,
  on: true,
  consentedAt: "2026-11-08T09:12:00.000Z",
  target: target("openai", "gpt-4o-mini", "api.openai.com", true),
  enriched: 10_160,
  pending: 284,
  syncsNeeded: 1,
  estimate: { records: 284, inputTokens: 18_744, outputTokens: 19_880, usd: 0.0148 },
}

afterEach(() => vi.restoreAllMocks())

it("is offered only for memo", () => {
  expect(memo.enrichment).not.toBeNull()
  expect(findTool("tg")?.enrichment).toBeNull()
})

it("shows memo's price while off, before anything is sent", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  render(<Enrichment tool={memo} />)

  expect(
    await screen.findByText(/Turning it on would send 10,444 records to OpenAI, for about \$0\.54\./),
  ).toBeInTheDocument()
  expect(screen.getByText(/79 times in 100 instead of 62/)).toBeInTheDocument()
})

it("turns on only after the consent step shows what is sent, to whom, how many, the cost and the missing key", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  const preview = vi.spyOn(platform, "enrichmentPreview").mockResolvedValue(off)
  const turnOn = vi.spyOn(platform, "enrichmentOn").mockResolvedValue({ ...on, enriched: 0, pending: 10_444 })
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))

  const consent = await screen.findByRole("region", { name: "What turning it on sends" })
  expect(preview).toHaveBeenCalledWith("memo", "openai", "gpt-4o-mini")
  expect(await within(consent).findByText(/from every account: 10,444 records now/)).toBeInTheDocument()
  expect(within(consent).getByText("It goes to OpenAI (api.openai.com), model gpt-4o-mini.")).toBeInTheDocument()
  expect(
    within(consent).getByText(/costs about \$0\.54 \(689,496 input and 731,080 output tokens\)/),
  ).toBeInTheDocument()
  expect(within(consent).getByText(/up to 600 records per sync: 18 syncs/)).toBeInTheDocument()
  expect(within(consent).getByText(/No API key found\. Add it as OPENAI_API_KEY/)).toBeInTheDocument()
  expect(turnOn).not.toHaveBeenCalled()

  fireEvent.click(within(consent).getByRole("button", { name: "Send 10,444 records to OpenAI and turn on" }))

  expect(await screen.findByText(/Search rewriting is on/)).toBeInTheDocument()
  expect(turnOn).toHaveBeenCalledWith("memo", "openai", "gpt-4o-mini")
})

it("asks memo again for the other offer, and turns on with that one", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  const anthropic = { ...off, target: target("anthropic", "claude-haiku-5-5", "api.anthropic.com", true) }
  const preview = vi
    .spyOn(platform, "enrichmentPreview")
    .mockImplementation(async (_id, provider) => (provider === "anthropic" ? anthropic : off))
  const turnOn = vi.spyOn(platform, "enrichmentOn").mockResolvedValue(on)
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))
  fireEvent.click(await screen.findByRole("radio", { name: /Anthropic claude-haiku-5-5/ }))

  expect(
    await screen.findByText("It goes to Anthropic (api.anthropic.com), model claude-haiku-5-5."),
  ).toBeInTheDocument()
  expect(preview).toHaveBeenLastCalledWith("memo", "anthropic", "claude-haiku-5-5")
  expect(screen.getByText("Memo found your API key (in the system keyring).")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Send 10,444 records to Anthropic and turn on" }))
  await screen.findByText(/Search rewriting is on/)
  expect(turnOn).toHaveBeenCalledWith("memo", "anthropic", "claude-haiku-5-5")
})

it("cancelling the consent step sends nothing", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  vi.spyOn(platform, "enrichmentPreview").mockResolvedValue(off)
  const turnOn = vi.spyOn(platform, "enrichmentOn")
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))
  await screen.findByText(/10,444 records now/)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

  expect(await screen.findByRole("button", { name: "Turn on…" })).toBeInTheDocument()
  expect(turnOn).not.toHaveBeenCalled()
})

it("while on, says how many syncs are left and what the last sync rewrote, read again after it", async () => {
  const status = vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: on })
  render(<Enrichment tool={memo} />)

  expect(
    await screen.findByText(/284 records wait: they are rewritten at the next sync, for about \$0\.01/),
  ).toBeInTheDocument()
  const enrichment = { status: "done", sent: 284, enriched: 284, failed: 0, left: 0, costUsd: 0.0141, reason: null }
  act(() =>
    useSync.setState({
      runs: {
        "memo:": {
          phase: "done",
          startedAt: 1,
          endedAt: 2,
          stage: null,
          progress: null,
          stopping: false,
          failure: null,
          summary: { new: 3, places: 1, failed: 0, left: 0, complete: true, enrichment },
        },
      },
    }),
  )

  expect(await screen.findByText("Last sync: sent 284 records, 284 rewritten, cost $0.01.")).toBeInTheDocument()
  expect(status).toHaveBeenCalledTimes(2)
})

it("says why a sync sent nothing, in memo's words", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({
    state: "ready",
    status: { ...on, target: target("openai", "gpt-4o-mini", "api.openai.com") },
  })
  render(<Enrichment tool={memo} />)
  await screen.findByText(/No API key found/)
  const reason = "no openai key: set OPENAI_API_KEY, or the tool's own key; nothing was sent"
  const enrichment = { status: "stopped", sent: 0, enriched: 0, failed: 0, left: 284, costUsd: 0, reason }
  act(() =>
    useSync.setState({
      runs: {
        "memo:": {
          phase: "done",
          startedAt: 1,
          endedAt: 2,
          stage: null,
          progress: null,
          stopping: false,
          failure: null,
          summary: { new: 0, places: 0, failed: 0, left: 0, complete: true, enrichment },
        },
      },
    }),
  )

  expect(await screen.findByText(`Last sync rewrote nothing: ${reason}`)).toBeInTheDocument()
})

it("asks before turning off, says the model's text is deleted, then says how much was", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: on })
  const turnOff = vi.spyOn(platform, "enrichmentOff").mockResolvedValue({ ...off, deleted: 10_160 })
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn off…" }))
  const dialog = await screen.findByRole("dialog", { name: "Turn off and delete the model's text?" })
  expect(within(dialog).getByText(/the model wrote for 10,160 records/)).toBeInTheDocument()
  expect(turnOff).not.toHaveBeenCalled()

  fireEvent.click(within(dialog).getByRole("button", { name: "Turn off and delete" }))

  expect(await screen.findByText(/Off\. Deleted the model's text for 10,160 records\./)).toBeInTheDocument()
  expect(turnOff).toHaveBeenCalledWith("memo")
})

it("shows memo's words when turning on fails, and stays off", async () => {
  vi.spyOn(platform, "enrichmentStatus").mockResolvedValue({ state: "ready", status: off })
  vi.spyOn(platform, "enrichmentPreview").mockResolvedValue(off)
  vi.spyOn(platform, "enrichmentOn").mockRejectedValue(new Error("permission denied"))
  render(<Enrichment tool={memo} />)

  fireEvent.click(await screen.findByRole("button", { name: "Turn on…" }))
  fireEvent.click(await screen.findByRole("button", { name: /^Send 10,444 records/ }))

  expect(await screen.findByText("Could not turn it on: permission denied")).toBeInTheDocument()
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
