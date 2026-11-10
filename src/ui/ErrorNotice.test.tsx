import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { ErrorNotice } from "./ErrorNotice"

it("announces a warning politely and an error at once", () => {
  render(
    <>
      <ErrorNotice tone="warn">Read from the work profile</ErrorNotice>
      <ErrorNotice>Could not read memory</ErrorNotice>
    </>,
  )
  expect(screen.getByRole("status")).toHaveTextContent("Read from the work profile")
  expect(screen.getByRole("alert")).toHaveTextContent("Could not read memory")
})
