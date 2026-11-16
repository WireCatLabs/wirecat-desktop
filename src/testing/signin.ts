import { act } from "@testing-library/react"
import { useSignIn } from "@/shared/signin-store"

/**
 * Opens a tool's sign-in on its plan, as the Sign in button does, and waits for the tool's answer to `setup show`. The
 * mock answers as a tool from before the setup format, so the hand-made form is drawn.
 */
export async function openSignIn(tool: string, profile: string) {
  act(() => useSignIn.getState().start(tool, profile))
  for (let i = 0; i < 3; i++) await act(() => new Promise((done) => setTimeout(done, 0)))
}
