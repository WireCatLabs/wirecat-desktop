import { AlertTriangle, ExternalLink, X } from "lucide-react"
import { useLang, useMessages } from "@/i18n"
import { externalHref } from "@/shared/external-href"
import { shownNotices, type TopNotice, useNotices } from "@/shared/notices-store"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { appMessages } from "./messages"

/** What the app raised about itself (`src/shared/notices-store.ts`), across the top of every page. */
export function TopNotices() {
  const notices = useNotices((s) => s.notices)
  const dismissed = useNotices((s) => s.dismissed)
  const shown = shownNotices({ notices, dismissed })
  return (
    <Collapse open={shown.length > 0}>
      <ul className="border-line border-b">
        {shown.map((n) => (
          <Notice key={n.id} notice={n} />
        ))}
      </ul>
    </Collapse>
  )
}

function Notice({ notice: n }: { notice: TopNotice }) {
  const lang = useLang()
  const m = useMessages(appMessages)
  const { dismiss, openLink } = useNotices.getState()
  return (
    <li
      role="status"
      className={cx(
        "flex items-start gap-[0.7rem] px-[1.3rem] py-[0.6rem] text-[0.95rem]",
        n.tone === "bad" ? "bg-bad/10" : "bg-warn/10",
      )}
    >
      <AlertTriangle
        className={cx("mt-[0.15rem] size-[1.1rem] shrink-0", n.tone === "bad" ? "text-bad" : "text-warn-ink")}
        strokeWidth={1.8}
        aria-hidden
      />
      <p className="selectable min-w-0 flex-1 text-ink leading-relaxed">
        {n.text[lang]}
        {n.link && (
          <button
            type="button"
            title={n.link.url[lang]}
            onClick={() => n.link && openLink(n.link.url[lang])}
            {...externalHref(n.link.url[lang])}
            className="ml-[0.5rem] inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {n.link.label[lang]}
            <ExternalLink className="size-[0.85em] shrink-0" strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </p>
      <button
        type="button"
        aria-label={m.hideNotice}
        title={m.hideNotice}
        onClick={() => dismiss(n)}
        className="grid size-[1.8rem] shrink-0 place-items-center rounded-[0.35rem] text-ink-dim hover:bg-app-3 hover:text-ink"
      >
        <X className="size-[1rem]" strokeWidth={1.8} aria-hidden />
      </button>
    </li>
  )
}
