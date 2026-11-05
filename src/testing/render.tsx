import { type RenderOptions, render as renderWithTestingLibrary } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

// The one place a provider (a QueryClient later) is added, so every test gets it without being edited.
function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * Renders inside the app's providers. Stores, language and saved settings are reset before and after each test by
 * setup.ts (`resetStores`), so seed a store before calling this and nothing leaks into the next test.
 */
export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return renderWithTestingLibrary(ui, { wrapper: Providers, ...options })
}

export { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react"
export { resetStores } from "./stores"
