import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Combobox } from "@/ui/Combobox"
import { taskMessages } from "./messages"
import { PEOPLE_FOUND, useTasks } from "./store"

const TYPING_MS = 250

/**
 * Finds a person by name as one types: memo answers each search with at most 20 people, and a search asked before
 * stays in the cache, so opening the finder again is instant. A name nobody has yet is added as a new person.
 */
export function PersonFinder({ onPick, onDone }: { onPick: (ref: string) => void; onDone: () => void }) {
  const m = useMessages(taskMessages)
  const failed = useTasks((s) => s.failed.person)
  const [typed, setTyped] = useState("")
  const [asked, setAsked] = useState("")
  const [adding, setAdding] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => wrap.current?.querySelector("input")?.focus(), [])
  const name = typed.trim()
  useEffect(() => {
    const t = setTimeout(() => setAsked(name), TYPING_MS)
    return () => clearTimeout(t)
  }, [name])
  const found = useQuery({
    queryKey: [...PEOPLE_FOUND, asked.toLocaleLowerCase()],
    queryFn: () => platform.peopleSearch(asked),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
  const named = useMemo(() => {
    const out = new Map<string, string>()
    for (const p of found.data ?? []) {
      const label = p.owner ? m.you : (p.name ?? m.unnamed)
      if (!out.has(label)) out.set(label, p.ref)
    }
    return out
  }, [found.data, m])
  // A person is added only once memo has answered for exactly this name, or "Ana" typed fast makes a second Ana.
  const settled = asked === name && !found.isFetching && !found.isError
  // "ana ruiz" is Ana Ruiz, not a new person.
  const same = [...named.keys()].find((n) => n.toLocaleLowerCase() === name.toLocaleLowerCase())
  const add = name && !same && settled ? m.addNamed(name) : null
  const options = [...named.keys(), ...(add ? [add] : [])]
  const choose = async (picked: string) => {
    const ref = named.get(picked) ?? (picked === name && same ? named.get(same) : undefined)
    if (ref) {
      const person = found.data?.find((p) => p.ref === ref)
      if (person) useTasks.getState().know(person)
      onDone()
      onPick(ref)
      return
    }
    if (picked !== add || adding) return setTyped(picked)
    setAdding(true)
    const person = await useTasks.getState().addPerson(name)
    setAdding(false)
    if (!person) return
    onDone()
    onPick(person.ref)
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys belong to the field inside; this only ends the search
    <div
      ref={wrap}
      className="flex flex-col gap-[0.3rem]"
      onBlur={(e) => {
        if (!adding && !e.currentTarget.contains(e.relatedTarget)) onDone()
      }}
      onKeyDown={(e) => {
        if (e.defaultPrevented) return
        if (e.key === "Escape") {
          // In a dialog this Escape would close the whole dialog, not only the search.
          e.preventDefault()
          onDone()
        } else if (e.key === "Enter" && name) {
          e.preventDefault()
          const pick = same ?? add
          if (pick) void choose(pick)
        }
      }}
    >
      <Combobox
        value={typed}
        onChange={(v) => void choose(v)}
        options={options}
        placeholder={m.findPerson}
        aria-label={m.findPerson}
        className="h-8"
      />
      {failed && <span className="text-[0.8rem] leading-snug text-bad">{m.personFailed(failed)}</span>}
    </div>
  )
}
