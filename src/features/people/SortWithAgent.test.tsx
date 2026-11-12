import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { useAgentChoice } from "@/features/fix"
import { platform } from "@/platform/bridge"
import { useAgents } from "@/shared/agents-store"
import { render, screen } from "@/testing/render"
import { sortMessages } from "./messages-sort"
import { SortWithAgent } from "./SortWithAgent"

beforeEach(() => {
  vi.restoreAllMocks()
  useAgents.setState({ agents: [{ id: "claude", name: "Claude Code", foundBy: "program", reads: ["claude"] }] })
  useAgentChoice.setState({ id: null })
})

it("copies the prompt and opens the agent with the same prompt in a terminal", async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, "writeText")
  const run = vi
    .spyOn(platform, "runAgent")
    .mockResolvedValue({ started: true, agent: "claude", file: "", reason: null, message: null })
  render(<SortWithAgent />)
  await user.click(screen.getByRole("button", { name: "Copy the prompt for an agent" }))
  const prompt = sortMessages.en.prompt
  expect(write).toHaveBeenCalledWith(prompt)
  expect(prompt).toMatch(/memo people review .*--json/)
  expect(prompt).toMatch(/Never pass --as-owner/)
  expect(prompt).toContain("Sorting the owner's matches for him")
  expect(prompt).toContain('--name "<company>"')
  await user.click(screen.getByRole("button", { name: "Run in a terminal" }))
  expect(run).toHaveBeenCalledWith("claude", prompt)
  expect(await screen.findByText(/Claude Code opened in a terminal/)).toBeInTheDocument()
})

it("writes the prompt in every language without a semicolon, a long dash or ё", () => {
  for (const m of Object.values(sortMessages)) expect(m.prompt).not.toMatch(/[;—ё]/)
})
