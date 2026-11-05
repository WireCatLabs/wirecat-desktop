import { describe, expect, it } from "vitest"
import { failureOf } from "./failure"

describe("failureOf", () => {
  it("keeps the reason Rust gave", () => {
    const disk = { reason: "diskFull", folder: "~/Downloads", detail: "No space left on device (os error 28)" }
    expect(failureOf(disk)).toEqual(disk)
  })

  it.each([
    ["error sending request for url (https://github.com/x/latest.json)", "offline"],
    ["dns error: failed to lookup address information", "offline"],
    ["operation timed out", "offline"],
    ["The download stopped: connection reset", "offline"],
    ["Download request failed with status: 403 Forbidden", "server"],
    ["Download request failed with status: 503 Service Unavailable", "server"],
    ["Could not fetch a valid release JSON from the remote", "server"],
    ["Download request failed with status: 404 Not Found", "other"],
    ["invalid updater binary format", "other"],
  ])("reads the self-update plugin's text %j as %s", (text, reason) => {
    expect(failureOf(new Error(text))).toEqual({ reason, detail: text })
  })
})
