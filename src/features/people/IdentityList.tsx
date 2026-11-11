import { Unlink } from "lucide-react"
import { useEffect } from "react"
import { accountLabel, bySource, profilesOf, seenAtWork } from "@/domain/people"
import { useGroups } from "@/features/groups"
import { useLang, useMessages } from "@/i18n"
import type { Identity } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { Pill } from "@/ui/Pill"
import { peopleMessages } from "./messages"
import { SourceIcon, sourceOf } from "./sources"

const day = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang, { dateStyle: "medium" })

/**
 * A person's accounts by source, each with the owner's profiles that saw it and how it was joined. With `onUnlink`,
 * each account that can move has its own Unlink.
 */
export function IdentityList({
  identities,
  onUnlink,
}: {
  identities: Identity[]
  onUnlink?: (identity: string) => void
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const groups = useGroups((s) => s.read)
  useEffect(() => {
    if (!useGroups.getState().read) void useGroups.getState().load()
  }, [])
  const members = groups?.kind === "ready" ? groups.groups.flatMap((g) => g.members) : []
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
              const label = accountLabel(i)
              const profiles = profilesOf(i, members)
              return (
                <li
                  key={i.identity}
                  className="flex items-start justify-between gap-3 border-line px-[0.9rem] py-[0.6rem] not-first:border-t"
                >
                  <span className="flex min-w-0 flex-col gap-[0.15rem]">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{label ?? m.noName}</span>
                      {i.username && label !== m.username(i.username) && (
                        <span className="text-ink-soft">{m.username(i.username)}</span>
                      )}
                      {i.bot && <Pill>{m.bot}</Pill>}
                      {seenAtWork(i.seenIn) && <Pill>{m.atWork}</Pill>}
                    </span>
                    <span className="selectable font-mono text-[0.85rem] break-all text-ink-dim">{i.identity}</span>
                    <span className="text-[0.85rem] text-ink-soft">
                      {i.seenIn.length === 0
                        ? m.seenNowhere
                        : profiles.length > 0
                          ? m.inProfiles(profiles.join(", "))
                          : null}
                      {i.method && (
                        <>
                          {i.seenIn.length === 0 || profiles.length > 0 ? " · " : null}
                          {m.methods[i.method] ?? m.joinedBy(i.method)}
                          {i.linkedAt ? ` · ${day(i.linkedAt, lang)}` : null}
                        </>
                      )}
                    </span>
                  </span>
                  {onUnlink && i.movable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      aria-label={m.unlinkLabel(label ?? i.identity)}
                      icon={<Unlink className="size-4" aria-hidden />}
                      onClick={() => onUnlink(i.identity)}
                    >
                      {m.unlinkAccount}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
