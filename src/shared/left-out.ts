import type { ToolSource } from "@/domain/catalog"

export type LeftOut = { source: ToolSource; text: string }

let leftOut: LeftOut[] = []

/** Every entry Rust or the interface left out at start, for Settings to show beside the switch that read it. */
export const communityLeftOut = (): readonly LeftOut[] => leftOut
export const keepLeftOut = (found: LeftOut[]) => {
  leftOut = found
}
