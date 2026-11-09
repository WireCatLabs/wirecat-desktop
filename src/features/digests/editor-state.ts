import { useEffect, useState } from "react"

export const card =
  "flex min-w-0 flex-col gap-3 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem]"
export const area =
  "selectable w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.92rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand"

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** One memo-backed editor: what memo has, a read failure, the change in flight and why the last one failed. */
/** `key` names what is read: a new key reads again. */
export function useMemoEditor<T>(read: () => Promise<T>, key: string) {
  const [value, setValue] = useState<T | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` is new each render; `key` says when it reads else
  useEffect(() => {
    let live = true
    setValue(null)
    setReadError(null)
    setFailed(null)
    read().then(
      (v) => live && setValue(v),
      (e) => live && setReadError(messageOf(e)),
    )
    return () => {
      live = false
    }
  }, [key])

  const change = async (call: () => Promise<T>) => {
    setBusy(true)
    setFailed(null)
    try {
      setValue(await call())
    } catch (e) {
      setFailed(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  return { value, readError, busy, failed, change }
}
