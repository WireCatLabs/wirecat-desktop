import { describe, expect, it } from "vitest"
import { keyringFallback } from "./signin-notes"

const LINE =
  "could not reach the OS keyring — it may be locked, or no keyring service is running (Platform failure: DBus " +
  "error: The name org.freedesktop.secrets was not provided by any .service files); using " +
  "~/.config/tg-cli/credentials.json instead, readable only by you"

describe("keyringFallback", () => {
  it("reads the file the tool used instead of the keyring, and the error behind it", () => {
    expect(keyringFallback(LINE)).toEqual({
      path: "~/.config/tg-cli/credentials.json",
      detail: "Platform failure: DBus error: The name org.freedesktop.secrets was not provided by any .service files",
    })
  })

  it("keeps a path with spaces and an error with parentheses of its own", () => {
    const line =
      "could not reach the OS keyring — it may be locked (Error (code 5)); using C:\\Users\\A B\\tg\\credentials.json instead"
    expect(keyringFallback(line)).toEqual({ path: "C:\\Users\\A B\\tg\\credentials.json", detail: "Error (code 5)" })
  })

  it("reads a line without the error part", () => {
    expect(keyringFallback("could not reach the OS keyring; using ~/x.json instead")).toEqual({
      path: "~/x.json",
      detail: "",
    })
  })

  it("leaves any other line alone", () => {
    expect(keyringFallback("that code was not accepted — try again")).toBeNull()
    expect(keyringFallback("could not reach the OS keyring — it may be locked")).toBeNull()
  })
})
