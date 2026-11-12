import type { ReactNode } from "react"
import { useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { CloudflareStatus } from "@/platform/cloudflare-schemas"
import { ExtLink } from "@/shared/ExtLink"
import { errorText } from "@/shared/errors"
import { OpenLink } from "@/shared/OpenLink"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import type { useCloudflare } from "./api"
import { type CloudflareStepId, cloudflareSteps } from "./cloudflare-steps"
import { tunnelMessages } from "./messages-tunnel"
import { StepHead } from "./TailscaleGuide"
import { DownloadRow, Note, Para } from "./tunnel-parts"

type Words = (typeof tunnelMessages)["en"]["cloudflare"]

const EXAMPLE_HOST = "wirecat.example.com"

const PAGES = {
  downloads: "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/",
  addDomain: "https://developers.cloudflare.com/fundamentals/manage-domains/add-site/",
  signUp: "https://dash.cloudflare.com/sign-up",
}

function InstallStep({ s, m, check }: { s: CloudflareStatus; m: Words; check(): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!s.supported) return <Para>{m.unsupported(<ExtLink href={PAGES.downloads}>{m.downloads}</ExtLink>)}</Para>
  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareInstall()
      await check()
    } catch (e) {
      if (errorText(e) !== "Stopped.") setError(errorText(e))
    }
    setBusy(false)
  }
  return (
    <>
      <Para>{m.install}</Para>
      <DownloadRow
        label={busy ? m.downloading : m.download}
        busy={busy}
        checksum={m.checksum}
        onDownload={download}
        stop={
          <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
            {m.stop}
          </Button>
        }
      />
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

function AccountStep({ again, m, check }: { again: boolean; m: Words; check(): Promise<void> }) {
  const [page, setPage] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const live = useRef(false)
  live.current = waiting
  useEffect(
    () => () => {
      if (live.current) platform.cloudflareStop()
    },
    [],
  )

  const login = async () => {
    setWaiting(true)
    setError(null)
    setPage(null)
    try {
      await platform.cloudflareLogin(setPage)
    } catch (e) {
      if (errorText(e) !== "Stopped.") setError(errorText(e))
    }
    setWaiting(false)
    check()
  }

  return (
    <>
      {!again && <Para>{m.account}</Para>}
      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <>
            <span className="text-[0.9rem] text-ink" role="status">
              {m.waiting}
            </span>
            {page && <OpenLink url={page}>{m.pageAgain}</OpenLink>}
            <Button size="sm" variant="ghost" onClick={() => platform.cloudflareStop()}>
              {m.stop}
            </Button>
          </>
        ) : (
          <Button size="sm" variant={again ? "secondary" : "primary"} onClick={login}>
            {again ? m.again : m.connect}
          </Button>
        )}
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
      {!again && (
        <Note>
          {m.noAccount(
            <ExtLink href={PAGES.signUp}>{m.signUp}</ExtLink>,
            <ExtLink href={PAGES.addDomain}>{m.addDomain}</ExtLink>,
          )}
        </Note>
      )}
    </>
  )
}

function AddressStep({ s, m, check }: { s: CloudflareStatus; m: Words; check(): Promise<void> }) {
  const id = useId()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    if (busy) return
    if (!name.trim()) {
      setError(m.nameEmpty)
      document.getElementById(id)?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await platform.cloudflareCreate(name)
      await check()
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(false)
  }
  return (
    <>
      <Para>{m.name}</Para>
      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className="text-[0.9rem] font-medium text-ink-dim">{m.nameLabel}</span>
        <input
          id={id}
          className="h-8 w-full max-w-[24rem] rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.85rem] text-ink placeholder:font-sans placeholder:text-ink-dim"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          aria-invalid={error !== null}
          placeholder={EXAMPLE_HOST}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {s.hostname && <Note>{m.stays(<span className="selectable font-mono">{s.hostname}</span>)}</Note>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={create} disabled={busy}>
          {busy ? m.making : m.make}
        </Button>
      </div>
      {error && <ErrorNotice inline>{error}</ErrorNotice>}
    </>
  )
}

/** The three steps from nothing to a tunnel on the owner's domain; each says what happens before it runs. */
export function CloudflareGuide({ cloudflare }: { cloudflare: ReturnType<typeof useCloudflare> }) {
  const { status, error, checking, check } = cloudflare
  const m = useMessages(tunnelMessages).cloudflare
  const [checked, setChecked] = useState<CloudflareStepId | null>(null)

  if (!status)
    return error ? (
      <ErrorNotice inline raw={error}>
        {m.unreadable}
      </ErrorNotice>
    ) : (
      <Skeleton className="h-[12rem] w-full" label={m.reading} />
    )

  const steps = cloudflareSteps(status)
  const current = steps.find((s) => !s.done)?.id ?? null
  const body: Record<CloudflareStepId, ReactNode> = {
    install: <InstallStep s={status} m={m} check={check} />,
    account: <AccountStep again={false} m={m} check={check} />,
    address: <AddressStep s={status} m={m} check={check} />,
  }

  return (
    <ol className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line" aria-label={m.list}>
      {steps.map((step, i) => {
        const open = step.id === current
        return (
          <li key={step.id} className="flex flex-col px-4 py-3" aria-current={open ? "step" : undefined}>
            <StepHead
              title={m.titles[step.id]}
              done={step.done}
              index={i}
              open={open}
              checking={checking}
              checked={checked === step.id}
              onCheck={async () => {
                await check()
                setChecked(step.id)
              }}
            />
            <Collapse open={open} className="flex flex-col gap-2.5 pt-2.5 pl-9 text-[0.9rem]">
              {step.missing && checked === step.id && <p className="text-warn-ink">{m.missing[step.missing]}</p>}
              {body[step.id]}
            </Collapse>
            {step.id === "address" && step.done && status.hostname && (
              <div className="flex flex-col gap-2 pt-2.5 pl-9 text-[0.9rem]">
                <p>{m.yours(<span className="selectable font-mono text-ink">{status.hostname}</span>)}</p>
                <AccountStep again m={m} check={check} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
