import { Channel, invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { openUrl } from "@tauri-apps/plugin-opener"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import * as v from "valibot"
import {
  AgentRunSchema,
  AgentsSchema,
  ChatsSchema,
  ClaimsSchema,
  McpHealthSchema,
  PathFixSchema,
  RegistrationsSchema,
  ShellChoicesSchema,
  SkillReportSchema,
  SkillTextSchema,
  SkillWrittenSchema,
  TerminalReachSchema,
} from "./agents-schemas"
import { AggregateSchema, MessageCountsSchema } from "./analytics-schemas"
import { StoreCheckSchema, StoreCompatSchema, StoreInfoSchema, TableListSchema } from "./archive-schemas"
import { BackupEventSchema, BackupsSchema, ResetDoneSchema, ResetPreviewSchema } from "./backup-schemas"
import { BotProfilesSchema, BotResultSchema } from "./bot-schemas"
import { CloudflareStatusSchema, TunnelRouteSchema } from "./cloudflare-schemas"
import { CommunityStatusSchema, ExtraToolsSchema } from "./community-schemas"
import { McpServerStatusSchema, OAuthSettingsSchema, PublicCheckSchema } from "./mcp-server-schemas"
import {
  ForgotSchema,
  MemoryEntrySchema,
  MemoryReadSchema,
  MemorySourceSchema,
  SourceContextSchema,
} from "./memory-schemas"
import { NotificationsSchema } from "./notifications-schemas"
import { PermissionsSchema } from "./permissions-schemas"
import { RepairSchema } from "./repair-schemas"
import { ReportContextSchema, ReportSentSchema } from "./report-schemas"
import { RunDetailSchema, RunsPageSchema } from "./runs-schemas"
import {
  CopyRemovalSchema,
  DiagnosisSchema,
  InstallEventSchema,
  LatestVersionsSchema,
  NodeEventSchema,
  NodeOfferSchema,
  NodePathSchema,
  ProfilesSchema,
  ReadinessSchema,
  StorageSchema,
  ToolStatesSchema,
} from "./schemas"
import { QueryDraftSchema, SearchAnswerSchema, SearchContextSchema, ValueItemSchema } from "./search-schemas"
import { SettingsSchema } from "./settings-schemas"
import { SignInEventSchema } from "./signin-schemas"
import { BackgroundSchema, LastSyncSchema, SyncEventSchema } from "./sync-schemas"
import {
  FunnelHelperStatusSchema,
  FunnelStateSchema,
  PageEventSchema,
  TailscaleDownloadSchema,
  TailscaleStatusSchema,
} from "./tailscale-schemas"
import {
  PersonSchema,
  ProjectSchema,
  TaskCommentSchema,
  TaskCountsSchema,
  TaskEventSchema,
  TaskReadSchema,
  TaskSchema,
  TaskWriteSchema,
} from "./task-schemas"
import type { Platform } from "./types"
import { plainNotes } from "./update-notes"
import { PackageOutcomeSchema, UpdateKindSchema, UpdateProgressSchema } from "./update-schemas"

/** A page event that does not parse is dropped: the browser has the page open anyway. */
function pages(onPage: (url: string) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => {
    const parsed = v.safeParse(PageEventSchema, raw)
    if (parsed.success) onPage(parsed.output.url)
  }
  return channel
}

const call = async <S extends v.GenericSchema>(schema: S, cmd: string, args?: Record<string, unknown>) =>
  v.parse(schema, await invoke(cmd, args))

function events(onEvent: (e: v.InferOutput<typeof InstallEventSchema>) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => {
    const parsed = v.safeParse(InstallEventSchema, raw)
    // A dropped event would leave the step spinning forever; say so instead.
    onEvent(
      parsed.success
        ? parsed.output
        : {
            event: "failed",
            reason: "failed",
            message: "The app could not read the installer's last answer.",
            hint: "Press Check again to see what is installed now.",
          },
    )
  }
  return channel
}

/** The update the last check found; installing needs the plugin's own object, not the copy the interface holds. */
let found: Update | null = null

function detectOs(): Platform["os"] {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

function createTauri(): Platform {
  return {
    kind: "tauri",
    os: detectOs(),
    readiness: () => call(ReadinessSchema, "readiness"),
    extraTools: () => call(ExtraToolsSchema, "extra_tools"),
    communityStatus: () => call(CommunityStatusSchema, "community_status"),
    setCommunityShown: (show) => invoke("set_community_shown", { show }),
    nodeOffer: () => call(NodeOfferSchema, "node_offer"),
    setupNode: (onEvent) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => onEvent(v.parse(NodeEventSchema, raw))
      return invoke("setup_node", { onEvent: channel })
    },
    cancelNodeSetup: () => invoke("cancel_node_setup"),
    removeNode: () => invoke("remove_node"),
    nodePath: () => call(NodePathSchema, "node_path"),
    setNodePath: (add) => call(NodePathSchema, "set_node_path", { add }),
    detectTools: (fresh = false) => call(ToolStatesSchema, "detect_tools", { fresh }),
    latestVersions: (fresh = false) => call(LatestVersionsSchema, "latest_versions", { fresh }),
    listProfiles: (id) => call(ProfilesSchema, "list_profiles", { id }),
    diagnose: (id, profile) => call(DiagnosisSchema, "diagnose", { id, profile }),
    install: (id, onEvent) => invoke("install_tool", { id, onEvent: events(onEvent) }),
    uninstall: (id, onEvent) => invoke("uninstall_tool", { id, onEvent: events(onEvent) }),
    removeCopy: (id, path) => call(CopyRemovalSchema, "remove_copy", { id, path }),
    storage: () => call(StorageSchema, "storage_report"),
    clearStorage: (id) => invoke("clear_storage", { id }),
    openFolder: (id, kind, entry) => invoke("open_folder", { id, kind, entry: entry ?? null }),
    configRepair: (id, profile) => call(RepairSchema, "config_repair", { id, profile }),
    storeInfo: () => call(StoreInfoSchema, "store_info"),
    storeCompat: () => call(StoreCompatSchema, "store_compat"),
    storeTables: (sizes) => call(TableListSchema, "store_tables", { sizes }),
    storeCheck: () => call(StoreCheckSchema, "store_check"),
    storeBackup: (onEvent, password) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(BackupEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : { event: "failed", message: "The app could not read the backup's progress." },
        )
      }
      return invoke("store_backup", { password: password ?? null, onEvent: channel })
    },
    cancelStoreBackup: () => invoke("cancel_store_backup"),
    listBackups: () => call(BackupsSchema, "list_backups"),
    openBackups: (name) => invoke("open_backups", { name }),
    storeResetPreview: () => call(ResetPreviewSchema, "store_reset_preview"),
    storeReset: () => call(ResetDoneSchema, "store_reset"),
    detectAgents: () => call(AgentsSchema, "detect_agents"),
    skillStatus: (id) => call(SkillReportSchema, "skill_status", { id }),
    skillInstall: (id, target) => call(SkillWrittenSchema, "skill_install", { id, target }),
    skillShow: (id) => call(SkillTextSchema, "skill_show", { id }),
    terminalReach: (agent) => call(TerminalReachSchema, "terminal_reach", agent ? { agent } : {}),
    fixTerminalPath: (ids) => call(PathFixSchema, "fix_terminal_path", { ids }),
    terminalShells: () => call(ShellChoicesSchema, "terminal_shells"),
    useTerminalShell: (shell, ids) => call(PathFixSchema, "use_terminal_shell", { shell, ids }),
    runAgent: (agent, prompt) => call(AgentRunSchema, "run_agent", { agent, prompt }),
    agentChats: (agent) => call(ChatsSchema, "agent_chats", { agent }),
    mcpRegistrations: (agent) => call(RegistrationsSchema, "mcp_registrations", { agent }),
    mcpCheck: (id, profile) => call(McpHealthSchema, "mcp_check", { id, profile }),
    mcpAdd: (id, profile, agent, allowWrites) => invoke("mcp_add", { id, profile, agent, allowWrites }),
    mcpRemove: (id, profile, agent) => invoke("mcp_remove", { id, profile, agent }),
    mcpServerStatus: (id) => call(McpServerStatusSchema, "mcp_server_status", { id }),
    mcpServerStart: (id, port, url) => call(McpServerStatusSchema, "mcp_server_start", { id, port, url }),
    mcpServerStop: (id) => invoke("mcp_server_stop", { id }),
    mcpServerRevoke: (id) => invoke("mcp_server_revoke", { id }),
    mcpServerConfig: (id) => call(v.string(), "mcp_server_config", { id }),
    mcpServerOAuth: (id) => call(OAuthSettingsSchema, "mcp_server_oauth", { id }),
    mcpServerPublic: (id) => call(PublicCheckSchema, "mcp_server_public", { id }),
    tailscaleStatus: () => call(TailscaleStatusSchema, "tailscale_status"),
    tailscaleDownload: (kind) => call(TailscaleDownloadSchema, "tailscale_download", { kind }),
    tailscaleTerminal: (what) => invoke("tailscale_terminal", { what }),
    tailscaleLogin: (onPage) => invoke("tailscale_login", { onEvent: pages(onPage) }),
    tailscaleStop: () => invoke("tailscale_stop"),
    tailscaleFunnelOpen: (id, port, onPage) =>
      call(v.string(), "tailscale_funnel_open", { id, port, onEvent: pages(onPage) }),
    tailscaleFunnelClose: (id) => invoke("tailscale_funnel_close", { id }),
    tailscaleFunnels: () => call(v.array(FunnelStateSchema), "tailscale_funnels"),
    funnelHelperStatus: () => call(FunnelHelperStatusSchema, "funnel_helper_status"),
    funnelHelperStart: (onPage) => call(FunnelHelperStatusSchema, "funnel_helper_start", { onEvent: pages(onPage) }),
    funnelHelperOpen: (id, port) => call(v.string(), "funnel_helper_open", { id, port }),
    cloudflareStatus: () => call(CloudflareStatusSchema, "cloudflare_status"),
    cloudflareInstall: () => call(v.string(), "cloudflare_install"),
    cloudflareLogin: (onPage) => invoke("cloudflare_login", { onEvent: pages(onPage) }),
    cloudflareStop: () => invoke("cloudflare_stop"),
    cloudflareCreate: (hostname) => call(v.string(), "cloudflare_create", { hostname }),
    cloudflareTunnelOpen: (id, port) => call(v.string(), "cloudflare_tunnel_open", { id, port }),
    cloudflareTunnelClose: (id) => invoke("cloudflare_tunnel_close", { id }),
    cloudflareRoutes: () => call(v.array(TunnelRouteSchema), "cloudflare_routes"),
    memoryRead: () => call(MemoryReadSchema, "memory_read"),
    memorySources: (ref) => call(v.array(MemorySourceSchema), "memory_sources", { reference: ref }),
    memoryConfirm: (ref, accept) =>
      call(MemoryEntrySchema, "memory_confirm", { reference: ref, accept: accept ?? null }),
    memoryDiscard: (ref) => call(MemoryEntrySchema, "memory_discard", { reference: ref }),
    memorySourceContext: (ref) => call(SourceContextSchema, "memory_source_context", { reference: ref }),
    memoryOpenSource: (ref) => invoke("memory_open_source", { reference: ref }),
    memoryCorrect: (ref, text) => call(MemoryEntrySchema, "memory_correct", { reference: ref, text }),
    memoryForget: (ref) => call(ForgotSchema, "memory_forget", { reference: ref }),
    taskList: (query) => call(TaskReadSchema, "task_list", { query }),
    taskCounts: (query) => call(TaskCountsSchema, "task_counts", { query }),
    taskShow: (key) => call(TaskSchema, "task_show", { key }),
    taskHistory: (key) => call(v.array(TaskEventSchema), "task_history", { key }),
    taskCreate: (task) => call(TaskWriteSchema, "task_create", { task }),
    taskUpdate: (key, revision, edit) => call(TaskWriteSchema, "task_update", { key, revision, edit }),
    taskMove: (key, revision, place) => call(TaskWriteSchema, "task_move", { key, revision, place }),
    taskAssign: (key, revision, person) => call(TaskWriteSchema, "task_assign", { key, revision, person }),
    taskComments: (key) => call(v.array(TaskCommentSchema), "task_comments", { key }),
    taskCommentAdd: (key, text) => call(TaskCommentSchema, "task_comment_add", { key, text }),
    peopleList: () => call(v.array(PersonSchema), "people_list"),
    personAdd: (name) => call(PersonSchema, "person_add", { name }),
    projectList: () => call(v.array(ProjectSchema), "project_list"),
    taskClaims: (id, profile) => call(ClaimsSchema, "task_claims", { id, profile }),
    taskRelease: (id, profile, task) => invoke("task_release", { id, profile, task }),
    cancelInstall: (id) => invoke("cancel_install", { id }),
    openSetup: (id, profile) => invoke("open_setup", { id, profile }),
    signIn: (id, method, profile, onEvent, inputs) => {
      const channel = new Channel<unknown>()
      // An event that does not parse is never thrown: the error would carry the code into the window's error list.
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(SignInEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : { event: "failed", message: "The app could not read the sign-in's last step.", code: null },
        )
      }
      return invoke("sign_in", { id, method, profile, inputs: inputs ?? null, onEvent: channel })
    },
    signInAnswer: (id, value) => invoke("sign_in_answer", { id, value }),
    signInStop: (id) => invoke("sign_in_stop", { id }),
    botSignIn: (id, profile, token, fields) => call(BotResultSchema, "bot_sign_in", { id, profile, token, fields }),
    listBots: (id) => call(BotProfilesSchema, "list_bots", { id }),
    syncRun: (id, profile, onEvent) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(SyncEventSchema, raw)
        onEvent(
          parsed.success
            ? parsed.output
            : {
                event: "failed",
                message: "The app could not read the sync's answer.",
                code: null,
                reason: null,
                run: null,
              },
        )
      }
      return invoke("sync_run", { id, profile, onEvent: channel })
    },
    syncStop: (id, profile) => invoke("sync_stop", { id, profile }),
    syncLast: (id, profile) => call(LastSyncSchema, "sync_last", { id, profile }),
    backgroundStatus: (id, profile) => call(BackgroundSchema, "background_status", { id, profile }),
    backgroundKeep: (id, profile) => call(BackgroundSchema, "background_keep", { id, profile }),
    listRuns: (id, query, limit, page) => call(RunsPageSchema, "list_runs", { id, query, limit, page }),
    searchStore: (id, profile, query, limit, page) =>
      call(SearchAnswerSchema, "search_store", { id, profile, query, limit, page }),
    searchValues: (id, profile, source) => call(v.array(ValueItemSchema), "search_values", { id, profile, source }),
    messageStats: (id, profile, ask, timezone) =>
      call(MessageCountsSchema, "message_stats", { id, profile, ask, timezone }),
    analyticsAggregate: (id, which, profile, period, timezone) =>
      call(AggregateSchema, "analytics_aggregate", { id, which, profile, period, timezone }),
    analyticsPreview: async () => null,
    searchDraft: (id, request) => call(QueryDraftSchema, "search_draft", { id, request }),
    searchContext: (id, profile, reference) => call(SearchContextSchema, "search_context", { id, profile, reference }),
    showRun: (id, run) => call(RunDetailSchema, "show_run", { id, run }),
    reportContext: () => call(ReportContextSchema, "report_context"),
    sendReport: (draft, context) => call(ReportSentSchema, "send_report", { draft, context }),
    notifications: () => call(NotificationsSchema, "notifications"),
    settingsShow: (id, profile) => call(SettingsSchema, "settings_show", { id, profile }),
    settingsSet: (id, profile, defaults, setting, value) =>
      invoke("settings_set", { id, profile, defaults, setting, value }),
    settingsUnset: (id, profile, defaults, setting) => invoke("settings_unset", { id, profile, defaults, setting }),
    permissionsShow: (id, profile) => call(PermissionsSchema, "permissions_show", { id, profile }),
    checkUpdate: async () => {
      // A later check that finds nothing keeps the update already offered installable.
      const next = await check()
      if (!next) return null
      found = next
      const kind = await call(UpdateKindSchema, "update_kind")
      return { version: found.version, notes: plainNotes(found.body), kind }
    },
    installUpdate: async (onProgress) => {
      if (!found) throw new Error("No update was found to install.")
      let downloaded = 0
      let total: number | null = null
      await found.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? null
        else if (e.event === "Progress") downloaded += e.data.chunkLength
        onProgress({ downloaded, total })
      })
    },
    downloadPackageUpdate: (version, onProgress) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => onProgress(v.parse(UpdateProgressSchema, raw))
      return call(PackageOutcomeSchema, "update_download_package", { version, onEvent: channel })
    },
    restart: () => relaunch(),
    openUrl: (url) => openUrl(url),
    window: async (action) => {
      const w = getCurrentWindow()
      if (action === "minimize") await w.minimize()
      else if (action === "toggleMaximize") await w.toggleMaximize()
      else await w.close()
    },
  }
}

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

export type { Platform, WindowAction } from "./types"

export let platform: Platform

/** Must settle before anything reads `platform`. The mock is a dynamic import so a Tauri build never carries it. */
export async function initPlatform() {
  if (inTauri) platform = createTauri()
  else if (__WITH_MOCK__) platform = (await import("./mock")).createMock(detectOs())
  else throw new Error("The browser mock is not part of this build")
}
