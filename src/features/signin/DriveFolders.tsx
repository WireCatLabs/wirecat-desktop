import { explainFailure } from "@/domain/signin-failure"
import { DriveFolderPicker, driveMessages, type FailedLevel } from "@/features/tools"
import { useMessages } from "@/i18n"
import { useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { wizardMessages } from "./messages-wizard"
import { SyncNow } from "./ZoomApp"

/** After Drive signs in: the folder picker, and a sign-in's own words when Drive refuses to list them. */
export function DriveFolders({ tool, profile, name }: { tool: string; profile: string; name: string }) {
  return (
    <DriveFolderPicker
      tool={tool}
      profile={profile}
      failed={(level, retry) => <LevelFailed level={level} name={name} profile={profile} onRetry={retry} />}
      after={<SyncNow tool={tool} profile={profile} />}
    />
  )
}

function LevelFailed({
  level,
  name,
  profile,
  onRetry,
}: {
  level: FailedLevel
  name: string
  profile: string
  onRetry: () => void
}) {
  const wm = useMessages(wizardMessages)
  const sm = useMessages(driveMessages)
  const explained = explainFailure({
    tool: "drive",
    profile,
    message: level.message,
    code: level.code,
    reason: level.reason,
    at: null,
    otherMethod: false,
    terminal: false,
  })
  const text = wm.failure[explained.reason]
  const signInAgain = explained.reason === "signedOut" || explained.reason === "signInExpired"
  return (
    <ErrorNotice
      detail={<p>{text.cause(name)}</p>}
      action={
        explained.reason === "needsUpdate" ? undefined : signInAgain ? (
          <Button size="sm" variant="secondary" onClick={() => useSignIn.getState().again()}>
            {wm.actions.retry}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {sm.picker.retry}
          </Button>
        )
      }
    >
      <span className="font-medium">{text.title(name)}</span>
    </ErrorNotice>
  )
}
