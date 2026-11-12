import { describe, expect, it } from "vitest"
import { explainFailure, type FailureInput, TOOK_TOO_LONG } from "./signin-failure"

const base: FailureInput = {
  tool: "max",
  profile: "personal",
  message: "",
  code: null,
  at: null,
  otherMethod: false,
  terminal: true,
}
const explain = (f: Partial<FailureInput>) => explainFailure({ ...base, ...f })

describe("explaining a failed sign-in", () => {
  it("sends a tool too old for the window's sign-in to its update, with the terminal meanwhile (RISK-18)", () => {
    expect(explain({ code: "needs_update" })).toEqual({
      reason: "needsUpdate",
      primary: "update",
      fallback: "terminal",
    })
    expect(explain({ message: "error: unknown option '--answer-stdin'" }).reason).not.toBe("needsUpdate")
    expect(explain({ code: "needs_update", terminal: false }).fallback).toBeNull()
  })

  it("offers a new code, then the other way in, when the QR code expired", () => {
    const max = explain({
      message: "the QR code expired before it was scanned — run the command again",
      code: "timeout",
      otherMethod: true,
    })
    expect(max).toEqual({ reason: "qrExpired", primary: "retry", fallback: "otherMethod" })
    const wa = explain({ tool: "wa", message: "the login code expired before the phone confirmed it", code: "timeout" })
    expect(wa).toEqual({ reason: "qrExpired", primary: "retry", fallback: null })
  })

  it("sends a WhatsApp login held by its background service to the tool's page, with the stop command to copy", () => {
    const held = explain({
      tool: "wa",
      profile: "work",
      message: "this WhatsApp login is in use by wa work serve; WhatsApp allows one connection per linked device",
      code: "provider_unavailable",
      reason: "device.in-use",
    })
    expect(held).toEqual({ reason: "loginInUse", primary: "toolPage", fallback: "copy", copy: "wa work server stop" })
  })

  it("reads Zoom's missing Public Client ID from its words, and only for Zoom", () => {
    const zm = "run zm config set zoom.client_id <Public Client ID> first, or set ZM_ZOOM_CLIENT_ID"
    expect(explain({ tool: "zm", message: zm, code: "configuration_error" }).reason).toBe("clientIdMissing")
    expect(explain({ tool: "max", message: zm }).reason).toBe("unknown")
  })

  it("tells a browser that never came back from a page that was declined", () => {
    expect(
      explain({ tool: "zm", message: "Zoom login timed out", code: "authentication_error", at: "browser" }).reason,
    ).toBe("browserNoReturn")
    expect(explain({ tool: "zm", message: "Zoom login was not approved", at: "browser" }).reason).toBe("denied")
    expect(explain({ tool: "drive", message: "access_denied", at: "browser" }).reason).toBe("denied")
  })

  it("names the app's own time limit by the step it ended on", () => {
    expect(explain({ code: TOOK_TOO_LONG, at: "browser" }).reason).toBe("browserNoReturn")
    expect(explain({ code: TOOK_TOO_LONG, at: "scan" }).reason).toBe("qrExpired")
    expect(explain({ code: TOOK_TOO_LONG, at: "answer" }).reason).toBe("timeout")
  })

  it("says the network is down without offering another method, which would fail the same way", () => {
    const down = explain({ message: "getaddrinfo ENOTFOUND api.oneme.ru", otherMethod: true })
    expect(down).toEqual({ reason: "network", primary: "retry", fallback: null })
  })

  it("tells a cancelled run, a silent end and anything unknown apart, with a fallback for each", () => {
    expect(explain({ code: "cancelled", message: "the input closed before the answer came" }).reason).toBe("cancelled")
    expect(explain({ code: "ended" })).toEqual({ reason: "ended", primary: "retry", fallback: "terminal" })
    expect(explain({ message: "something new" })).toEqual({ reason: "unknown", primary: "retry", fallback: "report" })
    expect(explain({ message: "something new", otherMethod: true }).fallback).toBe("otherMethod")
  })

  it("reads Zoom's missing app from its reason, and from the text of an older zm", () => {
    const missing = { tool: "zm", reason: "zoom.client-id-missing", message: "no app" }
    expect(explain(missing).reason).toBe("clientIdMissing")
    expect(explain({ tool: "zm", message: "run zm config set zoom.client_id <id> first" }).reason).toBe(
      "clientIdMissing",
    )
  })

  it("explains mail's refusals by reason, with the page that fixes them", () => {
    expect(explain({ tool: "email", reason: "mail.app-password-required", message: "x" })).toEqual({
      reason: "mailAppPassword",
      primary: "openPage",
      fallback: "retry",
      page: "https://myaccount.google.com/apppasswords",
    })
    const yandex = "https://yandex.ru/support/id/ru/authorization/app-passwords"
    expect(explain({ tool: "email", reason: "mail.app-password-required", message: "x", page: yandex }).page).toBe(
      yandex,
    )
    expect(explain({ tool: "email", reason: "mail.imap-disabled", message: "x" }).reason).toBe("mailImapOff")
    expect(explain({ tool: "email", reason: "mail.login-refused", message: "x" })).toEqual({
      reason: "mailRefused",
      primary: "retry",
      fallback: null,
    })
    expect(
      explain({ tool: "email", reason: "mail.host-unreachable", code: "network_error", message: "x" }).reason,
    ).toBe("mailUnreachable")
  })

  it("explains Drive's signed-out, expired and rate-limited answers", () => {
    expect(explain({ tool: "drive", reason: "oauth.missing", message: "x" }).reason).toBe("signedOut")
    expect(explain({ tool: "drive", reason: "oauth.expired", message: "x" }).reason).toBe("signInExpired")
    expect(
      explain({ tool: "bitrix", reason: "oauth.timeout", code: "timeout", message: "Bitrix24 sign-in timed out" })
        .reason,
    ).toBe("browserNoReturn")
    expect(explain({ tool: "drive", reason: "provider.rate-limited", message: "x" }).reason).toBe("rateLimited")
  })
})
