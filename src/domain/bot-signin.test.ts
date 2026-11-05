import { describe, expect, it } from "vitest"
import { botCause, botCommand, botHandle, fieldProblem, tokenProblem } from "./bot-signin"

const TG = "12345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"

describe("tokenProblem", () => {
  it("accepts a Telegram token as BotFather gives it, with the spaces of a paste around it", () => {
    expect(tokenProblem("telegram", ` ${TG}\n`)).toBeNull()
  })

  it("refuses a Telegram token without its bot id or with a short key", () => {
    expect(tokenProblem("telegram", "AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")).toBe("shape")
    expect(tokenProblem("telegram", "12ab:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")).toBe("shape")
    expect(tokenProblem("telegram", "123:short")).toBe("shape")
  })

  it("refuses a paste that carries more than the token", () => {
    expect(tokenProblem("telegram", `Use this token: ${TG}`)).toBe("spaces")
    expect(tokenProblem("opaque", "f9LHodD0cOKbEJgy\tW3NlrDqWsyUh0Gbk")).toBe("spaces")
  })

  it("asks for a token when nothing was pasted", () => {
    expect(tokenProblem("opaque", "   ")).toBe("empty")
  })

  it("accepts any long one-line token where the messenger documents no shape", () => {
    expect(tokenProblem("opaque", "EAAGm0PX4ZCpsBAKZCZAZBZBk1fDm7")).toBeNull()
    expect(tokenProblem("opaque", "short")).toBe("shape")
    expect(tokenProblem("opaque", "токен-токен-токен-токен")).toBe("shape")
  })
})

describe("fieldProblem", () => {
  it("takes Meta's ids as digits only", () => {
    expect(fieldProblem(" 100000000000001 ")).toBeNull()
    expect(fieldProblem("")).toBe("empty")
    expect(fieldProblem("1e5")).toBe("digits")
    expect(fieldProblem('1" --x')).toBe("digits")
  })
})

describe("botCause", () => {
  it("reads the tool's code and reason into what the owner can do", () => {
    expect(botCause({ code: "authentication_error", reason: "auth.failed" })).toBe("refused")
    expect(botCause({ code: "configuration_error", reason: "config.invalid" })).toBe("settings")
    expect(botCause({ code: "not_found", reason: null })).toBe("settings")
    expect(botCause({ code: "needs_update", reason: null })).toBe("update")
    expect(botCause({ code: "timeout", reason: null })).toBe("timeout")
    expect(botCause({ code: null, reason: null })).toBe("other")
  })
})

describe("botHandle and botCommand", () => {
  it("names the bot by its username when it has one", () => {
    expect(botHandle({ name: "Helper", username: "helper_bot" })).toBe("@helper_bot")
    expect(botHandle({ name: "Test Number", username: null })).toBe("Test Number")
  })

  it("writes the command the owner types for this bot", () => {
    expect(botCommand("tg", "sales", "me")).toBe("tg sales bot me")
  })
})
