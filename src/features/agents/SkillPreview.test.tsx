import { act, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { SkillText } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { render } from "@/testing/render"
import { SkillPreview, useSkillPreview } from "./SkillPreview"

afterEach(() => vi.restoreAllMocks())

it("shows the skill of the tool opened last, even when the one opened before answers later", async () => {
  const answers: Record<string, (t: SkillText) => void> = {}
  vi.spyOn(platform, "skillShow").mockImplementation((id) => new Promise((resolve) => (answers[id] = resolve)))
  render(<SkillPreview />)
  act(() => useSkillPreview.getState().open("tg"))
  act(() => useSkillPreview.getState().open("max"))
  await act(async () => answers.max?.({ name: "max", content: "Max's skill" }))
  await act(async () => answers.tg?.({ name: "tg", content: "Telegram's skill" }))
  expect(screen.getByText("Max's skill")).toBeInTheDocument()
  expect(screen.queryByText("Telegram's skill")).toBeNull()
})
