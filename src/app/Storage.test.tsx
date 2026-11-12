import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, screen, within } from "@/testing/render"
import { App } from "./App"

describe("Storage", () => {
  beforeEach(() => useOnboarding.setState({ status: "done", open: false }))

  it("shows what is in storage, breaks it down, and says what each folder entry is", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const archive = await screen.findByRole("region", { name: "In storage" })
    expect(await within(archive).findByText("15,594")).toBeInTheDocument()
    expect(within(archive).getByText("tg store info")).toBeInTheDocument()
    expect(within(archive).getByRole("table", { name: "By source" })).toHaveTextContent("via tg")
    expect(within(archive).getByRole("table", { name: "By source" })).toHaveTextContent("WhatsApp")

    await user.click(within(archive).getByRole("radio", { name: "Chat type" }))
    expect(within(archive).getByRole("table", { name: "By chat type" })).toHaveTextContent("Telegram · Groups")

    for (const more of await screen.findAllByRole("button", { name: /What is in here/ })) {
      await user.click(more)
    }
    const tg = await screen.findByRole("list", { name: "What Telegram keeps" })
    expect(within(tg).getByText(/Credentials: size only/)).toBeInTheDocument()
  })

  it("shows the store file in its folder, never opening it", async () => {
    const open = vi.spyOn(platform, "openFolder")
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const show = await screen.findByRole("button", {
      name: "Show ~/.local/share/WireCat/wirecat.db in the file manager",
    })
    await user.click(show)
    expect(open).toHaveBeenCalledWith("shared", expect.any(String), "wirecat.db")
    open.mockRestore()
  })

  it("shows the tables of one kind of data, with the kind in its column", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    await screen.findByRole("table", { name: "Tables" })
    const groups = screen.getByRole("group", { name: "Show tables" })
    await user.click(within(groups).getByRole("radio", { name: /^Mail/ }))
    const tables = screen.getByRole("table", { name: "Tables" })
    const names = within(tables)
      .getAllByRole("rowheader")
      .map((r) => r.textContent)
    expect(names).toEqual(["email_recipients", "email_threads", "emails"])
    expect(within(tables).getAllByRole("cell", { name: "Mail" })).toHaveLength(3)
  })

  it("lists the database's tables, measures their sizes and checks its health", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Storage/ }))

    const tables = await screen.findByRole("table", { name: "Tables" })
    expect(within(tables).getByRole("rowheader", { name: "messages" })).toBeInTheDocument()
    expect(screen.getByText(/Search index tables \(30\)/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Search index tables \(30\)/ }))
    expect(await screen.findByRole("navigation", { name: "Search index tables" })).toHaveTextContent("1–30 of 30")
    expect(screen.getByText(/The backup job has not finished since/)).toBeInTheDocument()

    await user.type(screen.getByRole("searchbox", { name: "Find a table" }), "email")
    expect(within(screen.getByRole("table", { name: "Tables" })).getAllByRole("row")).toHaveLength(4)

    await user.click(screen.getByRole("button", { name: "Measure sizes" }))
    expect(await screen.findByText(/Measured in/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Check health" }))
    expect(await screen.findByText("No problems found")).toBeInTheDocument()
  })

  it("speaks Russian, counts included", async () => {
    useLanguage.setState({ choice: "ru" })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: /Хранилище/ }))

    const archive = await screen.findByRole("region", { name: "В хранилище" })
    const bySource = await within(archive).findByRole("table", { name: "По источникам" })
    expect(bySource).toHaveTextContent("через tg · 2 аккаунта")
    expect(screen.getByRole("button", { name: "Сделать копию" })).toBeInTheDocument()
  })
})
