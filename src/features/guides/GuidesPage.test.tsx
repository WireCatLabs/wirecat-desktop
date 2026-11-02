import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import { useLanguage } from "@/i18n"
import { useTools } from "../tools/store"
import { GuidesPage } from "./GuidesPage"

const copy = { path: "~/bin/x", version: "1.0.0", manager: "npm", problem: null }

function installed(...ids: string[]) {
  useTools.setState({
    installs: Object.fromEntries(
      ["tg", "max", "wa", "zm", "drive", "memo"].map((id) => [id, ids.includes(id) ? [copy] : []]),
    ),
    checked: true,
    refresh: async () => undefined,
  })
}

beforeEach(() => useTools.setState(useTools.getInitialState(), true))

const guide = (name: string) => screen.getByRole("article", { name })
const promptOf = (box: HTMLElement) => (within(box).getByRole("textbox") as HTMLTextAreaElement).value
const runsOf = (box: HTMLElement) => Array.from(box.querySelectorAll("code")).map((c) => c.textContent)
const openGuide = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`), expanded: false }))

it("writes the guide for Telegram when only Telegram is installed, with no switch", () => {
  installed("tg")
  render(<GuidesPage />)
  const box = guide("Catch up on what you missed")
  expect(promptOf(box)).toMatch(/^Use tg CLI\. /)
  expect(runsOf(box)).toEqual(["tg <profile> inbox date>18h", "tg <profile> review date>18h"])
  expect(within(box).queryByRole("group", { name: "Messenger" })).not.toBeInTheDocument()
  expect(within(box).getByText("Uses Telegram")).toBeInTheDocument()
})

it("writes it for WhatsApp when that is the only messenger", () => {
  installed("wa")
  render(<GuidesPage />)
  const box = guide("Catch up on what you missed")
  expect(promptOf(box)).toMatch(/^Use wa CLI\. /)
  expect(runsOf(box)).toEqual(["wa <profile> inbox date>18h", "wa <profile> review date>18h"])
})

it("lets the owner switch between installed messengers, starting on the first in catalog order", () => {
  installed("wa", "tg", "memo")
  render(<GuidesPage />)
  openGuide("Turn requests in your chats into tasks")
  const box = guide("Turn requests in your chats into tasks")
  const messenger = within(box).getByRole("group", { name: "Messenger" })
  expect(
    within(messenger)
      .getAllByRole("radio")
      .map((r) => r.getAttribute("value")),
  ).toEqual(["tg", "wa"])
  expect(within(messenger).getByRole("radio", { name: "Telegram" })).toBeChecked()
  expect(runsOf(box)).toEqual(["tg <profile> review date>7d", "memo tasks add msg:telegram/…"])

  fireEvent.click(within(messenger).getByRole("radio", { name: "WhatsApp" }))
  expect(promptOf(box)).toMatch(/^Use wa CLI and memo CLI\. /)
  expect(runsOf(box).slice(-2)).toEqual(["wa <profile> review date>7d", "memo tasks add msg:whatsapp/…"])
  expect(within(box).getByText(/^Uses memory and WhatsApp$/)).toBeInTheDocument()
  // The Start here guide keeps its own choice.
  expect(promptOf(guide("Catch up on what you missed"))).toMatch(/^Use tg CLI\. /)
})

it("keeps an edited prompt per messenger", () => {
  installed("tg", "max")
  render(<GuidesPage />)
  const box = guide("Catch up on what you missed")
  fireEvent.change(within(box).getByRole("textbox"), { target: { value: "My own words for tg" } })
  const messenger = within(box).getByRole("group", { name: "Messenger" })
  fireEvent.click(within(messenger).getByRole("radio", { name: "MAX" }))
  expect(promptOf(box)).toMatch(/^Use max CLI\. /)
  fireEvent.click(within(messenger).getByRole("radio", { name: "Telegram" }))
  expect(promptOf(box)).toBe("My own words for tg")
})

it("offers a guide only for the messengers that have its commands", () => {
  installed("tg", "max", "wa")
  render(<GuidesPage />)
  openGuide("Get a summary of new messages every morning")
  const box = guide("Get a summary of new messages every morning")
  const messenger = within(box).getByRole("group", { name: "Messenger" })
  expect(
    within(messenger)
      .getAllByRole("radio")
      .map((r) => r.getAttribute("value")),
  ).toEqual(["tg", "max"])
})

it("shows no switch on a guide whose words are the same for every messenger", () => {
  installed("tg", "wa", "memo")
  render(<GuidesPage />)
  openGuide("Remember what someone prefers")
  const box = guide("Remember what someone prefers")
  expect(within(box).queryByRole("group", { name: "Messenger" })).not.toBeInTheDocument()
  expect(within(box).getByText(/^Uses memory, Telegram,? and WhatsApp$/)).toBeInTheDocument()
})

it("asks for a messenger when none is installed", () => {
  installed()
  render(<GuidesPage />)
  openGuide("Catch up on what you missed")
  const box = guide("Catch up on what you missed")
  expect(within(box).getByText(/^Needs Telegram, MAX,? or WhatsApp$/)).toBeInTheDocument()
  expect(within(box).getByRole("button", { name: "Get a messenger" })).toBeInTheDocument()
  expect(within(box).queryByRole("group", { name: "Messenger" })).not.toBeInTheDocument()
})

it("names the messenger switch in Russian", () => {
  useLanguage.setState({ choice: "ru" })
  installed("tg", "wa")
  render(<GuidesPage />)
  const box = guide("Узнать, что вы пропустили")
  expect(within(box).getByRole("group", { name: "Мессенджер" })).toBeInTheDocument()
  expect(promptOf(box)).toMatch(/^Используй tg CLI\. /)
})

it("adds Zoom to a guide only when Zoom is installed", () => {
  installed("memo")
  const { unmount } = render(<GuidesPage />)
  openGuide("Prepare for a call with someone")
  let box = guide("Prepare for a call with someone")
  expect(promptOf(box)).not.toMatch(/zm CLI/)
  expect(runsOf(box).some((run) => run?.startsWith("zm "))).toBe(false)
  unmount()

  installed("memo", "zm")
  render(<GuidesPage />)
  openGuide("Prepare for a call with someone")
  box = guide("Prepare for a call with someone")
  expect(promptOf(box)).toMatch(/Use zm CLI too, for what we said in past Zoom meetings\.$/)
  expect(runsOf(box)).toContain("zm <profile> meetings context person:…")
})
