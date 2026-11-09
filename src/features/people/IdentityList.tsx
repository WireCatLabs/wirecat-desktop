import { bySource, scopesOf } from "@/domain/people"
import { useLang, useMessages } from "@/i18n"
import type { Identity } from "@/platform/people-schemas"
import { Pill } from "@/ui/Pill"
import { peopleMessages } from "./messages"
import { SourceIcon, sourceOf } from "./sources"

const day = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang, { dateStyle: "medium" })

/** A person's accounts by source, each with the sides of life that saw it and how it was joined. */
export function IdentityList({ identities }: { identities: Identity[] }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  return (
    <div className="flex flex-col gap-[0.8rem]">
      {bySource(identities).map((group) => (
        <section
          key={group.provider}
          aria-label={sourceOf(group.provider).name}
          className="flex flex-col gap-[0.35rem]"
        >
          <h4 className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-soft">
            <SourceIcon provider={group.provider} />
            {sourceOf(group.provider).name}
          </h4>
          <ul className="flex flex-col rounded-[0.45rem] border border-line">
            {group.identities.map((i) => {
              const scopes = scopesOf(i.seenIn)
              return (
                <li
                  key={i.identity}
                  className="flex flex-col gap-[0.15rem] border-line px-[0.9rem] py-[0.6rem] not-first:border-t"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.name ?? i.identity}</span>
                    {i.username && <span className="text-ink-soft">{m.username(i.username)}</span>}
                    {scopes.map((s) => (
                      <Pill key={s}>{m.scopes[s] ?? s}</Pill>
                    ))}
                  </span>
                  <span className="selectable font-mono text-[0.85rem] break-all text-ink-dim">{i.identity}</span>
                  <span className="text-[0.85rem] text-ink-soft">
                    {i.seenIn.length === 0 ? m.seenNowhere : null}
                    {i.method && (
                      <>
                        {i.seenIn.length === 0 ? " · " : null}
                        {m.methods[i.method] ?? m.joinedBy(i.method)}
                        {i.linkedAt ? ` · ${day(i.linkedAt, lang)}` : null}
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
