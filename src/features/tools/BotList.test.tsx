import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import { answerAtOnce } from "@/testing/mock-speed"
import { render, screen } from "@/testing/render"
import { BotList } from "./BotList"

beforeEach(() => answerAtOnce())
afterEach(() => answerAtOnce(false))

it("opens the removal of a bot on Cancel, so Enter does not remove it", async () => {
  const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
  render(<BotList tool={tg} />)
  await userEvent.click(await screen.findByRole("button", { name: "Remove bot sales" }))
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
})
