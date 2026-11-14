import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { DocumentSource } from "@/platform/bindings"
import { render, screen } from "@/testing/render"
import { FolderTree } from "./FolderTree"
import { useDocuments } from "./store"

const SOURCES: DocumentSource[] = [
  {
    provider: "google-drive",
    source: "google-drive:ana@example.org",
    label: "Google Drive · ana@example.org",
    name: "ana@example.org",
    count: 9,
    loose: 1,
    folders: [
      { path: "Projects", name: "Projects", depth: 1, count: 5 },
      { path: "Projects/Acme", name: "Acme", depth: 2, count: 3 },
    ],
  },
  { provider: "notes", source: "notes:archive", label: "archive", name: "archive", count: 3, loose: 3, folders: [] },
]

describe("The account and folder chip", () => {
  it("opens the tree over the page, goes down into an account, and names the folder chosen", async () => {
    const user = userEvent.setup()
    render(<FolderTree sources={SOURCES} />)
    const chip = screen.getByRole("button", { name: "Account" })
    expect(screen.queryByRole("tree")).not.toBeInTheDocument()

    await user.click(chip)
    expect(screen.getByRole("treeitem", { name: /All documents/ })).toHaveFocus()
    await user.click(screen.getByText("ana@example.org"))
    // An account with folders stays open to go on down.
    await user.click(screen.getByText("Projects"))
    await user.click(screen.getByText("Acme"))
    expect(screen.queryByRole("tree")).not.toBeInTheDocument()
    expect(useDocuments.getState().query).toBe('source:"google-drive:ana@example.org" folder:"Projects/Acme"')
    expect(screen.getByRole("button", { name: /Account: ana@example\.org \/ Projects \/ Acme/ })).toHaveFocus()
  })
})
