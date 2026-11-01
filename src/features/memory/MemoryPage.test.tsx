import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryPage } from "./MemoryPage"
import { useMemory } from "./store"

beforeEach(() => useMemory.setState(useMemory.getInitialState(), true))

const rack = () => screen.findByRole("region", { name: "Memories, facts and actions" }, { timeout: 4000 })
const row = (text: RegExp) => screen.getByRole("button", { name: text }).closest(".border-t") as HTMLElement

describe("Memory", () => {
  it("opens on what waits for review, and a confirmed row turns green where it is", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    expect(screen.getByRole("radio", { name: /Review/ })).toBeChecked()
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(2)

    const kai = row(/Kai Sample prefers calls on Friday/)
    await user.click(within(kai).getByRole("button", { name: "Confirm" }))
    await waitFor(() => expect(within(kai).getByRole("img", { name: "In use" })).toBeInTheDocument())
    expect(row(/Kai Sample prefers calls on Friday/)).toBe(kai)

    await user.click(screen.getByRole("radio", { name: /In use/ }))
    await user.click(screen.getByRole("radio", { name: /Review/ }))
    expect(screen.queryByRole("button", { name: /Kai Sample prefers calls on Friday/ })).not.toBeInTheDocument()
  })

  it("shows what a memory rests on and lists exactly what Forget erases", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /Ana Ruiz is moving to Valencia/ }))
    expect(await screen.findByText(/We are moving in December/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Forget…" }))
    const dialog = screen.getByRole("dialog", { name: "Forget this memory?" })
    expect(dialog).toHaveTextContent("memory:40")
    expect(dialog).toHaveTextContent("Its 2 links to the sources it rests on")
    expect(dialog).toHaveTextContent("Backups of the store made before now still hold it")
    expect(dialog).toHaveTextContent("source of any other memory or fact that cites it")
    expect(within(dialog).getByRole("button", { name: "Discard instead" })).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Forget" }))
    await waitFor(() => expect(screen.queryByRole("button", { name: /Ana Ruiz is moving/ })).not.toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it("writes a correction as the owner's and keeps the old one as replaced", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("radio", { name: /In use/ }))
    await user.click(screen.getByRole("button", { name: /You want reminders in the morning/ }))
    await user.click(screen.getByRole("button", { name: "Correct" }))
    const box = screen.getByRole("textbox", { name: "What is true instead" })
    await user.clear(box)
    await user.type(box, "You want reminders before 10:00.")
    await user.click(screen.getByRole("button", { name: "Save correction" }))

    expect(await screen.findByRole("button", { name: /You want reminders before 10:00/ })).toBeInTheDocument()
    const old = row(/You want reminders in the morning/)
    expect(within(old).getByRole("img", { name: "Replaced" })).toBeInTheDocument()
  })

  it("filters by who an entry is about, typed or picked", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("radio", { name: /All/ }))
    await user.type(screen.getByRole("combobox", { name: "About" }), "harb")
    const rows = within(await rack()).getAllByRole("button", { expanded: false })
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/Harbour launch moves/),
      expect.stringMatching(/Project Harbour this week/),
    ])
  })

  it("names what a row is about and keeps who wrote it for the opened row", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    // The mock store outlives each test: the first one confirmed Kai's memory.
    await user.click(screen.getByRole("radio", { name: /All/ }))
    const kai = row(/Kai Sample prefers calls on Friday/)
    expect(kai).toHaveTextContent(/Kai Sample\s*·\s*Preference/)
    expect(kai).not.toHaveTextContent("claude-code")
    await user.click(screen.getByRole("button", { name: /Kai Sample prefers calls on Friday/ }))
    expect(await within(kai).findByText("claude-code")).toBeInTheDocument()
  })

  it("corrects the text where it stands when the opened text is clicked, and Escape puts it back", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    const harbour = screen.getByRole("button", { name: /Harbour launch moves/ })
    await user.click(harbour)
    await user.click(screen.getByText(/Harbour launch moves/))
    const box = screen.getByRole("textbox", { name: "What is true instead" })
    expect(box).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText(/Harbour launch moves/)).toBeInTheDocument()
  })

  it("shows an agent's findings and creates only the ticked ones", async () => {
    const user = userEvent.setup()
    render(<MemoryPage />)
    await rack()
    await user.click(screen.getByRole("button", { name: /2 facts and 2 tasks to review/ }))
    expect(screen.getByText("What Approve creates in Northbridge Bench")).toBeInTheDocument()
    const ask = screen.getByRole("checkbox", { name: /Ask Tom Becker for read access/ })
    await user.click(ask)
    expect(screen.getByText(/creates the 3 ticked ones in Northbridge Bench/)).toBeInTheDocument()

    const batch = row(/2 facts and 2 tasks to review/)
    await user.click(within(batch).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(within(batch).getAllByText(/^Created/)).toHaveLength(3), { timeout: 3000 })
    expect(within(batch).getByText(/^Rejected/)).toBeInTheDocument()
  })
})
