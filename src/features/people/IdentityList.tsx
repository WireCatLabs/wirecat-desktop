import { Unlink } from "lucide-react"
import { useEffect } from "react"
import { accountLabel, bySource, profilesOf, seenAtWork } from "@/domain/people"
import { accountValue, emailLink, phoneLink, sourceLink } from "@/domain/source-link"
import { useGroups } from "@/features/groups"
import { useLang, useMessages } from "@/i18n"
import type { Identity } from "@/platform/people-schemas"
import { ExtLink } from "@/shared/ExtLink"
import { SourceIcon, sourceOf } from "@/shared/SourceIcon"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { Pill } from "@/ui/Pill"
import { peopleMessages } from "./messages"

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
          <ul className="flex flex-col rounded-inset border border-line">
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
                    <AccountAddress identity={i} />
                    <ContactLines identity={i} />
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

/** Where the account lives, as a link when its service has a page for it, and a copy of what a person would type. */
function AccountAddress({ identity: i }: { identity: Identity }) {
  const m = useMessages(peopleMessages)
  const href = sourceLink(i.identity, i.username)
  const value = accountValue(i.identity, i.username)
  const shown = href
    ? href.replace(/^(?:https:\/\/|mailto:)/, "").replace(/\/$/, "")
    : i.identity.slice(i.identity.indexOf(":") + 1)
  const text = "font-mono text-[0.85rem]"
  return (
    <span className="flex min-w-0 items-center gap-[0.25rem]">
      {href ? (
        <ExtLink href={href} className={text}>
          {shown}
        </ExtLink>
      ) : (
        <span className={`selectable min-w-0 break-all text-ink-dim ${text}`}>{shown}</span>
      )}
      <CopyButton value={value} label={m.copyAccount(value)} className="size-7" />
    </span>
  )
}

/** Every phone and address the account's source gave, beside the account's own address when that is not one of them. */
function ContactLines({ identity: i }: { identity: Identity }) {
  const m = useMessages(peopleMessages)
  const own = accountValue(i.identity, i.username)
  const lines = [
    ...i.phones.map((value) => ({ value, href: phoneLink(value) })),
    ...i.emails.map((value) => ({ value, href: emailLink(value) })),
  ].filter(({ value }) => value !== own)
  if (lines.length === 0) return null
  const text = "font-mono text-[0.85rem]"
  return (
    <span className="flex flex-col gap-[0.1rem]">
      {lines.map(({ value, href }) => (
        <span key={value} className="flex min-w-0 items-center gap-[0.25rem]">
          {href ? (
            <ExtLink href={href} className={text}>
              {value}
            </ExtLink>
          ) : (
            <span className={`selectable min-w-0 break-all text-ink-dim ${text}`}>{value}</span>
          )}
          <CopyButton value={value} label={m.copyAccount(value)} className="size-7" />
        </span>
      ))}
    </span>
  )
}
