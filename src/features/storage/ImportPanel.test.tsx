import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { RECORDS_TOO_OLD } from "@/platform/records-schemas"
import { render, screen } from "@/testing/render"
import { ImportPanel } from "./ImportPanel"
import { useImport } from "./import-store"

const refused = {
  kind: "receipt" as const,
  receipt: {
    created: 3,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    refused: 1,
    proposed: [],
    errors: [
      {
        code: "field.shape",
        message: "total is a decimal number",
        key: "invoice:INV-7",
        place: { line: 8, column: "total" },
      },
    ],
    waiting: [],
    flagged: [],
    unmatched: [],
    ignored: [],
  },
}

describe("Importing records from a file", () => {
  beforeEach(() => {
    useImport.setState({
      types: undefined,
      kind: null,
      account: "",
      file: null,
      busy: null,
      saved: null,
      checked: null,
      imported: null,
      error: null,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it("saves the chosen type's template where the owner picked", async () => {
    const user = userEvent.setup()
    render(<ImportPanel />)
    await user.click(await screen.findByRole("button", { name: "Download template" }))
    expect(await screen.findByText(/Template saved to .*invoice-template\.csv/)).toBeInTheDocument()
  })

  it("imports only after a check, with the source the owner typed", async () => {
    const run = vi.spyOn(platform, "recordRun")
    const user = userEvent.setup()
    render(<ImportPanel />)
    await user.click(await screen.findByRole("button", { name: "Choose file" }))
    await screen.findByText(/invoices-2026\.csv/)
    const check = screen.getByRole("button", { name: "Check" })
    await user.click(check)
    expect(screen.getByText(/Type the source first/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Import" }))
    expect(run).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText("Source"), "sheet:rentals")
    await user.click(check)
    expect(await screen.findByText(/found nothing wrong/)).toBeInTheDocument()
    expect(run).toHaveBeenLastCalledWith("invoice", "sheet:rentals", true)

    await user.click(screen.getByRole("button", { name: "Import" }))
    expect(await screen.findByText("Imported.")).toBeInTheDocument()
    expect(run).toHaveBeenLastCalledWith("invoice", "sheet:rentals", false)
  })

  it("names each refused record by its line and column", async () => {
    vi.spyOn(platform, "recordRun").mockResolvedValue(refused)
    const user = userEvent.setup()
    render(<ImportPanel />)
    await user.click(await screen.findByRole("button", { name: "Choose file" }))
    await screen.findByText(/invoices-2026\.csv/)
    await user.type(screen.getByLabelText("Source"), "sheet:rentals")
    await user.click(await screen.findByRole("button", { name: "Check" }))
    expect(await screen.findByText(/1 record is refused/)).toBeInTheDocument()
    expect(screen.getByText("line 8, total")).toBeInTheDocument()
    expect(screen.getByText("total is a decimal number")).toBeInTheDocument()
  })

  it("asks for an update when memo cannot import files", async () => {
    vi.spyOn(platform, "recordTypes").mockRejectedValue(new Error(RECORDS_TOO_OLD))
    render(<ImportPanel />)
    expect(await screen.findByText(/This needs a newer Memo than/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update Memo" })).toBeInTheDocument()
  })
})
