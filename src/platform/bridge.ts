import { Channel, type InvokeArgs, invoke as tauriInvoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { openUrl } from "@tauri-apps/plugin-opener"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import * as v from "valibot"
import { DamageReportSchema } from "@/domain/store-damage"
import {
  AgentRunSchema,
  AgentsSchema,
  ChatsSchema,
  ClaimsSchema,
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
import type { BackupEvent } from "./backup-schemas"
import type { NotesModelEvent } from "./bindings"
import { commandError } from "./command-error"
import { DigestDaySchema, DigestSchema } from "./digest-schemas"
import { GroupsReadSchema } from "./groups-schemas"
import { OpenedSchema } from "./link-schemas"
import {
  AddedSourceSchema,
  FilePreviewSchema,
  KeySavedSchema,
  LinkPreviewSchema,
  MentionsSchema,
  ReaderSchema,
  StoredSourceSchema,
  SuggestedSchema,
} from "./memory-add-schemas"
import {
  ForgotSchema,
  MemoryEntrySchema,
  MemoryReadSchema,
  MemorySourceSchema,
  RelationDecidedSchema,
  RelationEditedSchema,
  SourceContextSchema,
  SourceReviewSchema,
} from "./memory-schemas"
import { NotificationsSchema } from "./notifications-schemas"
import { KindCountsSchema, MergedSchema, PeopleReadSchema, PersonDetailSchema, UnlinkedSchema } from "./people-schemas"
import { PermissionsSchema } from "./permissions-schemas"
import { ReportContextSchema, ReportSentSchema } from "./report-schemas"
import { RunDetailSchema, RunsPageSchema } from "./runs-schemas"
import type { InstallEvent, NodeEvent } from "./schemas"
import { QueryDraftSchema, SearchAnswerSchema, SearchContextSchema, ValueItemSchema } from "./search-schemas"
import { SettingsSchema } from "./settings-schemas"
import { SignInEventSchema } from "./signin-schemas"
import type { SyncEvent } from "./sync-schemas"
import {
  FunnelHelperStatusSchema,
  FunnelStateSchema,
  PageEventSchema,
  TailscaleDownloadSchema,
  TailscaleStatusSchema,
} from "./tailscale-schemas"
import {
  ChatTasksSchema,
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
import type { UpdateKind, UpdateProgress } from "./update-schemas"

/** A page event that does not parse is dropped: the browser has the page open anyway. */
function pages(onPage: (url: string) => void) {
  const channel = new Channel<unknown>()
  channel.onmessage = (raw) => {
    const parsed = v.safeParse(PageEventSchema, raw)
    if (parsed.success) onPage(parsed.output.url)
  }
  return channel
}

async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (e) {
    throw commandError(e)
  }
}

const call = async <S extends v.GenericSchema>(schema: S, cmd: string, args?: Record<string, unknown>) =>
  v.parse(schema, await invoke(cmd, args))

function events(onEvent: (e: InstallEvent) => void) {
  const channel = new Channel<InstallEvent>()
  channel.onmessage = onEvent
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
    readiness: () => invoke("readiness"),
    sandbox: () => invoke("sandbox"),
    extraTools: () => invoke("extra_tools"),
    communityStatus: () => invoke("community_status"),
    setCommunityShown: (show) => invoke("set_community_shown", { show }),
    ownToolsStatus: () => invoke("own_tools_status"),
    setOwnToolsAllowed: (allow) => invoke("set_own_tools_allowed", { allow }),
    ownToolDiscover: (pkg, desktop) => invoke("own_tool_discover", { package: pkg, desktop }),
    ownToolRisks: (token) => invoke("own_tool_risks", { token }),
    ownToolAdd: (token, onEvent) => invoke("own_tool_add", { token, onEvent: events(onEvent) }),
    ownToolUninstall: (token, onEvent) => invoke("own_tool_uninstall", { token, onEvent: events(onEvent) }),
    ownToolRemove: (id) => invoke("own_tool_remove", { id }),
    nodeOffer: () => invoke("node_offer"),
    setupNode: (onEvent) => {
      const channel = new Channel<NodeEvent>()
      channel.onmessage = onEvent
      return invoke("setup_node", { onEvent: channel })
    },
    cancelNodeSetup: () => invoke("cancel_node_setup"),
    removeNode: () => invoke("remove_node"),
    nodePath: () => invoke("node_path"),
    setNodePath: (add) => invoke("set_node_path", { add }),
    detectTools: (fresh = false) => invoke("detect_tools", { fresh }),
    latestVersions: (fresh = false) => invoke("latest_versions", { fresh }),
    listProfiles: (id) => invoke("list_profiles", { id }),
    diagnose: (id, profile) => invoke("diagnose", { id, profile }),
    install: (id, onEvent) => invoke("install_tool", { id, onEvent: events(onEvent) }),
    uninstall: (id, onEvent) => invoke("uninstall_tool", { id, onEvent: events(onEvent) }),
    removeCopy: (id, path) => invoke("remove_copy", { id, path }),
    storage: () => invoke("storage_report"),
    clearStorage: (id) => invoke("clear_storage", { id }),
    openFolder: (id, kind, entry) => invoke("open_folder", { id, kind, entry: entry ?? null }),
    configRepair: (id, profile) => invoke("config_repair", { id, profile }),
    accountSignOut: (id, profile) => invoke("account_sign_out", { id, profile }),
    accountRemoveSupported: (id) => invoke("account_remove_supported", { id }),
    accountRemovePlan: (id, profile, deleteData) => invoke("account_remove_plan", { id, profile, deleteData }),
    accountRemove: (id, profile, deleteData) => invoke("account_remove", { id, profile, deleteData }),
    storeInfo: () => call(StoreInfoSchema, "store_info"),
    storeCompat: () => call(StoreCompatSchema, "store_compat"),
    storePreflight: (id) => invoke("store_preflight", { id }),
    storeTables: (sizes) => call(TableListSchema, "store_tables", { sizes }),
    storeCheck: () => call(StoreCheckSchema, "store_check"),
    storeRecover: (id) => call(v.nullable(DamageReportSchema), "store_recover", { id }),
    storeRecoverStep: (id, index) => invoke("store_recover_step", { id, index }),
    storeBackup: (onEvent, password) => {
      const channel = new Channel<BackupEvent>()
      channel.onmessage = onEvent
      return invoke("store_backup", { password: password ?? null, onEvent: channel })
    },
    cancelStoreBackup: () => invoke("cancel_store_backup"),
    listBackups: () => invoke("list_backups"),
    openBackups: (name) => invoke("open_backups", { name }),
    storeResetPreview: () => invoke("store_reset_preview"),
    storeReset: () => invoke("store_reset"),
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
    mcpRemove: (id, profile, agent) => invoke("mcp_remove", { id, profile, agent }),
    mcpServerStatus: (id) => invoke("mcp_server_status", { id }),
    mcpServerStart: (id, port, url) => invoke("mcp_server_start", { id, port, url }),
    mcpServerStop: (id) => invoke("mcp_server_stop", { id }),
    mcpServerRevoke: (id) => invoke("mcp_server_revoke", { id }),
    mcpServerConfig: (id) => call(v.string(), "mcp_server_config", { id }),
    mcpServerOAuth: (id) => invoke("mcp_server_oauth", { id }),
    mcpServerPublic: (id) => invoke("mcp_server_public", { id }),
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
    cloudflareStatus: () => invoke("cloudflare_status"),
    cloudflareInstall: () => call(v.string(), "cloudflare_install"),
    cloudflareLogin: (onPage) => invoke("cloudflare_login", { onEvent: pages(onPage) }),
    cloudflareStop: () => invoke("cloudflare_stop"),
    cloudflareCreate: (hostname) => call(v.string(), "cloudflare_create", { hostname }),
    cloudflareTunnelOpen: (id, port) => call(v.string(), "cloudflare_tunnel_open", { id, port }),
    cloudflareTunnelClose: (id) => invoke("cloudflare_tunnel_close", { id }),
    cloudflareRoutes: () => invoke("cloudflare_routes"),
    groupsRead: () => call(GroupsReadSchema, "groups_read"),
    groupsAdd: (group, source) => call(GroupsReadSchema, "groups_add", { group, source }),
    groupsRemove: (group, source) => call(GroupsReadSchema, "groups_remove", { group, source }),
    groupsMove: (source, from, to) => call(GroupsReadSchema, "groups_move", { source, from, to }),
    memoryRead: () => call(MemoryReadSchema, "memory_read"),
    memorySources: (ref) => call(v.array(MemorySourceSchema), "memory_sources", { reference: ref }),
    memoryConfirm: (ref, accept) =>
      call(MemoryEntrySchema, "memory_confirm", { reference: ref, accept: accept ?? null }),
    memoryDiscard: (ref) => call(MemoryEntrySchema, "memory_discard", { reference: ref }),
    memorySourceContext: (ref) => call(SourceContextSchema, "memory_source_context", { reference: ref }),
    conversationRead: (place, ask) => invoke("conversation_read", { place, ask }),
    memoryOpenSource: (ref) => invoke("memory_open_source", { reference: ref }),
    memoryCorrect: (ref, text, change) =>
      call(MemoryEntrySchema, "memory_correct", { reference: ref, text, change: change ?? null }),
    memoryRelationEdit: (ref, role) => call(RelationEditedSchema, "memory_relation_edit", { reference: ref, role }),
    memoryRelationRemove: (ref) => invoke("memory_relation_remove", { reference: ref }),
    memoryRelationsDecide: (refs, approve) =>
      call(v.array(RelationDecidedSchema), "memory_relations_decide", { references: refs, approve }),
    memoryFilePreview: () => call(v.nullable(FilePreviewSchema), "memory_file_preview"),
    memoryLinkPreview: (url) => call(v.nullable(LinkPreviewSchema), "memory_link_preview", { url }),
    memoryForget: (ref) => call(ForgotSchema, "memory_forget", { reference: ref }),
    clientsRead: (kind, pipeline) => invoke("clients_read", { kind, pipeline }),
    clientsMove: (kind, ref, stage, via) => invoke("clients_move", { kind, reference: ref, stage, via }),
    clientsScope: (account, profile) => invoke("clients_scope", { account, profile }),
    clientsScopeSet: (account, profile, scope) => invoke("clients_scope_set", { account, profile, scope }),
    clientsMapSet: (stage, base) => invoke("clients_map_set", { stage, base }),
    clientsMapConfirm: (kind, pipeline) => invoke("clients_map_confirm", { kind, pipeline }),
    clientsBaseEdit: (kind, edit) => invoke("clients_base_edit", { kind, edit }),
    peopleRead: (kind) => call(PeopleReadSchema, "people_read", { kind: kind ?? null }),
    peopleKinds: () => call(KindCountsSchema, "people_kinds"),
    peopleShow: (ref) => call(PersonDetailSchema, "people_show", { reference: ref }),
    peopleDecide: (ref, id, answer, reason) =>
      call(PersonDetailSchema, "people_decide", { reference: ref, id, answer, reason: reason ?? null }),
    peopleMerge: (refs) => call(MergedSchema, "people_merge", { references: refs }),
    peopleUnlink: (ref, identities) => call(UnlinkedSchema, "people_unlink", { reference: ref, identities }),
    peopleFind: (account) => call(v.nullable(PersonDetailSchema), "people_find", { account }),
    peopleUnmerge: (ref, merge) => call(PersonDetailSchema, "people_unmerge", { reference: ref, merge }),
    memoryShow: (ref) => call(MemoryEntrySchema, "memory_show", { reference: ref }),
    memoryReviewShow: (ref, id) => call(SourceReviewSchema, "memory_review_show", { reference: ref, id }),
    memoryReviewDecide: (ref, id, answer, reason) =>
      call(MemoryEntrySchema, "memory_review_decide", { reference: ref, id, answer, reason: reason ?? null }),
    memoryPickFile: () => call(v.nullable(v.string()), "memory_pick_file"),
    memorySourceAdd: (source) => call(AddedSourceSchema, "memory_source_add", { source }),
    memorySourceShow: (ref) => call(StoredSourceSchema, "memory_source_show", { reference: ref }),
    memoryMentions: (ref) => call(MentionsSchema, "memory_mentions", { reference: ref }),
    memorySourceSuggest: (ref, reader, subjects, again) =>
      call(SuggestedSchema, "memory_source_suggest", { reference: ref, reader, subjects, again }),
    memoryReaders: () => call(v.array(ReaderSchema), "memory_readers"),
    memoryReaderChoose: (id) => call(v.array(ReaderSchema), "memory_reader_choose", { id }),
    memoryReaderKey: (provider, key) => call(KeySavedSchema, "memory_reader_key", { provider, key }),
    taskList: (query) => call(TaskReadSchema, "task_list", { query }),
    taskChats: () => call(ChatTasksSchema, "task_chats"),
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
    zoomAppSetup: (id) => invoke("zoom_app_setup", { id }),
    driveFoldersBrowse: (id, profile, parent) => invoke("drive_folders_browse", { id, profile, parent }),
    driveFolderAdd: (id, profile, folder) => invoke("drive_folder_add", { id, profile, folder }),
    driveFoldersChosen: (id, profile) => invoke("drive_folders_chosen", { id, profile }),
    driveFolderRemove: (id, profile, folder) => invoke("drive_folder_remove", { id, profile, folder }),
    botSignIn: (id, profile, token, fields) => invoke("bot_sign_in", { id, profile, token, fields }),
    listBots: (id) => invoke("list_bots", { id }),
    syncRun: (id, profile, onEvent) => {
      const channel = new Channel<SyncEvent>()
      channel.onmessage = onEvent
      return invoke("sync_run", { id, profile, onEvent: channel })
    },
    syncStop: (id, profile) => invoke("sync_stop", { id, profile }),
    syncLast: (id, profile) => invoke("sync_last", { id, profile }),
    syncScheduleStatus: (id, profile) => invoke("sync_schedule_status", { id, profile }),
    syncScheduleSet: (id, profile, every) => invoke("sync_schedule_set", { id, profile, every }),
    backgroundStatus: (id, profile) => invoke("background_status", { id, profile }),
    backgroundRun: (id, profile, action) => invoke("background_run", { id, profile, action }),
    mailAgentStatus: (id) => invoke("mail_agent_status", { id }),
    mailAgentSet: (id, on, every) => invoke("mail_agent_set", { id, on, every: every ?? null }),
    mailAgentWaiting: (id) => invoke("mail_agent_waiting", { id }),
    enrichmentStatus: (id) => invoke("enrichment_status", { id }),
    enrichmentPreview: (id, provider, model) => invoke("enrichment_preview", { id, provider, model }),
    enrichmentOn: (id, provider, model) => invoke("enrichment_on", { id, provider, model }),
    enrichmentOff: (id) => invoke("enrichment_off", { id }),
    enrichmentKeySet: (id, provider, key) => invoke("enrichment_key_set", { id, provider, key }),
    enrichmentKeyRemove: (id, provider) => invoke("enrichment_key_remove", { id, provider }),
    notesSetupStatus: (id) => invoke("notes_setup_status", { id }),
    notesPickFolder: () => invoke("notes_pick_folder"),
    notesFolderAdd: (id, path) => invoke("notes_folder_add", { id, path }),
    notesFolderRemove: (id, folder, deleteNotes) => invoke("notes_folder_remove", { id, folder, deleteNotes }),
    notesSync: (id, onEvent) => {
      const channel = new Channel<SyncEvent>()
      channel.onmessage = onEvent
      return invoke("notes_sync", { id, onEvent: channel })
    },
    notesModelDownload: (id, model, onEvent) => {
      const channel = new Channel<NotesModelEvent>()
      channel.onmessage = onEvent
      return invoke("notes_model_download", { id, model, onEvent: channel })
    },
    notesModelUse: (id, model) => invoke("notes_model_use", { id, model }),
    notesModelStop: (id) => invoke("notes_model_stop", { id }),
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
      const kind = await invoke<UpdateKind>("update_kind")
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
      const channel = new Channel<UpdateProgress>()
      channel.onmessage = onProgress
      return invoke("update_download_package", { version, onEvent: channel })
    },
    openPackageTerminal: () => invoke("update_package_terminal"),
    restart: () => relaunch(),
    listenLinks: async (onLink) => {
      const channel = new Channel<unknown>()
      channel.onmessage = (raw) => {
        const parsed = v.safeParse(OpenedSchema, raw)
        onLink(parsed.success ? parsed.output.target : null)
      }
      await invoke("deep_link_listen", { onLink: channel })
    },
    digestList: (digest) => call(v.array(DigestDaySchema), "digest_list", { digest: digest ?? null }),
    digestShow: (date, digest) => call(DigestSchema, "digest_show", { date, digest: digest ?? null }),
    digestNotify: (date, title, body, open) => invoke("digest_notify", { date, title, body, open }),
    digestBook: () => invoke("digest_book"),
    digestSave: (spec, create) => invoke("digest_save", { spec, create }),
    digestRun: (digest, to) => invoke("digest_run", { digest, delivery: to }),
    digestSetScheduled: (digest, on) => invoke("digest_set_scheduled", { digest, on }),
    digestRemove: (digest) => invoke("digest_remove", { digest }),
    digestBackfill: (from, to, yes, digest) => invoke("digest_backfill", { from, to, yes, digest: digest ?? null }),
    digestBrief: (digest) => invoke("digest_brief", { digest: digest ?? null }),
    digestBriefSave: (body, digest) => invoke("digest_brief_save", { body, digest: digest ?? null }),
    digestBriefUndo: (digest) => invoke("digest_brief_undo", { digest: digest ?? null }),
    digestBriefReset: (digest) => invoke("digest_brief_reset", { digest: digest ?? null }),
    digestTemplate: (channel, locale, digest) => invoke("digest_template", { channel, locale, digest: digest ?? null }),
    digestTemplateSave: (channel, locale, body, digest) =>
      invoke("digest_template_save", { channel, locale, body, digest: digest ?? null }),
    digestTemplateUndo: (channel, locale, digest) =>
      invoke("digest_template_undo", { channel, locale, digest: digest ?? null }),
    digestTemplateReset: (channel, locale, digest) =>
      invoke("digest_template_reset", { channel, locale, digest: digest ?? null }),
    digestTemplatePreview: (channel, locale, draft, digest) =>
      invoke("digest_template_preview", { channel, locale, draft, digest: digest ?? null }),
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

export type OpenFailure = { url: string; error: string }

let openFailed: (failure: OpenFailure) => void = () => undefined

/** The app shows a link that did not open, with its address to copy; `platform/` imports nothing above it. */
export const onOpenUrlFailure = (show: (failure: OpenFailure) => void) => {
  openFailed = show
  return () => {
    if (openFailed === show) openFailed = () => undefined
  }
}

/** Every caller fires and forgets `openUrl`, so a failure is caught here once instead of vanishing at each call. */
export const withOpenFailure = (p: Platform): Platform => ({
  ...p,
  openUrl: (url) =>
    p.openUrl(url).catch((e: unknown) => openFailed({ url, error: e instanceof Error ? e.message : String(e) })),
})

/** Must settle before anything reads `platform`. The mock is a dynamic import so a Tauri build never carries it. */
export async function initPlatform() {
  if (inTauri) platform = withOpenFailure(createTauri())
  else if (__WITH_MOCK__) platform = withOpenFailure((await import("./mock")).createMock(detectOs()))
  else throw new Error("The browser mock is not part of this build")
}
