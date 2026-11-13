import { QueryClientProvider } from "@tanstack/react-query"
import { Bug } from "lucide-react"
import { Suspense, useEffect, useRef, useState } from "react"
import { AboutDialog, docsPage } from "@/features/about"
import { useDigestWatch } from "@/features/digests"
import { useDeepLinks } from "@/features/links"
import { Bell, followDockBadge, CHECK_EVERY_MS as NEWS_EVERY_MS, useNotifications } from "@/features/notifications"
import { type HelpActions, HelpMenu, Onboarding, resumeSetup, SetupSteps, Tour, useTour } from "@/features/onboarding"
import { PrivacyDialog } from "@/features/privacy"
import { ReportDialog } from "@/features/report"
import { useApplyChoices, useApplyScale, useScaleKeys } from "@/features/settings"
import { BotSignInDialog, SignInDialog } from "@/features/signin"
import { ClearDataOffer, useRegistry } from "@/features/tools"
import { CHECK_EVERY_MS, UpdateButton, UpdateDialog, useUpdate } from "@/features/update"
import { currentLang, useApplyLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { HOME_SECTION, useNav } from "@/shared/nav"
import { useOnboarding } from "@/shared/onboarding-store"
import { queryClient } from "@/shared/query"
import { useReport } from "@/shared/report-store"
import { useSystem } from "@/shared/system-store"
import { Button } from "@/ui/Button"
import { useFinishBoot } from "./boot"
import { CrashScenario } from "./CrashScenario"
import { ErrorBoundary } from "./ErrorBoundary"
import { useSectionHistory, useSectionSwitch } from "./history"
import { LinkFailure } from "./LinkFailure"
import { LinkMenu } from "./LinkMenu"
import { appMessages } from "./messages"
import { PageSkeleton } from "./PageSkeleton"
import { SandboxBanner, SandboxConfirm } from "./Sandbox"
import { Sidebar } from "./Sidebar"
import { pageOf, type SectionId, sections, tabsOf } from "./sections"
import { TabbedPage } from "./TabbedPage"
import { TopBar } from "./TopBar"
import { TopNotices } from "./TopNotices"
import { useApplyTheme } from "./theme"

export function App() {
  return (
    <QueryClientProvider client={queryClient()}>
      <Shell />
    </QueryClientProvider>
  )
}

function Shell() {
  useApplyTheme()
  useApplyLang()
  const m = useMessages(appMessages)
  useApplyScale()
  useApplyChoices()
  useScaleKeys()
  useFinishBoot()
  const active = useNav((s) => s.active)
  const setActive = useNav((s) => s.go)
  const onboarding = useOnboarding((s) => s.open)
  useSectionHistory(!onboarding)
  useDeepLinks(!onboarding)
  useDigestWatch(!onboarding)
  const Page = sections.find((s) => s.id === active)?.page
  // A tab switch keeps the page, its scroll and its focus; only a move to another page plays the page switch.
  const shown = pageOf(active)
  const tabbed = tabsOf(shown).length > 0
  // A page saved by an older version may be gone or not built yet.
  useEffect(() => {
    if (!Page) useNav.setState({ active: HOME_SECTION })
  }, [Page])
  const main = useRef<HTMLElement>(null)
  useSectionSwitch(main, onboarding ? null : shown)

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
    const check = () => {
      void useNotifications.getState().check()
      void useRegistry.getState().check()
    }
    check()
    const timer = setInterval(check, NEWS_EVERY_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => followDockBadge(), [])

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
        <SandboxBanner />
        <TopNotices />
        <LinkFailure />
        <LinkMenu />
        {onboarding ? (
          <ErrorBoundary scope="page">
            <Onboarding onExit={toHome} onTour={() => useTour.getState().start("setup")} />
          </ErrorBoundary>
        ) : (
          <main ref={main} className="relative min-h-0 flex-1 overflow-y-auto">
            <ErrorBoundary key={shown} scope="page">
              {!tabbed && <CrashScenario section={active} />}
              {Page && tabbed ? (
                <TabbedPage page={shown as SectionId} active={active} />
              ) : (
                Page && (
                  <Suspense fallback={<PageSkeleton />}>
                    <Page />
                  </Suspense>
                )
              )}
            </ErrorBoundary>
          </main>
        )}
        <ClearDataOffer />
        <AboutDialog open={about} onClose={() => setAbout(false)} />
        <PrivacyDialog open={privacy} onClose={() => setPrivacy(false)} />
        <SignInDialog />
        <BotSignInDialog />
        <SandboxConfirm />
        <ReportDialog />
        <UpdateDialog />
      </div>
      <Tour />
    </div>
  )
}
