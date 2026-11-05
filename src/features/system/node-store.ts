import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { NodeEvent, NodeOffer, NodePath } from "@/platform/schemas"
import { useSystem } from "@/shared/system-store"

export type NodeStep = Extract<NodeEvent, { event: "step" }>["step"]
type Failure = Extract<NodeEvent, { event: "failed" }>

type NodeState = {
  offer: NodeOffer | null
  offerError: string | null
  running: boolean
  step: NodeStep | null
  /**
   * The two parts of the PATH step, as the interface sees them: Rust writes the line (`write`), then Node.js, npm and
   * the tools are looked up again (`check`). `pathFile` is the startup file Rust wrote, once it says.
   */
  pathPart: "write" | "check" | null
  pathFile: string | null
  received: number
  total: number | null
  failure: Failure | null
  /** The owner chose to install Node.js himself, so setup lets him go on without it. */
  myself: boolean
  setMyself(myself: boolean): void
  path: NodePath | null
  busy: boolean
  error: string | null
  loadOffer(): Promise<void>
  setup(): Promise<void>
  cancel(): Promise<void>
  loadPath(): Promise<void>
  setPath(add: boolean): Promise<void>
  remove(): Promise<boolean>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useNode = create<NodeState>((set, get) => ({
  offer: null,
  offerError: null,
  running: false,
  step: null,
  pathPart: null,
  pathFile: null,
  received: 0,
  total: null,
  failure: null,
  myself: false,
  setMyself: (myself) => set({ myself }),
  path: null,
  busy: false,
  error: null,
  async loadOffer() {
    if (get().offer) return
    try {
      set({ offer: await platform.nodeOffer(), offerError: null })
    } catch (e) {
      set({ offerError: message(e) })
    }
  },
  async setup() {
    if (get().running) return
    set({ running: true, step: "check", received: 0, total: null, failure: null, pathPart: null, pathFile: null })
    await platform.setupNode((e) => {
      // Each step counts its own bytes: the download, then the archive read back while unpacking.
      if (e.event === "step")
        set({ step: e.step, received: 0, total: null, pathPart: e.step === "path" ? "write" : null })
      else if (e.event === "progress") set({ received: e.received, total: e.total })
      else if (e.event === "failed") set({ failure: e, running: false })
      else if (e.event === "done") set({ pathPart: "check", pathFile: e.pathFix?.file ?? null })
    })
    // The search path changed, so Node, npm and every tool are looked up again. The setup counts as running until
    // that answer is in: in between, the old answer (no Node.js) would bring back the offer to set it up.
    if (!get().failure) await useSystem.getState().refresh()
    set({ running: false, step: get().failure ? get().step : null, pathPart: null })
  },
  async cancel() {
    await platform.cancelNodeSetup()
  },
  async loadPath() {
    try {
      set({ path: await platform.nodePath(), error: null })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async setPath(add) {
    set({ busy: true, error: null })
    try {
      set({ path: await platform.setNodePath(add) })
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: false })
    }
  },
  async remove() {
    set({ busy: true, error: null })
    try {
      await platform.removeNode()
      set({ path: null, offer: null })
      await useSystem.getState().refresh()
      return true
    } catch (e) {
      set({ error: message(e) })
      return false
    } finally {
      set({ busy: false })
    }
  },
}))
