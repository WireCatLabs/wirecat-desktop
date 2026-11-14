import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"
import { useChatAgentLimit } from "@/shared/chat-agent-limit-store"
import { render, screen } from "@/testing/render"
import { ChatAgentSetting } from "./ChatAgentSetting"

it("starts off, says the risk, and says turning it off leaves read only levels in place", async () => {
  render(<ChatAgentSetting />)
  const box = screen.getByRole("switch", { name: "Connect chat agents read only" })
  expect(box).not.toBeChecked()
  expect(box).toHaveAccessibleDescription(/Anyone who can message the agent's bot can ask it to send, change or delete/)

  await userEvent.click(box)
  expect(useChatAgentLimit.getState().on).toBe(true)
  expect(await screen.findByRole("status")).toHaveTextContent("Agents connected before keep the levels they have now")
  expect(localStorage.getItem("wirecat.chat-agent-read-only")).toContain('"on":true')
})

it("says WireCat kept no earlier levels when the owner turns it off", async () => {
  useChatAgentLimit.setState({ on: true })
  render(<ChatAgentSetting />)
  await userEvent.click(screen.getByRole("switch", { name: "Connect chat agents read only" }))
  expect(await screen.findByRole("status")).toHaveTextContent("WireCat did not keep the levels they had before")
})
