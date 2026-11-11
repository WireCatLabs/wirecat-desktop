import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBoardDrag, useSlide } from "./Board"

type Columns = Record<"a" | "b", string[]>

function Harness() {
  const [columns, setColumns] = useState<Columns>({ a: ["one", "two"], b: ["three"] })
  const board = useRef<HTMLDivElement>(null)
  const place = (key: string, to: "a" | "b") =>
    setColumns((c) => ({
      a: [...c.a.filter((k) => k !== key), ...(to === "a" ? [key] : [])],
      b: [...c.b.filter((k) => k !== key), ...(to === "b" ? [key] : [])],
    }))
  const { onPointerDown } = useBoardDrag<"a" | "b">({
    columnOf: (key) => (columns.a.includes(key) ? "a" : "b"),
    onDrop: ({ key, to, copy }) => (copy ? setColumns((c) => ({ ...c, b: [...c.b, `${key} copy`] })) : place(key, to)),
    copyable: true,
  })
  useSlide(board, JSON.stringify(columns))
  return (
    <div ref={board}>
      {(["a", "b"] as const).map((id) => (
        <section key={id} data-column={id}>
          {columns[id].map((key) => (
            <div key={key} data-card={key} onPointerDown={(e) => onPointerDown(e, key)}>
              {key}
            </div>
          ))}
        </section>
      ))}
      <button type="button" onClick={() => place("two", "b")}>
        Move two
      </button>
    </div>
  )
}

const rectOf = (el: HTMLElement) => {
  const column = el.closest<HTMLElement>("[data-column]")
  const left = column?.dataset.column === "b" ? 300 : 0
  const top = el.dataset.card ? 100 * [...(el.parentElement?.children ?? [])].indexOf(el) : 0
  return { left, top, width: 200, height: 90 } as DOMRect
}

describe("useSlide after a drop", () => {
  let slides: { el: Element; from: string }[]

  beforeEach(() => {
    slides = []
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return rectOf(this)
    })
    Element.prototype.animate = vi.fn(function (this: Element, frames: Keyframe[]) {
      if (frames[0]?.transform) slides.push({ el: this, from: String(frames[0].transform) })
      return {} as Animation
    }) as unknown as Element["animate"]
    document.elementsFromPoint = () => [document.querySelector('[data-column="b"]') as Element]
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(Element.prototype, "animate")
  })

  it("settles a card from where the pointer let it go, never from the column it left", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const card = screen.getByText("one")
    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 20, clientY: 20 } },
      { target: card, coords: { clientX: 350, clientY: 120 } },
      { keys: "[/MouseLeft]", target: card, coords: { clientX: 350, clientY: 120 } },
    ])
    expect(screen.getAllByText("one").some((el) => el.closest('[data-column="b"]'))).toBe(true)
    const own = slides.filter((s) => s.el.textContent === "one")
    expect(own.map((s) => s.from)).toEqual(["translate(30px, 0px) rotate(1.2deg)"])
    expect(slides.find((s) => s.el.textContent === "two")?.from).toBe("translate(0px, 100px)")
  })

  it("leaves the card in place when the drop made a copy of it", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const card = screen.getByText("one")
    await user.keyboard("{Alt>}")
    await user.pointer([
      { keys: "[MouseLeft>]", target: card, coords: { clientX: 20, clientY: 20 } },
      { target: card, coords: { clientX: 350, clientY: 120 } },
      { keys: "[/MouseLeft]", target: card, coords: { clientX: 350, clientY: 120 } },
    ])
    await user.keyboard("{/Alt}")
    expect(screen.getByText("one copy")).toBeInTheDocument()
    expect(slides).toEqual([])
  })

  it("still slides a card moved without the pointer from where it stood", () => {
    render(<Harness />)
    act(() => screen.getByRole("button", { name: "Move two" }).click())
    expect(slides.find((s) => s.el.textContent === "two")?.from).toBe("translate(-300px, 0px)")
  })
})
