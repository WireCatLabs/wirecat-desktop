import { useMessages } from "@/i18n"
import { keptMessages } from "./messages-kept"

/** An own tool's folders that were there before it was added: another program may own them, so Delete data skips them. */
export function KeptFolders({ paths }: { paths: readonly string[] }) {
  const m = useMessages(keptMessages)
  if (paths.length === 0) return null
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5 text-[0.85rem] text-ink-soft">
      {paths.map((p) => (
        <li key={p}>
          {m.kept} <code className="selectable break-all font-mono text-ink-dim">{p}</code>
        </li>
      ))}
    </ul>
  )
}
