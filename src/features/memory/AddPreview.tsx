import { FileText, Globe, Image as ImageIcon } from "lucide-react"
import { formatBytes } from "@/domain/format"
import { useMessages } from "@/i18n"
import { Skeleton } from "@/ui/Skeleton"
import type { Preview } from "./add-store"
import { addMessages } from "./messages-add"

const card = "reveal flex gap-[0.8rem] rounded-[0.45rem] border border-line bg-app-2/60 px-[0.9rem] py-[0.75rem]"

/** What the link or file holds, shown before Save so the owner knows what will be kept. */
export function SourcePreview({ preview, of }: { preview: Preview | null; of: string }) {
  const m = useMessages(addMessages)
  if (!preview || preview.of !== of || preview.state === "none") return null
  if (preview.state === "loading")
    return <Skeleton className="h-[5.5rem] w-full rounded-[0.45rem]" label={m.previewLoading} />
  if (preview.state === "link") {
    const l = preview.link
    return (
      <section className={card} aria-label={m.previewLabel}>
        <Globe className="mt-[0.15rem] size-[1.1rem] shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          {l.site && <p className="font-mono text-[0.85rem] text-ink-dim">{l.site}</p>}
          <p className="font-medium">{l.title ?? l.url}</p>
          {l.description && <p className="mt-[0.15rem] text-[0.92rem] text-ink-soft">{l.description}</p>}
          {l.excerpt && (
            <p className="selectable mt-[0.4rem] line-clamp-4 text-[0.92rem] text-ink-soft">“{l.excerpt}”</p>
          )}
          {l.chars !== null && <p className="mt-[0.3rem] text-[0.85rem] text-ink-dim">{m.chars(l.chars)}</p>}
        </div>
      </section>
    )
  }
  const f = preview.file
  const Icon = f.mime?.startsWith("image/") ? ImageIcon : FileText
  return (
    <section className={card} aria-label={m.previewLabel}>
      {f.image ? (
        <img
          src={f.image}
          alt={m.thumbnail(f.name)}
          className="h-[6rem] w-auto max-w-[10rem] shrink-0 rounded-[0.3rem] border border-line object-contain"
        />
      ) : (
        <Icon className="mt-[0.15rem] size-[1.6rem] shrink-0 text-ink-soft" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium break-all">{f.name}</p>
        <p className="font-mono text-[0.85rem] text-ink-dim">
          {[f.mime, formatBytes(f.bytes)].filter(Boolean).join(" · ")}
        </p>
        {f.excerpt && <p className="selectable mt-[0.4rem] line-clamp-4 text-[0.92rem] text-ink-soft">“{f.excerpt}”</p>}
        {f.mime?.startsWith("image/") && <p className="mt-[0.3rem] text-[0.9rem] text-ink-soft">{m.imageByTitle}</p>}
      </div>
    </section>
  )
}
