import { Bug } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { AboutDialog, docsPage } from "@/features/about/AboutDialog"
import { HOME_SECTION, useNav } from "@/features/nav"
import { Bell } from "@/features/notifications/Bell"
import { CHECK_EVERY_MS as NEWS_EVERY_MS, useNotifications } from "@/features/notifications/store"
import { type HelpActions, HelpMenu } from "@/features/onboarding/HelpMenu"
import { Onboarding, SetupSteps } from "@/features/onboarding/Onboarding"
import { resumeSetup } from "@/features/onboarding/resume"
import { useOnboarding } from "@/features/onboarding/store"
import { Tour, useTour } from "@/features/onboarding/Tour"
import { PrivacyDialog } from "@/features/privacy/PrivacyDialog"
import { ReportDialog } from "@/features/report/ReportDialog"
import { useReport } from "@/features/report/store"
import { useApplyScale, useScaleKeys } from "@/features/settings/scale"
import { BotSignInDialog } from "@/features/signin/BotSignInDialog"
import { SignInDialog } from "@/features/signin/SignInDialog"
import { useSystem } from "@/features/system/store"
import { ClearDataOffer } from "@/features/tools/ClearDataOffer"
import { CHECK_EVERY_MS, useUpdate } from "@/features/update/store"
import { UpdateButton, UpdateDialog } from "@/features/update/UpdateDialog"
import { currentLang, useApplyLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { useFinishBoot } from "./boot"
import { ErrorBoundary } from "./ErrorBoundary"
import { useSectionHistory, useSectionSwitch } from "./history"
import { appMessages } from "./messages"
import { Sidebar } from "./Sidebar"
import { CrashScenario } from "./scenarios"
import { sections } from "./sections"
import { TopBar } from "./TopBar"
import { useApplyTheme } from "./theme"

export function App() {
  useApplyTheme()
  useApplyLang()
  const m = useMessages(appMessages)
  useApplyScale()
  useScaleKeys()
  useFinishBoot()
  const active = useNav((s) => s.active)
  const setActive = useNav((s) => s.go)
  const onboarding = useOnboarding((s) => s.open)
  useSectionHistory(!onboarding)
  const Page = sections.find((s) => s.id === active)?.page
  const main = useRef<HTMLElement>(null)
  useSectionSwitch(main, onboarding ? null : active)

  const startTour = () => useTour.getState().start()
  const toHome = () => setActive(HOME_SECTION)
  const [about, setAbout] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const help: HelpActions = {
    onDocs: () => void platform.openUrl(docsPage(currentLang())),
    onTour: startTour,
    onWelcome: () => useOnboarding.getState().reopen("welcome"),
    onPrivacy: () => setPrivacy(true),
    onAbout: () => setAbout(true),
  }
  useEffect(() => {
    if (useOnboarding.getState().resuming) void resumeSetup("start")
    else if (!useSystem.getState().readiness) void useSystem.getState().refresh()
  }, [])
  useEffect(() => {
    const check = () => useUpdate.getState().check()
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const check = () => useNotifications.getState().check()
    check()
    const timer = setInterval(check, NEWS_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex h-full">
      {/* Setup and the app swap their side column and page; each arrives with a fade, never a cut. */}
      {onboarding ? (
        <SetupSteps key="setup" onExit={toHome} />
      ) : (
        <Sidebar key="app" active={active} onSelect={setActive} help={help} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          {!onboarding && (
            <>
              <UpdateButton />
              <Button
                variant="ghost"
                size="sm"
                data-tour="report-problem"
                title={m.reportProblemTitle}
                icon={<Bug className="size-4" strokeWidth={1.8} aria-hidden />}
                onClick={() => useReport.getState().start()}
              >
                {m.reportProblem}
              </Button>
              <Bell />
              <HelpMenu {...help} />
            </>
          )}
        </TopBar>
        {onboarding ? (
          <ErrorBoundary scope="page">
            <Onboarding onExit={toHome} onTour={() => useTour.getState().start("setup")} />
          </ErrorBoundary>
        ) : (
          <main ref={main} className="relative min-h-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={active} scope="page">
              <CrashScenario section={active} />
              {Page && <Page />}
            </ErrorBoundary>
          </main>
        )}
        <ClearDataOffer />
        <AboutDialog open={about} onClose={() => setAbout(false)} />
        <PrivacyDialog open={privacy} onClose={() => setPrivacy(false)} />
        <SignInDialog />
        <BotSignInDialog />
        <ReportDialog />
        <UpdateDialog />
      </div>
      <Tour />
    </div>
  )
}
