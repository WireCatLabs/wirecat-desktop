import { expect, it } from "vitest"
import { render, screen } from "@/testing/render"
import { ColumnChart } from "./charts"

it("reads whole numbers on the axis of an empty chart, not 0.5", () => {
  const buckets = ["2026-11-10", "2026-11-11"].map((key) => ({ key, values: { tg: 0 }, total: 0 }))
  render(
    <ColumnChart
      title="Messages"
      buckets={buckets}
      series={[{ id: "tg", label: "Telegram", color: "#2a9" }]}
      short={(k) => k}
      long={(k) => k}
      unit={(n) => `${n}`}
    />,
  )
  expect(screen.queryByText("0.5")).not.toBeInTheDocument()
  expect(screen.getByText("1")).toBeInTheDocument()
})
