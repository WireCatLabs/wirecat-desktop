import { readFileSync } from "node:fs"
import { act, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AutoHeight } from "./AutoHeight"
import { Collapse } from "./Collapse"
import { creep, focusInPlace, keepBelow, MOTION, PANEL_MS, paceStep, usePaced } from "./motion"

const reduce = (on: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: on && query.includes("reduce"), media: query }) as MediaQueryList,
  )
}

describe("Collapse", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("keeps closing content on screen until it has folded away, then unmounts it", () => {
    reduce(false)
    const { rerender } = render(<Collapse open>{<p>Details</p>}</Collapse>)
    rerender(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    expect(screen.getByText("Details")).toBeInTheDocument()
    expect(screen.getByText("Details").closest("[data-state]")).toHaveAttribute("inert")
    act(() => vi.advanceTimersByTime(PANEL_MS))
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
  })

  it("mounts new content at once when it opens", () => {
    reduce(false)
    const { rerender } = render(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
    rerender(<Collapse open>{<p>Details</p>}</Collapse>)
    expect(screen.getByText("Details").closest("[data-state]")).toHaveAttribute("data-state", "open")
    expect(screen.getByText("Details").closest("[data-state]")).not.toHaveAttribute("inert")
  })

  it("closes at once under reduced motion", () => {
    reduce(true)
    const { rerender } = render(<Collapse open>{<p>Details</p>}</Collapse>)
    rerender(<Collapse open={false}>{<p>Details</p>}</Collapse>)
    act(() => vi.advanceTimersByTime(0))
    expect(screen.queryByText("Details")).not.toBeInTheDocument()
  })
})

describe("focusInPlace", () => {
  afterEach(() => vi.restoreAllMocks())

  const target = (top: number) => {
    const el = document.createElement("h5")
    el.tabIndex = -1
    document.body.append(el)
    el.getBoundingClientRect = () => ({ top, bottom: top + 20 }) as DOMRect
    el.scrollIntoView = vi.fn()
    return el
  }

  it("focuses without scrolling when the target is already in sight", () => {
    reduce(false)
    const el = target(100)
    const focus = vi.spyOn(el, "focus")
    focusInPlace(el)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(el.scrollIntoView).not.toHaveBeenCalled()
  })

  it("brings an off-screen target into view smoothly, or at once under reduced motion", () => {
    reduce(false)
    const below = target(window.innerHeight + 50)
    focusInPlace(below)
    expect(below.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" })
    reduce(true)
    const again = target(-80)
    focusInPlace(again)
    expect(again.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" })
  })
})

describe("AutoHeight", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("animates only a swap of its content, follows other changes at once, and never animates under reduced motion", () => {
    let notify = () => undefined as void
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          notify = cb
        }
        observe() {}
        disconnect() {}
      },
    )
    let height = 200
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height)
    reduce(false)
    const { container, rerender } = render(<AutoHeight swap="a">step</AutoHeight>)
    const box = container.firstElementChild as HTMLElement
    expect(box.style.height).toBe("200px")

    height = 250
    notify()
    expect(box.style.height).toBe("250px")
    expect(box.style.transition).toBe("")

    rerender(<AutoHeight swap="b">next step</AutoHeight>)
    height = 320
    notify()
    expect(box.style.height).toBe("320px")
    expect(box.style.transition).toContain(`height ${PANEL_MS}ms`)

    reduce(true)
    rerender(<AutoHeight swap="c">last step</AutoHeight>)
    height = 90
    notify()
    expect(box.style.height).toBe("90px")
    expect(box.style.transition).toBe("")
    vi.restoreAllMocks()
  })
})

describe("keepBelow", () => {
  afterEach(() => vi.restoreAllMocks())

  const page = (scrollTop: number) => {
    const scroller = document.createElement("main")
    scroller.style.overflowY = "auto"
    const line = document.createElement("div")
    line.textContent = "2 tools need an update"
    scroller.append(line)
    document.body.append(scroller)
    scroller.scrollTop = scrollTop
    return { scroller, line }
  }
  const sized = (line: HTMLElement, size: { height: number }) =>
    vi.spyOn(line, "offsetHeight", "get").mockImplementation(() => size.height)
  const settle = () => new Promise((r) => setTimeout(r, 0))

  it("scrolls by what the line above lost or gained, so the content below stays on screen where it was", async () => {
    const { scroller, line } = page(120)
    const size = { height: 55 }
    sized(line, size)
    const stop = keepBelow(line)
    size.height = 44
    line.textContent = "1 tool needs an update"
    await settle()
    expect(scroller.scrollTop).toBe(109)
    size.height = 70
    line.textContent = "3 tools need an update, and two of them have no newer version yet"
    await settle()
    expect(scroller.scrollTop).toBe(135)
    stop?.()
  })

  it("leaves the page alone at its top, where there is nothing to give back", async () => {
    const { scroller, line } = page(0)
    const size = { height: 55 }
    sized(line, size)
    const stop = keepBelow(line)
    size.height = 44
    line.textContent = "1 tool needs an update"
    await settle()
    expect(scroller.scrollTop).toBe(0)
    stop?.()
  })
})

describe("the motion tokens", () => {
  it("are the same durations in the stylesheet as in code", () => {
    const css = readFileSync("src/styles/index.css", "utf8")
    const inCss = Object.fromEntries(
      [...css.matchAll(/--motion-(\w+):\s*(\d+)ms/g)].map(([, name, ms]) => [name, Number(ms)]),
    )
    const { hold: _pacing, ...durations } = MOTION
    expect(inCss).toEqual(durations)
  })
})

describe("pacing a list of row states", () => {
  it("changes one row at a time, the first that differs", () => {
    expect(paceStep(["run", "wait"], ["done", "run"])).toEqual(["done", "wait"])
    expect(paceStep(["done", "wait"], ["done", "run"])).toEqual(["done", "run"])
    expect(paceStep(["done"], ["done"])).toEqual(["done"])
    expect(paceStep(["a"], ["a", "b"])).toEqual(["a", "b"])
  })

  describe("as a hook", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("shows a finished row for the hold time before the next row starts", () => {
      const { result, rerender } = renderHook(({ rows }) => usePaced(rows), {
        initialProps: { rows: ["wait", "wait"] },
      })
      rerender({ rows: ["run", "wait"] })
      expect(result.current).toEqual(["run", "wait"])
      // The first tool ends and the second starts in the same moment.
      rerender({ rows: ["done", "run"] })
      act(() => vi.advanceTimersByTime(MOTION.hold - 1))
      expect(result.current).toEqual(["run", "wait"])
      act(() => vi.advanceTimersByTime(1))
      expect(result.current).toEqual(["done", "wait"])
      act(() => vi.advanceTimersByTime(MOTION.hold))
      expect(result.current).toEqual(["done", "run"])
    })

    it("follows at once a change that comes after the hold time", () => {
      const { result, rerender } = renderHook(({ rows }) => usePaced(rows), { initialProps: { rows: ["run"] } })
      act(() => vi.advanceTimersByTime(5000))
      rerender({ rows: ["done"] })
      expect(result.current).toEqual(["done"])
    })
  })
})

describe("creep", () => {
  it("moves on with time and never claims the step is done", () => {
    expect(creep(0, 1000)).toBe(0)
    expect(creep(500, 1000)).toBeLessThan(creep(1000, 1000))
    expect(creep(60_000, 1000)).toBeLessThanOrEqual(0.9)
    expect(creep(-5, 1000)).toBe(0)
  })
})
