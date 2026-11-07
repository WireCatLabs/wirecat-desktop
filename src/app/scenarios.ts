import { useSeen } from "@/app/badges"
import { findTool, syncNeedsProfile } from "@/domain/catalog"
import { useNotifications } from "@/features/notifications"
import { useSearch } from "@/features/search"
import { useTasks } from "@/features/tasks"
import { useSync } from "@/features/tools"
import { platform } from "@/platform/bridge"
import { showcase, showcaseQuery } from "@/platform/mock-showcase"
import { MOCK_NOMATCH_QUERY } from "@/platform/mock-tasks"
import { useBotSignIn } from "@/shared/bot-signin-store"
import { useNav } from "@/shared/nav"
import { STEPS, useOnboarding } from "@/shared/onboarding-store"
import { useSignIn } from "@/shared/signin-store"
import { useTools } from "@/shared/tools-store"

// Browser-only: starts the install named in `?install=<tool>` so a review can capture the progress state.
// `?onboarding=off` hides the first-run setup for this load, so captures of other screens stay as they were;
// `?onboarding=<step>` opens it at that step. `?section=<id>` opens that page without a click, so a layout-shift
// measurement is not hidden by the browser's 500 ms grace period after input. `?crash=<section>` opens that section
// and breaks its render. `?signin=<tool>` starts that tool's in-window sign-in for a profile named personal; `?signin-plan=<tool>` opens it on its plan.
// `?bot=<tool>` opens that tool's details and its bot dialog; `?bot-step=token` with a name, sales (`mock-bot.ts`).
// `?mcp=<tool>` and `?mcp-fail=<tool>` open that tool's details, where its MCP server section starts open.
// `?connect=<state>` opens tg's details at that step of the guide (`src/features/tools/connect-scenario.ts`).
// `?tasks=<state>` and `?view=table|board` open the Tasks page in that state (`src/platform/mock-tasks.ts`); `?task=<key>`
// opens that task's dialog there.
// `?sync=<tool>` opens that tool's details and starts its sync for personal (`src/platform/mock-sync.ts`).
// `?memo=<state>` and `?memo-fail=<kind>` open memo's details at its first-run card (`src/platform/mock-notes-setup.ts`).
// `?showcase` hides the setup and the Agents dot.
// `?tailscale=<state>` opens tg's, with the "MCP server (or connect web)" guide's Tailscale steps at that state (`src/platform/mock-tailscale.ts`); `?cloudflare=<state>` the same with the Cloudflare tunnel (`mock-cloudflare.ts`).
export async function runMockScenario() {
  if (platform.kind !== "mock") return
  const params = new URLSearchParams(window.location.search)
  if (showcase) {
    useOnboarding.getState().hide()
    useSeen.getState().see("agents")
  }
  const crash = params.get("crash")
  if (crash) useNav.getState().go(crash)
  const onboarding = params.get("onboarding")
  if (onboarding === "off") useOnboarding.getState().hide()
  const section = params.get("section")
  if (section) useNav.getState().go(section)
  const step = STEPS.find((s) => s === onboarding)
  if (step) useOnboarding.getState().reopen(step)
  const tasks = params.get("tasks")
  const view = params.get("view")
  if (tasks || view) {
    if (view === "board" || view === "table") useTasks.setState({ view })
    if (tasks === "nomatch") useTasks.setState({ query: MOCK_NOMATCH_QUERY })
    useNav.getState().go("tasks")
  }
  const task = params.get("task")
  if (task) {
    useNav.getState().go("tasks")
    void useTasks.getState().openTask(task)
  }
  if (params.get("notifications") === "open") openBell()
  const [signIn, signInMethod] = (params.get("signin") ?? "").split(":")
  if (signIn) {
    useSignIn.getState().start(signIn, "personal")
    if (signInMethod) useSignIn.setState({ method: signInMethod })
    useSignIn.getState().begin()
  }
  const failing = params.get("signin-fail")?.split(":")
  if (failing?.length === 2 && failing[0] && !signIn) {
    useSignIn.getState().start(failing[0], "personal")
    useSignIn.getState().begin()
  }
  const plan = params.get("signin-plan")
  if (plan) useSignIn.getState().start(plan, "personal")
  const bot = params.get("bot") ?? params.get("bot-fail")
  if (bot) {
    const id = findTool(bot) ? bot : "tg"
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(id)
    useBotSignIn.getState().open(id)
    if (params.get("bot-step") === "token") useBotSignIn.getState().toToken("sales")
  }
  const mcp =
    params.get("mcp") ??
    params.get("mcp-fail") ??
    params.get("mcp-old") ??
    params.get("funnel-old") ??
    params.get("code-used") ??
    params.get("service")?.split(":")[0] ??
    params.get("service")?.split(":")[0] ??
    (params.has("tailscale") || params.has("connect") || params.has("cloudflare") ? "tg" : null)
  if (mcp) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(mcp)
  }
  if (params.has("memo") || params.has("memo-fail")) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle("memo")
  }
  const sync = ["sync", "sync-hold", "sync-fail", "sync-timeout", "sync-limited"]
    .map((k) => params.get(k))
    .find((v) => v && v !== "never")
  const syncing = sync ? findTool(sync) : undefined
  if (syncing) {
    useNav.getState().go("tools")
    await useTools.getState().refresh()
    useTools.getState().toggle(syncing.id)
    useSync.getState().start(syncing.id, syncNeedsProfile(syncing) ? "personal" : null)
  }
  await searchScenario(params)
  const ids = params.get("install")?.split(",").filter(Boolean) ?? []
  if (ids.length === 0) return
  // So `?onboarding=install&install=<tool>[,<tool>…]` shows the same installs on the setup's Install step.
  useOnboarding.setState((s) => ({ chosen: [...new Set([...s.chosen, ...ids])] }))
  await useTools.getState().refresh()
  for (const id of ids) useTools.getState().install(id, { check: params.has("store-check") })
}

// `?search=<tool>` opens Search on that tool's hits, `?search=empty` on a query nothing matches, `?search-fail=query`
// on a query error with a span, `?search-fail=tool` on the tool's refusal, `?search-old=<tool>` on a tool too old to
// search (`src/platform/mock-search.ts`). Profile personal, else the first, is chosen here as the owner would; the page
// never chooses one.
async function searchScenario(params: URLSearchParams) {
  const asked = params.get("search") ?? params.get("search-old") ?? (params.has("search-fail") ? "tg" : null)
  if (!asked) return
  const tool = findTool(asked) ? asked : "tg"
  useNav.getState().go("search")
  const search = useSearch.getState()
  search.chooseTool(tool)
  while (useSearch.getState().profiles === undefined) await new Promise((r) => setTimeout(r, 50))
  const profiles = useSearch.getState().profiles ?? []
  const profile = profiles.find((p) => p.name === "personal") ?? profiles[0]
  if (profile) search.chooseProfile(profile.name)
  const fail = params.get("search-fail")
  search.setQuery(
    fail === "query"
      ? "invoice bogus:x date>=30d"
      : tool === "zm"
        ? "budget review"
        : showcase
          ? showcaseQuery()
          : "invoice",
  )
  await search.search(1)
}

// `?notifications=open` opens the bell's panel once the first check has answered.
function openBell() {
  const show = () => useNotifications.getState().show()
  if (useNotifications.getState().checked) return show()
  const off = useNotifications.subscribe((s) => {
    if (!s.checked) return
    off()
    show()
  })
  useNotifications.getState().check()
}
