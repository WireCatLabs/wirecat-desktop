import { LogIn, Terminal } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type CatalogTool, signsInHere } from "@/domain/catalog"
import { accountReady, afterSignIn, signInGroups, signsIn } from "@/domain/onboarding-flow"
import { ManualSetup, NewProfile, TerminalStatus, useProfiles, useTerminal } from "@/features/tools"
import { formatList, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import { useOnboarding } from "@/shared/onboarding-store"
import { ReportThis } from "@/shared/ReportThis"
import { useSignIn } from "@/shared/signin-store"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { MOTION } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { onboardingMessages } from "./messages"
import { useSetupTools } from "./setup-tools"
import { rack } from "./step-styles"

/** Without `onSignIn` the tool has no sign-in of its own: a listed account is simply there. */
function ProfileState({
  profile,
  onSignIn,
  here,
}: {
  profile: Profile
  onSignIn: (() => void) | undefined
  here: boolean
}) {
  const m = useMessages(onboardingMessages).signIn
  const name = <span className="font-mono font-medium text-ink">{profile.name}</span>
  if (!onSignIn) {
    return (
      <li className="flex min-h-8 items-center gap-x-[0.6rem]">
        <Lamp size="sm" tone="ok" />
        <span className="min-w-0 flex-1 text-body text-ink-soft">{m.added(name)}</span>
      </li>
    )
  }
  return (
    <li className="flex min-h-8 flex-wrap items-center gap-x-[0.6rem] gap-y-1">
      <Lamp size="sm" tone={profile.signedIn ? "ok" : "idle"} />
      <span className="min-w-0 flex-1 text-body text-ink-soft">
        {profile.signedIn === true
          ? m.signedIn(name)
          : profile.signedIn === false
            ? m.signedOut(name)
            : m.unknown(name)}
      </span>
      {profile.signedIn !== true && (
        <Button
          size="sm"
          variant={profile.signedIn === false ? "primary" : "ghost"}
          onClick={onSignIn}
          icon={here ? <LogIn className="size-4" aria-hidden /> : <Terminal className="size-4" aria-hidden />}
        >
          {here ? m.signIn : m.inTerminal}
        </Button>
      )}
    </li>
  )
}

const signInBlock = "flex flex-col gap-[0.9rem] border-line border-b px-[1.3rem] py-[1.1rem] last:border-b-0"
const accountsArea = "flex flex-col gap-[0.9rem] sm:pl-[2.4rem]"

function SignInHeader({ tool }: { tool: CatalogTool }) {
  const m = useMessages(onboardingMessages).signIn
  return (
    <div className="flex items-start gap-[0.9rem]">
      <ToolIcon id={tool.id} className="mt-[0.05rem] size-[1.5rem] shrink-0 text-ink" />
      <div className="min-w-0">
        <h3 className="text-[1.08rem] font-semibold leading-tight">{tool.name}</h3>
        {tool.signIn && (
          <p className="mt-1 text-body leading-relaxed text-ink-soft">{m.gives[tool.id] ?? tool.signIn.gives}</p>
        )}
      </div>
    </div>
  )
}

/** One account line and the "Add another account" line: the usual shape once the accounts are read. */
function AccountsSkeleton({ tool }: { tool: CatalogTool }) {
  const m = useMessages(onboardingMessages).signIn
  return (
    <>
      <Skeleton className="h-8 w-full" label={m.reading(tool.name)} />
      <Skeleton className="h-8 w-[10.5rem]" />
    </>
  )
}

function PendingSignInRow({ tool }: { tool: CatalogTool }) {
  return (
    <li className={signInBlock}>
      <SignInHeader tool={tool} />
      <div className={accountsArea}>
        <AccountsSkeleton tool={tool} />
      </div>
    </li>
  )
}

function SignInRow({
  tool,
  onReady,
}: {
  tool: CatalogTool
  onReady: (id: string, ready: boolean | undefined) => void
}) {
  const { profiles, error, loading, reload } = useProfiles(tool.id)
  const [adding, setAdding] = useState(false)
  const m = useMessages(onboardingMessages).signIn
  const manual = !tool.setup
  const count = profiles?.length ?? 0
  const seen = useRef(count)
  const ready = loading ? undefined : accountReady(profiles, manual)

  useEffect(() => {
    onReady(tool.id, ready)
  }, [onReady, tool.id, ready])

  // The form opens only on a click, so it closes by itself once the account it was for shows up.
  useEffect(() => {
    if (count > seen.current) setAdding(false)
    seen.current = count
  }, [count])

  const signInAgain = async (profile: string) => {
    if (signsInHere(tool)) return useSignIn.getState().start(tool.id, profile, reload)
    await useTerminal.getState().open(tool.id, profile)
  }

  return (
    <li className={signInBlock}>
      <SignInHeader tool={tool} />
      <div className={accountsArea}>
        {error ? (
          <ErrorNotice
            inline
            action={<ReportThis what={`Listing ${tool.name} accounts`} tool={tool.id} error={error} />}
          >
            {m.listFailed(error)}
          </ErrorNotice>
        ) : profiles === undefined ? (
          <AccountsSkeleton tool={tool} />
        ) : (
          <ul aria-label={m.accounts(tool.name)} className="flex flex-col gap-1">
            {count > 0 ? (
              profiles?.map((p) => (
                <ProfileState
                  key={p.name}
                  profile={p}
                  here={signsInHere(tool)}
                  onSignIn={manual ? undefined : () => signInAgain(p.name)}
                />
              ))
            ) : (
              <li className="flex min-h-8 items-center gap-x-[0.6rem]">
                <Lamp size="sm" tone="idle" />
                <span className="text-body font-medium text-ink">{m.noAccount(tool.name)}</span>
              </li>
            )}
          </ul>
        )}
        <TerminalStatus tool={tool} profiles={profiles} onCheck={reload} checking={loading} />
        <AutoHeight swap={adding}>
          <Crossfade swap={adding ? "adding" : "list"} ms={MOTION.normal}>
            {adding ? (
              <>
                {tool.signIn && (
                  <p className="max-w-[65ch] text-body leading-relaxed text-ink-soft">
                    <span className="font-medium text-ink">{manual ? m.needs : m.willAsk}</span>
                    {m.asks[tool.id] ?? tool.signIn.asks}
                    {tool.signIn.guide && !manual && (
                      <>
                        {" "}
                        <a
                          href={tool.signIn.guide}
                          onClick={(e) => {
                            e.preventDefault()
                            if (tool.signIn?.guide) platform.openUrl(tool.signIn.guide)
                          }}
                          className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
                        >
                          {m.guide}
                        </a>
                      </>
                    )}
                  </p>
                )}
                {manual ? (
                  <ManualSetup tool={tool} onCheck={reload} checking={loading} />
                ) : (
                  <NewProfile tool={tool} label={count ? m.addAnother : m.add} onCheck={reload} />
                )}
              </>
            ) : profiles === undefined && !error ? null : (
              <div>
                <Button
                  size="sm"
                  variant={count ? "ghost" : "primary"}
                  className={count ? "-ml-3" : undefined}
                  onClick={() => setAdding(true)}
                >
                  {count ? m.addAnother : m.add}
                </Button>
              </div>
            )}
          </Crossfade>
        </AutoHeight>
      </div>
    </li>
  )
}

export function SignIn() {
  const installs = useTools((s) => s.installs)
  const failed = useTools((s) => s.error !== null)
  const m = useMessages(onboardingMessages).signIn
  const list = useSetupTools()
  const detected = Object.keys(installs).length > 0
  const { ready, waiting, noSignIn } = signInGroups(list, installs)
  const [readyById, setReadyById] = useState<Record<string, boolean | undefined>>({})
  const onReady = useCallback(
    (id: string, ready: boolean | undefined) =>
      setReadyById((all) => (all[id] === ready && id in all ? all : { ...all, [id]: ready })),
    [],
  )
  // A sign-in that ended well in the window leads on once its dialog is closed: the step behind it has nothing left
  // to do when every tool has an account, and "You are set up" says so (owner, 2026-11-05).
  const succeeded = useSignIn((s) => s.phase === "done")
  const dialogOpen = useSignIn((s) => s.tool !== null)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    if (succeeded) setSignedIn(true)
  }, [succeeded])
  const next = signedIn && !dialogOpen ? afterSignIn(ready.map((t) => readyById[t.id])) : "wait"
  useEffect(() => {
    if (next === "done") useOnboarding.getState().go("done")
    if (next !== "wait") setSignedIn(false)
  }, [next])

  // Until the tools are found, the chosen ones stand in: they are the ones just installed.
  if (!detected && !failed) {
    const chosen = list.filter(signsIn)
    if (chosen.length === 0) return <Skeleton className="h-24 w-full" label={m.looking} />
    return (
      <ul aria-label={m.list} className={rack}>
        {chosen.map((t) => (
          <PendingSignInRow key={t.id} tool={t} />
        ))}
      </ul>
    )
  }

  return (
    <>
      {ready.length > 0 ? (
        <ul aria-label={m.list} className={rack}>
          {ready.map((t) => (
            <SignInRow key={t.id} tool={t} onReady={onReady} />
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-soft">{m.noneNeeded}</p>
      )}
      {waiting.length > 0 && (
        <p className="text-body text-ink-soft">{m.later(waiting.length, formatList(waiting.map((t) => t.name)))}</p>
      )}
      {noSignIn.length > 0 && (
        <p className="text-body text-ink-soft">
          {m.noSignIn(noSignIn.length, formatList(noSignIn.map((t) => t.name)))}
        </p>
      )}
    </>
  )
}
