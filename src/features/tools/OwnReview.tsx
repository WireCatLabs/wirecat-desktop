import { LoaderCircle, ShieldAlert, TriangleAlert } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { entityLabel, groupAccess } from "@/domain/own-access"
import { useLang, useMessages } from "@/i18n"
import type { OwnReview, OwnSignal, OwnUpdate } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { ExtLink } from "@/shared/ExtLink"
import { ownToolsDocs } from "@/shared/own-tools-docs"
import { AutoHeight } from "@/ui/AutoHeight"
import { Checkbox } from "@/ui/Checkbox"
import { Disclosure } from "@/ui/Disclosure"
import { FieldError } from "@/ui/FieldError"
import { InfoTip } from "@/ui/InfoTip"
import { Pill } from "@/ui/Pill"
import type { OwnText } from "./messages-own"
import { type OwnReviewText, ownReviewMessages } from "./messages-own-review"
import { signalWords } from "./own-signals"

export function WarnBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[0.35rem] border border-warn/40 bg-warn/5 px-3.5 py-3 text-[0.95rem] text-ink">
      {children}
    </div>
  )
}

/** Red, because the access it describes is the whole of the owner's data; no `alert` role, since nothing went wrong. */
export function Danger({ lines, m }: { lines: string[]; m: OwnText }) {
  const lang = useLang()
  return (
    <div className="flex gap-3 rounded-[0.35rem] border border-bad/50 bg-bad/10 px-3.5 py-3 text-[0.95rem] text-ink">
      <ShieldAlert className="mt-[0.15rem] size-5 shrink-0 text-bad" aria-hidden />
      <div className="flex flex-col gap-1">
        <ul className="flex flex-col gap-1">
          {lines.map((line, i) => (
            <li key={line} className={i === 0 ? "font-medium" : undefined}>
              {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-1 self-start text-brand underline hover:text-brand-hover"
          onClick={() => platform.openUrl(ownToolsDocs(lang))}
        >
          {m.docs}
        </button>
      </div>
    </div>
  )
}

export const dangerLines = (r: OwnReviewText, usesCore: boolean) => [
  r.danger.runs,
  ...(usesCore ? [r.danger.core] : []),
  r.danger.trust,
  r.danger.noResponsibility,
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-1.5">
      <dt className="text-ink-dim">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Changes({
  review,
  m,
  accepted,
  accept,
  unaccepted,
  acceptId,
}: ReviewProps & { review: OwnReview & { update: OwnUpdate } }) {
  const change = review.update
  const id = useId()
  const built = (b: OwnReview["built"]) => (b ? m.builtBy(b.repo) : m.notBuilt)
  const names = (parts: string[]) => parts.map((p) => m.parts[p as keyof OwnText["parts"]] ?? p).join(", ")
  const list = (label: string, items: string[]) =>
    items.length > 0 && (
      <p>
        {label} <span className="font-mono">{items.join(", ")}</span>
      </p>
    )
  if (!change.confirm) return <p className="text-ink-soft">{m.nothingNew(change.fromVersion)}</p>
  return (
    <WarnBox>
      {change.repoChanged && <p>{m.repoChanged(change.fromRepo ?? m.noRepository, review.repo ?? m.noRepository)}</p>}
      {change.provenanceChanged && <p>{m.provenanceChanged(built(change.fromBuilt), built(review.built))}</p>}
      {change.publishersChanged && (
        <p>{m.publishersChanged(change.fromPublishers.join(", "), review.publishers.join(", "))}</p>
      )}
      {list(m.newCommands, change.newCommands)}
      {list(m.newWrites, change.newWrites)}
      {change.newParts.length > 0 && (
        <p>
          {m.newParts} {names(change.newParts)}
        </p>
      )}
      {change.changedParts.length > 0 && (
        <p>
          {m.changedParts} {names(change.changedParts)}
        </p>
      )}
      {review.access.unknown && <p>{m.unknownAccess}</p>}
      <div className="mt-1 flex items-center gap-2">
        <Checkbox
          id={acceptId}
          checked={accepted}
          onChange={accept}
          aria-labelledby={id}
          aria-invalid={unaccepted || undefined}
          aria-describedby={unaccepted ? `${id}-error` : undefined}
        />
        <span id={id} className="font-medium">
          {m.acceptChanges}
        </span>
      </div>
      <FieldError id={`${id}-error`}>{unaccepted && m.acceptFirst}</FieldError>
    </WarnBox>
  )
}

function Details({ review, m, r }: { review: OwnReview; m: OwnText; r: OwnReviewText }) {
  const links = review.links
  const publishers = review.publishers.map((p) => {
    const link = links.publishers.find((l) => l.label === p)
    return link ? (
      <ExtLink key={p} href={link.url}>
        {p}
      </ExtLink>
    ) : (
      <span key={p}>{p}</span>
    )
  })
  const build = [
    links.commit && { href: links.commit, label: r.links.commit },
    links.run && { href: links.run, label: r.links.run },
    links.log && { href: links.log, label: r.links.log },
  ].filter((l): l is { href: string; label: string } => Boolean(l))
  return (
    <dl className="divide-y divide-line">
      <Row label={m.publisher}>
        <span className="flex flex-wrap gap-x-3">{publishers}</span>
      </Row>
      <Row label={m.repository}>
        {review.repo ? <ExtLink href={review.repo}>{review.repo}</ExtLink> : m.noRepository}
      </Row>
      <Row label={m.version}>
        <span className="flex flex-wrap items-center gap-x-3">
          <span className="font-mono">{review.version}</span>
          <ExtLink href={links.npm}>{r.links.npm}</ExtLink>
        </span>
      </Row>
      <Row label={m.provenance}>
        <span className={review.built ? "" : "text-warn-ink"}>
          {review.built ? m.builtBy(review.built.repo) : m.notBuilt}
        </span>
        <InfoTip label={m.provenanceInfo} className="ml-1 align-middle">
          {m.provenanceHelp}
        </InfoTip>
        {build.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-[0.9rem]">
            {build.map((l) => (
              <ExtLink key={l.href} href={l.href}>
                {l.label}
              </ExtLink>
            ))}
          </span>
        )}
      </Row>
    </dl>
  )
}

function AccessList({ review, m, r }: { review: OwnReview; m: OwnText; r: OwnReviewText }) {
  if (review.access.unknown) return <p className="text-warn-ink">{m.unknownAccess}</p>
  const access = groupAccess(review.commands, review.entities)
  const a = r.access
  const cell = "py-1.5 pr-3 align-top"
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9rem] text-ink-soft">{a.note}</p>
      {access.groups.length === 0 ? (
        <p className="text-ink-soft">{a.noData}</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead className="text-[0.9rem] text-ink-dim">
            <tr>
              <th className={`${cell} font-normal`}>{a.data}</th>
              <th className={`${cell} font-normal`}>{a.withService(review.name)}</th>
              <th className={`${cell} font-normal`}>{a.onComputer}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-line border-t">
            {access.groups.map((g) => (
              <tr key={g.key}>
                <th scope="row" className={`${cell} font-medium`}>
                  {entityLabel(g.key)}
                  {g.fields.length > 0 && (
                    <span className="block text-[0.9rem] font-normal text-ink-soft">
                      {a.fields(g.fields.map((f) => f.replaceAll("_", " ")).join(", "))}
                    </span>
                  )}
                </th>
                <td className={`${cell} ${g.remote === "write" ? "font-medium text-warn-ink" : ""}`}>
                  {a.remote[g.remote]}
                </td>
                <td className={`${cell} ${g.local === "write" ? "font-medium" : ""}`}>{a.local[g.local]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {access.sync.length > 0 && <p>{review.syncWhat ? a.sync(review.syncWhat) : a.syncs}</p>}
      {access.standard.length > 0 && (
        <div>
          <h4 className="text-[0.9rem] font-medium text-ink-dim">{a.standardTitle}</h4>
          <ul className="mt-1 flex flex-col gap-0.5 text-ink-soft">
            {access.standard.map((s) => (
              <li key={s.root}>{a.standard[s.root]}</li>
            ))}
          </ul>
        </div>
      )}
      <Disclosure summary={a.commands(review.commands.length)}>
        <ul className="flex flex-col gap-1 text-[0.9rem]">
          {review.commands.map((c) => (
            <li key={c.words} className="flex flex-wrap gap-x-3">
              <code className="selectable font-mono">{c.words}</code>
              <span className="text-ink-soft">{a.level(a.remote[c.remote], a.local[c.local])}</span>
              {c.summary && <span className="text-ink-soft">{c.summary}</span>}
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  )
}

function Servers({ review, r }: { review: OwnReview; r: OwnReviewText }) {
  const hosts = review.hosts
  return (
    <section aria-label={r.network.title}>
      <h3 className="mb-1 font-medium">{r.network.title}</h3>
      {hosts === null ? (
        <p className="text-warn-ink">{r.network.unsaid}</p>
      ) : hosts.length === 0 ? (
        <p>{r.network.none}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 font-mono text-[0.9rem]">
          {hosts.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {review.userHosts && <p className="mt-1">{r.network.userHosts(review.userHosts)}</p>}
    </section>
  )
}

function Signals({ review, r }: { review: OwnReview; r: OwnReviewText }) {
  const [github, setGithub] = useState<OwnSignal[] | null>(null)
  useEffect(() => {
    let live = true
    platform.ownToolRisks(review.token).then(
      (s) => live && setGithub(s),
      (e) => {
        console.error("Could not ask GitHub about the reviewed repository.", e)
        if (live) setGithub([{ kind: "githubUnchecked", reason: "unreachable" }])
      },
    )
    return () => {
      live = false
    }
  }, [review.token])
  const all = [...review.signals, ...(github ?? [])]
  return (
    <section aria-label={r.signals.title}>
      <h3 className="mb-1 font-medium">{r.signals.title}</h3>
      {/* GitHub's answer arrives after the review shows; the list grows into place instead of pushing the page. */}
      <AutoHeight swap={github === null ? "waiting" : "answered"}>
        <ul className="flex flex-col gap-2">
          {all.map((s) => {
            const [what, why] = signalWords(s, r.signals)
            return (
              <li key={what} className="flex gap-2">
                <TriangleAlert className="mt-[0.2rem] size-4 shrink-0 text-warn" aria-hidden />
                <span>
                  <span className="font-medium">{what}</span>
                  <span className="block text-[0.9rem] text-ink-soft">{why}</span>
                </span>
              </li>
            )
          })}
          {github === null && (
            <li role="status" className="flex items-center gap-2 text-ink-soft">
              <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
              {r.signals.checkingGithub}
            </li>
          )}
          {github !== null && all.length === 0 && <li className="text-ink-soft">{r.signals.nothing}</li>}
        </ul>
      </AutoHeight>
    </section>
  )
}

type ReviewProps = {
  review: OwnReview
  m: OwnText
  accepted: boolean
  accept(accepted: boolean): void
  /** Add was pressed before the changes were accepted. */
  unaccepted?: boolean | undefined
  acceptId?: string | undefined
}

export function ReviewStep({ review, m, accepted, accept, unaccepted, acceptId }: ReviewProps) {
  const r = useMessages(ownReviewMessages)
  const agent = [review.skill && m.skill, review.mcp && m.mcp].filter(Boolean).join(" · ") || m.noAgent
  const update = review.update
  return (
    <div className="flex flex-col gap-4 text-[0.95rem]">
      <div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-[1.05rem]">
          {review.name} <span className="font-mono font-normal text-ink-soft">{review.package}</span>
          <Pill tone="bad">{r.notVerified}</Pill>
        </p>
        <p className="mt-1 text-ink-soft">{review.summary}</p>
      </div>
      <Danger lines={dangerLines(r, review.usesCore)} m={m} />
      {update && (
        <Changes
          review={{ ...review, update }}
          m={m}
          accepted={accepted}
          accept={accept}
          unaccepted={unaccepted}
          acceptId={acceptId}
        />
      )}
      <Details review={review} m={m} r={r} />
      <Signals review={review} r={r} />
      <section aria-label={r.access.title}>
        <h3 className="mb-1 font-medium">{r.access.title}</h3>
        <AccessList review={review} m={m} r={r} />
        <ul className="mt-2 flex flex-col gap-0.5 text-ink-soft">
          <li>{review.signIn ? m.signIn(review.signIn.asks, review.signIn.gives) : m.noSignIn}</li>
          <li>{agent}</li>
        </ul>
      </section>
      <Servers review={review} r={r} />
    </div>
  )
}
