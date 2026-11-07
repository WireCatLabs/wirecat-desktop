import { expect, it } from "vitest"
import { render, screen } from "@/testing/render"
import { KeptFolders } from "./KeptFolders"

it("says why a folder that existed before the tool was added stays, with its path", () => {
  render(<KeptFolders paths={["~/.config/google-chrome"]} />)
  expect(screen.getByText(/existed before WireCat added the tool/)).toBeInTheDocument()
  expect(screen.getByText("~/.config/google-chrome")).toBeInTheDocument()
})
