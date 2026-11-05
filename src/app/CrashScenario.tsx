import { platform } from "@/platform/bridge"

export function CrashScenario({ section }: { section: string }): null {
  if (platform.kind === "mock" && new URLSearchParams(window.location.search).get("crash") === section) {
    throw new TypeError("Cannot read properties of undefined (reading 'length')")
  }
  return null
}
