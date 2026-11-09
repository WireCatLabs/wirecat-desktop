import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { HarderStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor } from "@/testing/render"
import { choiceOf, SearchHarder } from "./SearchHarder"

const memo = findTool("memo") as NonNullable<ReturnType<typeof findTool>>
const off: HarderStatus = {
  on: false,
  provider: "anthropic",
  model: "claude-haiku-5-5",
  endpointHost: "api.anthropic.com",
  baseUrl: null,
  proposedFromEnrichment: false,
  consentedAt: null,
  candidates: 30,
  charsPerHit: 400,
  usdPerMillionInput: 0.1,
  usdPerMillionOutput: 0.5,
  key: { present: false, source: null, envVar: "ANTHROPIC_API_KEY" },
}
const openai: HarderStatus = {
  ...off,
  provider: "openai",
  model: "gpt-4o-mini",
  endpointHost: "api.openai.com",
  usdPerMillionInput: 0.15,
  usdPerMillionOutput: 0.6,
  key: { present: true, source: "keyring", envVar: "OPENAI_API_KEY" },
}

afterEach(() => vi.restoreAllMocks())

it("is offered only for memo, and waits for a memo release that has it", () => {
  expect(memo.searchHarder).not.toBeNull()
  expect(findTool("tg")?.searchHarder).toBeNull()
  // The owner's rule: the catalog names only a version already on npm.
  expect(memo.searchHarder?.minVersion).toBeNull()
})

it("says that no memo release can search harder yet", async () => {
  vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "old", version: "0.131.73", need: null })
  render(<SearchHarder tool={memo} />)
  expect(
    await screen.findByText("Search harder comes with a memo update that is not released yet."),
  ).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Allow…" })).not.toBeInTheDocument()
})

it("allows it only after showing what one search sends, where, its price and the missing key", async () => {
  const user = userEvent.setup()
  vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "ready", status: off })
  const preview = vi
    .spyOn(platform, "searchHarderPreview")
    .mockImplementation(async (_id, c) =>
      c.provider === "openai"
        ? { ...openai, model: c.model ?? openai.model, endpointHost: c.baseUrl ? "openrouter.ai" : "api.openai.com" }
        : off,
    )
  const turnOn = vi
    .spyOn(platform, "searchHarderOn")
    .mockResolvedValue({ ...openai, on: true, consentedAt: "2026-11-09T09:12:00.000Z" })
  render(<SearchHarder tool={memo} />)

  await user.click(await screen.findByRole("button", { name: "Allow…" }))
  const consent = await screen.findByRole("region", { name: "What searching harder sends" })
  expect(
    await screen.findByText(/its first 30 results, each with its date, title and up to 400 characters/),
  ).toBeInTheDocument()
  expect(screen.getByText("They go to Anthropic (api.anthropic.com), model claude-haiku-5-5.")).toBeInTheDocument()
  expect(screen.getByText(/No API key found \(memo also reads ANTHROPIC_API_KEY\)/)).toBeInTheDocument()
  expect(preview).toHaveBeenLastCalledWith("memo", { provider: "anthropic", model: "claude-haiku-5-5", baseUrl: null })
  expect(turnOn).not.toHaveBeenCalled()

  await user.click(screen.getByRole("radio", { name: "OpenAI" }))
  await waitFor(() =>
    expect(preview).toHaveBeenLastCalledWith("memo", { provider: "openai", model: null, baseUrl: null }),
  )
  expect(await screen.findByRole("textbox", { name: /Model/ })).toHaveValue("gpt-4o-mini")
  expect(await screen.findByText(/\$0\.15 for each million tokens sent/)).toBeInTheDocument()

  const model = screen.getByRole("textbox", { name: /Model/ })
  await user.clear(model)
  await user.type(model, "deepseek/deepseek-chat")
  await user.type(
    screen.getByRole("textbox", { name: /Address of another OpenAI-compatible service/ }),
    "https://openrouter.ai/api/v1",
  )
  await waitFor(
    () =>
      expect(preview).toHaveBeenLastCalledWith("memo", {
        provider: "openai",
        model: "deepseek/deepseek-chat",
        baseUrl: "https://openrouter.ai/api/v1",
      }),
    { timeout: 2000 },
  )
  await waitFor(() => expect(screen.getByRole("button", { name: "Allow search harder with OpenAI" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "Allow search harder with OpenAI" }))

  expect(turnOn).toHaveBeenCalledWith("memo", {
    provider: "openai",
    model: "deepseek/deepseek-chat",
    baseUrl: "https://openrouter.ai/api/v1",
  })
  expect(await screen.findByText(/Search harder is allowed\. On the Search page/)).toBeInTheDocument()
  await waitFor(() => expect(consent).not.toBeInTheDocument())
})

it("says in plain words when memo refuses because WireCat runs from an agent's terminal", async () => {
  const user = userEvent.setup()
  vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({ state: "ready", status: off })
  vi.spyOn(platform, "searchHarderPreview").mockResolvedValue(off)
  vi.spyOn(platform, "searchHarderOn").mockRejectedValue(
    new Error("memo lets only you allow this, and WireCat was started from an AI agent's terminal."),
  )
  render(<SearchHarder tool={memo} />)
  await user.click(await screen.findByRole("button", { name: "Allow…" }))
  const agree = await screen.findByRole("button", { name: "Allow search harder with Anthropic" })
  await waitFor(() => expect(agree).toBeEnabled())
  await user.click(agree)
  expect(await screen.findByText(/Could not allow it: memo lets only you allow this/)).toBeInTheDocument()
  expect(screen.getByRole("region", { name: "What searching harder sends" })).toBeInTheDocument()
})

it("turns off with memo's revoke", async () => {
  const user = userEvent.setup()
  vi.spyOn(platform, "searchHarderStatus").mockResolvedValue({
    state: "ready",
    status: { ...off, on: true, consentedAt: "2026-11-09T09:12:00.000Z" },
  })
  const revoke = vi.spyOn(platform, "searchHarderOff").mockResolvedValue(off)
  render(<SearchHarder tool={memo} />)
  expect(
    await screen.findByText(/Allowed since .*: Anthropic claude-haiku-5-5 \(api\.anthropic\.com\)\./),
  ).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Turn off" }))
  expect(revoke).toHaveBeenCalledWith("memo")
  expect(await screen.findByText("Off. No search sends anything.")).toBeInTheDocument()
})

it("sends an address only for OpenAI, and an empty model as memo's choice", () => {
  expect(choiceOf({ provider: "anthropic", model: " ", baseUrl: "https://x.example/v1" })).toEqual({
    provider: "anthropic",
    model: null,
    baseUrl: null,
  })
  expect(choiceOf({ provider: "openai", model: " m ", baseUrl: " https://x.example/v1 " })).toEqual({
    provider: "openai",
    model: "m",
    baseUrl: "https://x.example/v1",
  })
})
