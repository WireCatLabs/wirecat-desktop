import { useEffect } from "react"
import { Page } from "@/shared/Page"
import { AutoHeight } from "@/ui/AutoHeight"
import { Crossfade } from "@/ui/Crossfade"
import { TabPanel, Tabs } from "@/ui/Tabs"
import { AgentList, selectedEntry, useAgentChoice } from "./AgentList"
import { AgentPane } from "./AgentPane"
import { useConnect } from "./connect"
import { Dialogs, Elsewhere, Notices, PageHead } from "./PageParts"
import { useAgentsView } from "./view"

export function AgentsPage() {
  const view = useAgentsView()
  const chosen = useAgentChoice((s) => s.chosen)
  const choose = useAgentChoice((s) => s.choose)
  const selected = selectedEntry(view.entries, chosen)
  const selectedFound = selected?.type === "found" ? selected.id : null
  const { opened } = view
  const checking = useConnect((s) => (selectedFound ? s.checking[selectedFound] === true : false))
  const shown = selected ? `${selected.type}:${selected.id}` : "none"
  // The pane can open on an agent nobody clicked, and its details still need that agent's own check.
  useEffect(() => {
    if (selectedFound) opened(selectedFound)
  }, [selectedFound, opened])

  return (
    // The page fills the window from its first frame, so details arriving inside the pane do not grow it.
    <Page className="@container min-h-full">
      <PageHead view={view} />
      <Notices view={view} />
      {!view.agentsError && (
        <Tabs
          orientation="vertical"
          {...(selected ? { selectedKey: selected.id } : {})}
          onSelectionChange={(k) => choose(String(k))}
          className="grid flex-1 content-start gap-3 @min-[52rem]:content-stretch @min-[52rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[52rem]:gap-0 @min-[80rem]:grid-cols-[17rem_minmax(0,1fr)]"
        >
          <AgentList entries={view.entries} />
          <TabPanel
            id={selected?.id ?? ""}
            className="min-h-[24rem] rounded-[0.2rem] border border-line-strong bg-app px-[1.5rem] pt-4 pb-5"
          >
            {/* The agent's own check adds rows when it ends; that growth slides like a switch instead of snapping. */}
            <AutoHeight swap={`${shown}:${checking}`}>
              <Crossfade swap={shown}>
                <AgentPane entry={selected} all={view} />
              </Crossfade>
            </AutoHeight>
          </TabPanel>
        </Tabs>
      )}
      <Elsewhere view={view} />
      <Dialogs />
    </Page>
  )
}
