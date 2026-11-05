import { describe, expect, it } from "vitest"
import { checkPhone, formatPhone, phoneTyped } from "./phone"

describe("a phone number typed for Telegram", () => {
  it("keeps only digits and a leading plus, as typed or pasted", () => {
    expect(phoneTyped("+34 612-345 678")).toBe("+34612345678")
    expect(phoneTyped("(612) 345.678")).toBe("612345678")
    expect(phoneTyped("+34abc6+12")).toBe("+34612")
    expect(phoneTyped("  +7 (912) 345-67-89 ")).toBe("+79123456789")
    expect(phoneTyped("tel:")).toBe("")
    expect(phoneTyped("Phone: +34 612")).toBe("+34612")
  })

  it("accepts 8 to 15 digits with the country code", () => {
    expect(checkPhone("+34 612 345 678")).toEqual({ value: "+34612345678", problem: null })
    expect(checkPhone("0034 612 345 678")).toEqual({ value: "+34612345678", problem: null })
    expect(checkPhone("+12345678").problem).toBe(null)
    expect(checkPhone("+123456789012345").problem).toBe(null)
  })

  it("says what is wrong with a number Telegram could not take", () => {
    expect(checkPhone(" ").problem).toBe("empty")
    expect(checkPhone("+").problem).toBe("empty")
    expect(checkPhone("612 345 678").problem).toBe("noCountry")
    expect(checkPhone("+0612345678").problem).toBe("zeroCountry")
    expect(checkPhone("+3461234")).toMatchObject({ problem: "short", digits: 7 })
    expect(checkPhone("+1234567890123456")).toMatchObject({ problem: "long", digits: 16 })
  })

  it("shows the country code apart and the rest in groups to read back", () => {
    expect(formatPhone("+34612345678")).toBe("+34 612 345 678")
    expect(formatPhone("+79123456789")).toBe("+7 912 345 6789")
    expect(formatPhone("+12025550123")).toBe("+1 202 555 0123")
    expect(formatPhone("+380501234567")).toBe("+380 501 234 567")
    expect(formatPhone("+447911123456")).toBe("+44 791 112 3456")
  })
})
