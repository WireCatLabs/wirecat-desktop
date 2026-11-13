import { Suspense, useState } from "react"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { Page, PageAsTab, PageHeader } from "@/shared/Page"
import { Skeleton } from "@/ui/Skeleton"
import { LineTab, TabList, TabPanel, Tabs } from "@/ui/Tabs"
import { useBadges } from "./badges"
import { CrashScenario } from "./CrashScenario"
import { ErrorBoundary } from "./ErrorBoundary"
import { appMessages } from "./messages"
import { type SectionId, tabsOf } from "./sections"

/**
 * A sidebar page made of tabs (Tools and Agents, Analytics and Storage): one title, the tabs under it, the selected
 * tab's page below. The selected tab is the section on screen, so a reload, back and forward and every old link to
 * the tab's page land on it. The frame stays mounted across tabs, so the focus stays on the tab the keyboard moved to;
 * the new tab's page fades in under it.
 */
export function TabbedPage({ page, active }: { page: SectionId; active: string }) {
  const m = useMessages(appMessages)
  const tabs = tabsOf(page)
  const badges = useBadges(active)
  const Shown = tabs.find((t) => t.id === active)?.page
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <Page>
      <PageHeader title={m.nav[page]} section={page} />
      <Tabs
        selectedKey={active}
        onSelectionChange={(key) => useNav.getState().go(String(key))}
        className="flex flex-col gap-[1.5rem]"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-line border-b">
          <TabList aria-label={m.nav[page]} className="flex gap-[1.8rem]">
            {tabs.map((t) => (
              <LineTab
                key={t.id}
                id={t.id}
                size="lg"
                data-tour={`tab-${t.id}`}
                extra={
                  badges[t.id] && (
                    <>
                      <span aria-hidden className="ml-[0.5rem] size-[0.5rem] rounded-full bg-brand" />
                      <span className="sr-only">{m.badgeNew}</span>
                    </>
                  )
                }
              >
                {m.tabName[t.id] ?? m.nav[t.id]}
              </LineTab>
            ))}
          </TabList>
          {/* The selected tab's status and actions, as on the title's line of any other page. */}
          <div ref={setActions} className="flex min-w-0 flex-wrap items-center gap-2" />
        </div>
        {/* Keyed: the library keeps a panel's first id, so a reused panel would name the tab it was mounted for. */}
        <TabPanel key={active} id={active} className="reveal">
          {/* Per tab: a broken tab keeps the tabs, so the other one still opens. */}
          <ErrorBoundary scope="page">
            <CrashScenario section={active} />
            <Suspense fallback={<TabSkeleton />}>
              <PageAsTab actions={actions}>{Shown && <Shown />}</PageAsTab>
            </Suspense>
          </ErrorBoundary>
        </TabPanel>
      </Tabs>
    </Page>
  )
}

/** A tab's page loading: its header line and a block, inside the frame the tabbed page already draws. */
function TabSkeleton() {
  return (
    <div data-page-loading className="flex flex-col gap-[1.5rem]">
      <Skeleton className="h-[2rem] w-[min(60ch,100%)]" />
      <Skeleton className="h-[16rem] w-full" />
    </div>
  )
}
