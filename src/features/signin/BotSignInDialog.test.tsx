import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { useBotSignIn } from "@/shared/bot-signin-store"
import { render, screen, within } from "@/testing/render"
import { BotList } from "../tools/BotList"
import { BotSignInDialog } from "./BotSignInDialog"

const TOKEN = "12345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"

const tool = (id: string) => {
  const t = findTool(id)
  if (!t) throw new Error(`${id} is in the catalog`)
  return t
}

beforeEach(() => {
  vi.spyOn(platform, "listBots").mockResolvedValue([{ name: "sales", source: "keyring" }])
  vi.spyOn(platform, "openUrl").mockResolvedValue()
})

afterEach(() => vi.restoreAllMocks())

function openFromTools(id = "tg") {
  render(
    <>
      <BotList tool={tool(id)} />
      <BotSignInDialog />
    </>,
  )
  return userEvent.setup()
}

const dialog = () => screen.getByRole("dialog")

async function toToken(user: ReturnType<typeof userEvent.setup>, name = "support") {
  await user.click(screen.getByRole("button", { name: "Add a bot" }))
  await user.type(within(dialog()).getByRole("textbox", { name: "Bot name on this computer" }), name)
  await user.click(within(dialog()).getByRole("button", { name: "Next" }))
}

describe("the bot list on the Tools page", () => {
  it("shows each bot the tool reports with a Bot badge", async () => {
    openFromTools()
    const list = await screen.findByRole("list")
    expect(within(list).getByText("sales")).toBeInTheDocument()
    expect(within(list).getByText("Bot")).toBeInTheDocument()
  })
})

describe("the bot sign-in", () => {
  it("does not go on without a name the owner chose", async () => {
    const user = openFromTools()
    await user.click(screen.getByRole("button", { name: "Add a bot" }))
    await user.click(within(dialog()).getByRole("button", { name: "Next" }))
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("Type a name for the bot first.")
    await user.type(within(dialog()).getByRole("textbox", { name: "Bot name on this computer" }), "a;b")
    await user.click(within(dialog()).getByRole("button", { name: "Next" }))
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("without spaces")
    expect(within(dialog()).queryByLabelText("Bot token")).not.toBeInTheDocument()
  })

  it("says a name with a bot already will have its token replaced", async () => {
    const user = openFromTools()
    await screen.findByText("sales")
    await user.click(screen.getByRole("button", { name: "Add a bot" }))
    await user.type(within(dialog()).getByRole("textbox", { name: "Bot name on this computer" }), "sales")
    expect(within(dialog()).getByText(/already has a bot/)).toBeInTheDocument()
  })

  it("blocks a token of the wrong shape before the tool runs", async () => {
    const connect = vi.spyOn(platform, "botSignIn")
    const user = openFromTools()
    await toToken(user)
    const field = within(dialog()).getByLabelText("Bot token")
    expect(field).toHaveAttribute("type", "password")
    await user.type(field, "AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")
    await user.click(within(dialog()).getByRole("button", { name: "Connect bot" }))
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("123456789:AAH")
    expect(connect).not.toHaveBeenCalled()
  })

  it("hands the token over once, empties the field and says which bot is connected", async () => {
    const connect = vi
      .spyOn(platform, "botSignIn")
      .mockResolvedValue({ outcome: "connected", name: "Helper", username: "helper_bot" })
    const user = openFromTools()
    await toToken(user)
    await user.type(within(dialog()).getByLabelText("Bot token"), ` ${TOKEN} `)
    await user.click(within(dialog()).getByRole("button", { name: "Connect bot" }))
    expect(connect).toHaveBeenCalledWith("tg", "support", TOKEN, {})
    expect(await within(dialog()).findByText("Bot @helper_bot is connected.")).toBeInTheDocument()
    expect(within(dialog()).getByText(/tg support bot me/)).toBeInTheDocument()
    expect(JSON.stringify(useBotSignIn.getState())).not.toContain("AAHdqTcv")
    await user.click(within(dialog()).getByRole("button", { name: "Done" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("stays on the token step with the tool's reason when the messenger refuses the token", async () => {
    vi.spyOn(platform, "botSignIn").mockResolvedValue({
      outcome: "failed",
      message: "Telegram did not accept this bot token (Unauthorized)",
      code: "authentication_error",
      reason: "auth.failed",
    })
    const user = openFromTools()
    await toToken(user)
    await user.type(within(dialog()).getByLabelText("Bot token"), TOKEN)
    await user.click(within(dialog()).getByRole("button", { name: "Connect bot" }))
    const alert = await within(dialog()).findByRole("alert")
    expect(alert).toHaveTextContent("Telegram did not accept this token")
    expect(within(dialog()).getByLabelText("Bot token")).toHaveValue("")
    expect(within(dialog()).getByRole("button", { name: "Connect bot" })).toBeEnabled()
  })

  it("asks WhatsApp's ids beside the token and sends them as typed", async () => {
    const connect = vi
      .spyOn(platform, "botSignIn")
      .mockResolvedValue({ outcome: "connected", name: "Test Number", username: null })
    vi.spyOn(platform, "listBots").mockResolvedValue([])
    const user = openFromTools("wa")
    await toToken(user, "shop")
    await user.type(within(dialog()).getByLabelText("Bot token"), "EAAGm0PX4ZCpsBAKZCZAZBZBk1fDm7")
    await user.click(within(dialog()).getByRole("button", { name: "Connect bot" }))
    expect(within(dialog()).getAllByRole("alert")[0]).toHaveTextContent("Paste the Phone number ID first.")
    expect(connect).not.toHaveBeenCalled()
    await user.type(within(dialog()).getByRole("textbox", { name: "Phone number ID" }), "100000000000001")
    await user.type(within(dialog()).getByRole("textbox", { name: "WhatsApp Business Account ID" }), "200000000000002")
    await user.click(within(dialog()).getByRole("button", { name: "Connect bot" }))
    expect(connect).toHaveBeenCalledWith("wa", "shop", "EAAGm0PX4ZCpsBAKZCZAZBZBk1fDm7", {
      phone_number_id: "100000000000001",
      waba_id: "200000000000002",
    })
    expect(await within(dialog()).findByText("Bot Test Number is connected.")).toBeInTheDocument()
  })
})
