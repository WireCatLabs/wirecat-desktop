import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"
import { findTool } from "@/domain/catalog"
import { render, screen } from "@/testing/render"
import { BotList } from "./BotList"

it("opens the removal of a bot on Cancel, so Enter does not remove it", async () => {
  const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
  render(<BotList tool={tg} />)
  await userEvent.click(await screen.findByRole("button", { name: "Remove bot sales" }))
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
})
