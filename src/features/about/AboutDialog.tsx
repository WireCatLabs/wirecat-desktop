import { Fragment } from "react"
import { tools } from "@/domain/catalog"
import { type Lang, useLang, useMessages } from "@/i18n"
import { ExtLink } from "@/shared/ExtLink"
import { useReport } from "@/shared/report-store"
import { useSystem } from "@/shared/system-store"
import { useTools } from "@/shared/tools-store"
import { CopyButton } from "@/ui/CopyButton"
import { Dialog } from "@/ui/Dialog"
import { LinkButton } from "@/ui/LinkButton"
import { Monogram } from "@/ui/Logo"
import { aboutMessages } from "./messages"

const AUTHOR = "Viacheslav Ptsarev"
const COPYRIGHT_YEAR = 2026
const REPO = "https://github.com/WireCatLabs/wirecat-desktop"
const PRODUCT = "WireCat Desktop"
const LICENSE = "Apache License 2.0"

export const docsPage = (lang: Lang) => `https://wirecat.dev/${lang}/docs`

const links = (lang: Lang) =>
  [
    { label: "website", href: "https://wirecat.dev" },
    { label: "docs", href: docsPage(lang) },
    { label: "source", href: REPO },
    { label: "privacy", href: `https://wirecat.dev/${lang}/privacy` },
  ] as const

type System = { os: string; arch: string } | null

const build = [__BUILD_COMMIT__, __BUILD_DATE__].filter(Boolean).join(", ")

function versionLine(system: System) {
  const parts = [`WireCat ${__APP_VERSION__}${build ? ` (${build})` : ""}`]
  if (system) parts.push(`${system.os} ${system.arch}`)
  return parts.join(" · ")
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useMessages(aboutMessages)
  const lang = useLang()
  const readiness = useSystem((s) => s.readiness)
  const installs = useTools((s) => s.installs)
  const installed = tools.flatMap((t) => {
    const version = t.partOf ? null : installs[t.id]?.[0]?.version
    return version ? [{ id: t.id, name: t.name, version }] : []
  })

  const report = () => {
    onClose()
    useReport.getState().start()
  }

  return (
    <Dialog open={open} title={m.title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Monogram className="size-[3rem] shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-[1.05rem] font-semibold text-ink">{PRODUCT}</p>
            <p>{m.summary}</p>
          </div>
        </div>

        <section aria-label={m.version} className="rounded-[0.45rem] border border-line bg-app-2 px-4 py-3">
          <div className="flex items-start gap-3">
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.875rem]">
              <Fact term={m.version}>{__APP_VERSION__}</Fact>
              {build && <Fact term={m.build}>{build}</Fact>}
              {readiness && <Fact term={m.system}>{`${readiness.os} ${readiness.arch}`}</Fact>}
            </dl>
            <CopyButton value={versionLine(readiness)} label={m.copy} title={m.copyTitle(versionLine(readiness))} />
          </div>
          {installed.length > 0 && (
            <p className="mt-2 border-line border-t pt-2 text-[0.9rem] text-ink-dim">
              {installed.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && " · "}
                  <span className="whitespace-nowrap">
                    {t.name} <span className="font-mono tabular-nums">{t.version}</span>
                  </span>
                </Fragment>
              ))}
            </p>
          )}
        </section>

        <nav aria-label={m.links}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {links(lang).map((l) => (
              <li key={l.href}>
                <ExtLink href={l.href} className="font-medium">
                  {m[l.label]}
                </ExtLink>
              </li>
            ))}
            <li>
              <LinkButton onClick={report}>{m.report}</LinkButton>
            </li>
          </ul>
        </nav>

        <p className="border-line border-t pt-4 text-[0.875rem] text-ink-dim">
          {m.madeBy(AUTHOR, COPYRIGHT_YEAR)}
          <br />
          {m.license(
            <ExtLink href={`${REPO}/blob/main/LICENSE`} className="font-medium">
              {LICENSE}
            </ExtLink>,
          )}
        </p>
      </div>
    </Dialog>
  )
}

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <>
      <dt className="text-ink-dim">{term}</dt>
      <dd className="selectable min-w-0 font-mono text-ink tabular-nums">{children}</dd>
    </>
  )
}
