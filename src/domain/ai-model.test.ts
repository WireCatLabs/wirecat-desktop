import { describe, expect, it } from "vitest"
import { staysHere } from "./ai-model"

describe("staysHere", () => {
  it("keeps pictures here for any server on this computer, not only Ollama", () => {
    expect(staysHere("ollama", null)).toBe(true)
    expect(staysHere("openai", "http://127.0.0.1:8080/v1")).toBe(true)
    expect(staysHere("openai", "http://localhost:1234/v1")).toBe(true)
    expect(staysHere("openai", "http://[::1]:8000/v1")).toBe(true)
  })

  it("sends them away to a server elsewhere", () => {
    expect(staysHere("openai", null)).toBe(false)
    expect(staysHere("openai", "https://openrouter.ai/api/v1")).toBe(false)
    expect(staysHere("anthropic", "http://localhost:1234")).toBe(false)
  })
})
