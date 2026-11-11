import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDigestBook, useDigests } from "@/features/digests"
import { editorMessages } from "@/features/digests/messages-editors"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  useDigestBook.setState({
    book: null,
    error: null,
    busy: {},
    failed: null,
    remembered: null,
    open: null,
    backfill: null,
  })
  useDigests.setState({ name: undefined, days: null, error: null, reading: false, shown: {} })
  vi.spyOn(platform, "listenLinks").mockResolvedValue()
})

afterEach(() => vi.restoreAllMocks())

async function openCard(name: string) {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: /Digests/ }))
  await user.click(await screen.findByRole("button", { name: "Open Morning digest" }, { timeout: 4000 }))
  const card = await screen.findByRole("region", { name })
  return { user, card }
}

const ready = { state: "ready" as const, chars: 0, limit: 4000, updatedAt: null, updatedBy: null, history: 0 }

describe("what the digest collects", () => {
  it("saves the brief through memo, counts it against the limit and undoes the change", async () => {
    const save = vi.spyOn(platform, "digestBriefSave")
    const undo = vi.spyOn(platform, "digestBriefUndo")
    const { user, card } = await openCard("What to collect")
    expect(card).toHaveTextContent("where the two differ, yours win")
    const brief = await within(card).findByRole("textbox", { name: "Your instructions for this digest" })
    expect(within(card).getByRole("button", { name: "Undo last change" })).toBeDisabled()
    expect(brief).toHaveValue(editorMessages.en.brief.template.daily)
    await user.clear(brief)
    await user.type(brief, "Only HRB.")
    expect(card).toHaveTextContent("9 / 4000")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(save).toHaveBeenCalledWith("Only HRB.", undefined)
    const back = within(card).getByRole("button", { name: "Undo last change" })
    await waitFor(() => expect(back).toBeEnabled())
    await user.click(back)
    expect(undo).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(brief).toHaveValue(editorMessages.en.brief.template.daily))
  }, 15000)

  it("shows memo's own words when it refuses the brief", async () => {
    vi.spyOn(platform, "digestBrief").mockResolvedValue({ ...ready, body: null })
    vi.spyOn(platform, "digestBriefSave").mockRejectedValue(
      new Error("only the owner changes the digest brief, not an agent"),
    )
    const { user, card } = await openCard("What to collect")
    await user.type(await within(card).findByRole("textbox"), "Skip newsletters.")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Not saved: only the owner changes the digest brief, not an agent",
    )
  }, 15000)

  it("stops a brief over the limit before it reaches memo", async () => {
    vi.spyOn(platform, "digestBrief").mockResolvedValue({ ...ready, body: "x".repeat(4000), chars: 4000 })
    const save = vi.spyOn(platform, "digestBriefSave")
    const { user, card } = await openCard("What to collect")
    const brief = await within(card).findByRole("textbox")
    await user.type(brief, "y")
    expect(card).toHaveTextContent("4001 / 4000")
    expect(brief).toHaveAccessibleDescription(/At most 4000 characters/)
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(save).not.toHaveBeenCalled()
    expect(brief).toHaveFocus()
  }, 15000)

  it("keeps Save clickable on an unchanged or empty brief and says why at the field", async () => {
    vi.spyOn(platform, "digestBrief").mockResolvedValue({ ...ready, body: "News only", chars: 9 })
    const save = vi.spyOn(platform, "digestBriefSave")
    const { user, card } = await openCard("What to collect")
    const brief = await within(card).findByRole("textbox")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(brief).toHaveAccessibleDescription(/Nothing is changed yet/)
    await user.clear(brief)
    expect(brief).toHaveAccessibleDescription(/Write what to collect first/)
    expect(save).not.toHaveBeenCalled()
  }, 15000)

  it("asks for a memo update when this memo has no brief", async () => {
    vi.spyOn(platform, "digestBrief").mockResolvedValue({ state: "unsupported" })
    const { card } = await openCard("What to collect")
    expect(await within(card).findByText(/Update Memo to write them/)).toBeInTheDocument()
    expect(within(card).queryByRole("textbox")).not.toBeInTheDocument()
  }, 15000)
})

describe("how the digest looks", () => {
  it("previews the unsaved draft, saves it, and resets to memo's template", async () => {
    const preview = vi.spyOn(platform, "digestTemplatePreview")
    const save = vi.spyOn(platform, "digestTemplateSave")
    const reset = vi.spyOn(platform, "digestTemplateReset")
    const { user, card } = await openCard("How it looks")
    const body = await within(card).findByRole("textbox", { name: "Template" })
    expect(card).toHaveTextContent("The built-in template")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(body).toHaveAccessibleDescription("Nothing is changed yet.")
    expect(body).toHaveFocus()
    await user.clear(body)
    expect(body).toHaveAccessibleDescription(/The template is empty/)
    expect(save).not.toHaveBeenCalled()
    await user.type(body, "Hello {{{{ summary }}")
    await user.click(within(card).getByRole("button", { name: "Preview" }))
    expect(preview).toHaveBeenCalledWith("telegram", "en", "Hello {{ summary }}", undefined)
    const shown = await within(card).findByRole("region", { name: "What would be sent" })
    expect(shown).toHaveTextContent("Hello Three replies wait for you")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(save).toHaveBeenCalledWith("telegram", "en", "Hello {{ summary }}", undefined)
    expect(await within(card).findByText("Your own template")).toBeInTheDocument()
    await user.click(within(card).getByRole("button", { name: "Reset to default" }))
    expect(reset).toHaveBeenCalledWith("telegram", "en", undefined)
    expect(await within(card).findByText("The built-in template")).toBeInTheDocument()
  }, 15000)

  it("reads the template of the channel and language picked", async () => {
    const read = vi.spyOn(platform, "digestTemplate")
    const { user, card } = await openCard("How it looks")
    await within(card).findByRole("textbox", { name: "Template" })
    await user.click(within(card).getByRole("combobox", { name: "Channel" }))
    await user.click(await screen.findByRole("option", { name: "Email" }))
    await waitFor(() => expect(read).toHaveBeenLastCalledWith("email", "en", undefined))
    await waitFor(() =>
      expect((within(card).getByRole("textbox", { name: "Template" }) as HTMLTextAreaElement).value).toContain(
        '<div style="font-family',
      ),
    )
  }, 15000)

  it("shows memo's check when it refuses a template", async () => {
    vi.spyOn(platform, "digestTemplateSave").mockRejectedValue(
      new Error('the template was not saved — sample: it does not render: tag "for" not closed'),
    )
    const { user, card } = await openCard("How it looks")
    await user.type(await within(card).findByRole("textbox", { name: "Template" }), "{{%")
    await user.click(within(card).getByRole("button", { name: "Save" }))
    expect(await within(card).findByRole("alert")).toHaveTextContent('tag "for" not closed')
  }, 15000)

  it("asks for a memo update when this memo has no templates", async () => {
    vi.spyOn(platform, "digestTemplate").mockResolvedValue({ state: "unsupported" })
    const { card } = await openCard("How it looks")
    expect(await within(card).findByText(/Update Memo to edit them/)).toBeInTheDocument()
  }, 15000)
})
