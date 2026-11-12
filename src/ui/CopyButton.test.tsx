import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CopyButton } from "./CopyButton"

const clipboard = (writeText: () => Promise<void>) => Object.assign(navigator, { clipboard: { writeText } })

describe("CopyButton", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("says a refused copy failed, aloud too, and keeps saying it", async () => {
    vi.useFakeTimers()
    clipboard(() => Promise.reject(new Error("denied")))
    const onCopied = vi.fn()
    render(<CopyButton value="x" label="Copy the link" onCopied={onCopied} />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy the link" })))
    expect(screen.getByRole("button", { name: "Could not copy" })).toBeInTheDocument()
    expect(screen.getByText(/Select the text and copy it by hand/)).toBeInTheDocument()
    expect(screen.queryByText("Copied to the clipboard")).toBeNull()
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole("button", { name: "Could not copy" })).toBeInTheDocument()
    expect(onCopied).not.toHaveBeenCalled()
  })

  it("as a text button, shows Copied in its words, then its own words again", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    clipboard(writeText)
    const onCopied = vi.fn()
    render(<CopyButton value="prompt" label="Copy prompt" text="Copy prompt" onCopied={onCopied} />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy prompt" })))
    expect(writeText).toHaveBeenCalledWith("prompt")
    expect(onCopied).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Copied" })).toHaveTextContent("Copied")
    act(() => vi.advanceTimersByTime(1600))
    expect(screen.getByRole("button", { name: "Copy prompt" })).toBeInTheDocument()
  })

  it("as a text button, says a refused copy failed instead of Copied", async () => {
    clipboard(() => Promise.reject(new Error("denied")))
    render(<CopyButton value="prompt" label="Copy prompt" text="Copy prompt" />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy prompt" })))
    expect(screen.getByRole("button", { name: "Could not copy" })).toHaveTextContent("Could not copy")
  })
})
