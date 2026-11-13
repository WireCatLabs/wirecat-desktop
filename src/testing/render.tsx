import { QueryClientProvider } from "@tanstack/react-query"
import {
  type RenderHookOptions,
  type RenderOptions,
  renderHook as renderHookWithTestingLibrary,
  render as renderWithTestingLibrary,
} from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { queryClient } from "@/shared/query"

// `resetStores` swaps in a new client before each test, so each test starts with no cached answer.
function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient()}>{children}</QueryClientProvider>
}

/**
 * Renders inside the app's providers. Stores, language and saved settings are reset before and after each test by
 * setup.ts (`resetStores`), so seed a store before calling this and nothing leaks into the next test.
 */
export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return renderWithTestingLibrary(ui, { wrapper: Providers, ...options })
}

export function renderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper">,
) {
  return renderHookWithTestingLibrary(hook, { wrapper: Providers, ...options })
}

export { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react"
