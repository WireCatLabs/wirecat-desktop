import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen } from "@/testing/render"
import { FileActions } from "./FileActions"
import { useNav } from "./nav"

const REF = "msg:telegram/1001/-2002/77"
const photo = { position: 2, picture: true, saved: false }

describe("A file of a message", () => {
  it("reads a picture with the owner's agent and shows the text under it, as text only", async () => {
    const read = vi.spyOn(platform, "pictureRead").mockResolvedValue({
      state: "read",
      text: "OPEN 9 - 18\n<script>alert(1)</script> https://example.com",
      extractor: "agent:codex/gpt-5",
      replaced: null,
    })
    render(<FileActions messageRef={REF} file={photo} />)

    await userEvent.setup().click(screen.getByRole("button", { name: "Read the picture" }))

    expect(read).toHaveBeenCalledWith(REF, 2)
    expect(await screen.findByText("Read by Codex (gpt-5):")).toBeInTheDocument()
    expect(screen.getByText(/OPEN 9 - 18/)).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
    expect(document.querySelector("script")).toBeNull()
    expect(screen.getByRole("button", { name: "Read the picture" })).toBeEnabled()
  })

  it("says reading pictures is never, and opens that setting", async () => {
    vi.spyOn(platform, "pictureRead").mockRejectedValue(new Error("picture-reading.off"))
    const go = vi.spyOn(useNav.getState(), "go")
    const user = userEvent.setup()
    render(<FileActions messageRef={REF} file={photo} />)

    await user.click(screen.getByRole("button", { name: "Read the picture" }))

    expect(await screen.findByText(/Reading pictures is set to never/)).toBeInTheDocument()
    expect(screen.queryByText("picture-reading.off")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Open Reading pictures" }))
    expect(go).toHaveBeenCalledWith("settings")
  })

  it("names the agent to install when it is missing", async () => {
    vi.spyOn(platform, "pictureRead").mockRejectedValue(new Error("picture-reading.unavailable:codex"))
    render(<FileActions messageRef={REF} file={photo} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Read the picture" }))
    expect(await screen.findByText(/Codex is not installed on this computer\. Install Codex/)).toBeInTheDocument()
  })

  it("asks for a messenger update while none with images read is released", async () => {
    vi.spyOn(platform, "pictureRead").mockResolvedValue({ state: "old", tool: "tg", version: "0.211.0", need: null })
    render(<FileActions messageRef={REF} file={photo} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Read the picture" }))
    expect(await screen.findByRole("button", { name: "Update Telegram" })).toBeInTheDocument()
  })

  it("opens a saved file by its place in the message, and offers no reading of a PDF or of mail", async () => {
    const open = vi.spyOn(platform, "attachmentOpen").mockResolvedValue()
    render(<FileActions messageRef={REF} file={{ position: 1, picture: false, saved: true }} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Open the file" }))
    expect(open).toHaveBeenCalledWith(REF, 1)
    expect(screen.queryByRole("button", { name: "Read the picture" })).toBeNull()

    const { container } = render(<FileActions messageRef="msg:email/a%40b.c/t/1" file={photo} />)
    expect(container).toBeEmptyDOMElement()
  })
})
