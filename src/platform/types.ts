import type { Preflight, StoreCompat } from "@/domain/compat"
import type { TemplateChannel, TemplateLocale } from "@/domain/digest-editors"
import type { DeepLinkTarget } from "@/domain/links"
import type { DamageReport } from "@/domain/store-damage"
import type {
  Agent,
  AgentRun,
  Chats,
  Claims,
  PathFix,
  Registrations,
  ShellChoices,
  SkillReport,
  SkillText,
  Target,
} from "./agents-schemas"
import type { Aggregate, AnalyticsPreview, Ask, MessageCounts, Period, Which } from "./analytics-schemas"
import type { StoreCheck, StoreInfo, TableList } from "./archive-schemas"
import type { BackupEvent, Backups, ResetPreview } from "./backup-schemas"
import type {
  AccountRemoval,
  AccountRemoved,
  Backfill,
  Brief,
  ChatPage,
  ChatPlace,
  ChosenFolders,
  Conversation,
  CrmAccount,
  CrmBaseEdit,
  CrmCard,
  CrmKind,
  CrmRead,
  CrmVia,
  DigestBook,
  DigestSpec,
  DigestTemplate,
  Enrichment,
  EnrichmentStatus,
  FolderAdded,
  FolderLevel,
  FolderRemoved,
  MailAgent,
  NotesFolderAdded,
  NotesFolderRemoved,
  NotesModelEvent,
  NotesModelUsed,
  NotesSetup,
  OwnDiscovery,
  OwnSignal,
  OwnStatus,
  SendTo,
  SyncSchedule,
  TemplatePreview,
  ZoomAppAnswer,
} from "./bindings"
import type { BotProfile, BotResult } from "./bot-schemas"
import type { CloudflareStatus, TunnelRoute } from "./cloudflare-schemas"
import type { CommunityStatus, ExtraTools } from "./community-schemas"
import type { Digest, DigestDay } from "./digest-schemas"
import type { GroupsRead } from "./groups-schemas"
import type { McpServerStatus, OAuthSettings, PublicCheck } from "./mcp-server-schemas"
import type { AddedSource, AddSource, KeySaved, Mentions, Reader, StoredSource, Suggested } from "./memory-add-schemas"
import type {
  Forgot,
  MemoryEntry,
  MemoryRead,
  MemorySource,
  ReviewAnswer,
  SourceContext,
  SourceReview,
} from "./memory-schemas"
import type { Notification } from "./notifications-schemas"
import type { MatchAnswer, Merged, PeopleRead, PersonDetail, Unlinked } from "./people-schemas"
import type { Permissions } from "./permissions-schemas"
import type { Repair } from "./repair-schemas"
import type { ReportContext, ReportDraft, ReportSent } from "./report-schemas"
import type { RunDetail, RunsPage } from "./runs-schemas"
import type {
  CopyRemoval,
  Diagnosis,
  InstallEvent,
  NodeEvent,
  NodeOffer,
  NodePath,
  Profile,
  Readiness,
  StorageArea,
  StorageFolder,
  ToolState,
} from "./schemas"
import type { QueryDraft, SearchAnswer, SearchContext, ValueItem } from "./search-schemas"
import type { Settings } from "./settings-schemas"
import type { SignInEvent, SignInInputs } from "./signin-schemas"
import type { Background, BackgroundAction, BackgroundOutcome, LastSync, SyncEvent } from "./sync-schemas"
import type { FunnelHelperStatus, FunnelState, TailscaleDownload, TailscaleStatus } from "./tailscale-schemas"
import type {
  ChatTasks,
  NewTask,
  Person,
  Project,
  Task,
  TaskComment,
  TaskCounts,
  TaskEdit,
  TaskEvent,
  TaskPlace,
  TaskRead,
  TaskWrite,
} from "./task-schemas"
import type { PackageOutcome, UpdateFailure, UpdateKind, UpdateProgress } from "./update-schemas"

export type WindowAction = "minimize" | "toggleMaximize" | "close"

/** A newer WireCat release, and how this copy takes it. */
export type AppUpdate = { version: string; notes: string | null; kind: UpdateKind }
export type { PackageOutcome, UpdateFailure, UpdateKind, UpdateProgress }

/** Everything the interface may ask of the machine. Each call names a known operation, never a command line. */
export type Platform = {
  kind: "tauri" | "mock"
  os: "linux" | "macos" | "windows"
  readiness(): Promise<Readiness>
  /** The name `bin/sandbox` started this copy under (`WIRECAT_SANDBOX`); null in the real app. */
  sandbox(): Promise<string | null>
  /**
   * The community tools Rust added at start, each with its source: the signed list while "Enable community tools" is
   * on, then `<app data>/extra-tools.json` while "Allow tools WireCat has not checked" is on or
   * `WIRECAT_EXTRA_TOOLS=1` is set.
   */
  extraTools(): Promise<ExtraTools>
  communityStatus(): Promise<CommunityStatus>
  /** Takes effect at the next start; turning it on fetches the list in the background. */
  setCommunityShown(show: boolean): Promise<void>
  ownToolsStatus(): Promise<OwnStatus>
  /** "Allow tools WireCat has not checked"; takes effect at the next start. */
  setOwnToolsAllowed(allow: boolean): Promise<void>
  /** Reads npm only, nothing of the package runs; `desktop` is the object pasted for a tool without a manifest. */
  ownToolDiscover(pkg: string, desktop: string | null): Promise<OwnDiscovery>
  /** GitHub's things to check about the review's repository; a failure is a signal, never an error. */
  ownToolRisks(token: string): Promise<OwnSignal[]>
  /** Installs the reviewed version, checks it against the review and saves it; the tool is listed at once. */
  ownToolAdd(token: string, onEvent: (e: InstallEvent) => void): Promise<void>
  /** Uninstalls a package Add installed but refused, which no catalog names. */
  ownToolUninstall(token: string, onEvent: (e: InstallEvent) => void): Promise<void>
  /** Deletes the saved entry; the program stays installed. */
  ownToolRemove(id: string): Promise<void>
  /** The Node.js build "Set up Node.js for me" would download from nodejs.org. */
  nodeOffer(): Promise<NodeOffer>
  setupNode(onEvent: (e: NodeEvent) => void): Promise<void>
  cancelNodeSetup(): Promise<void>
  /** Rejects while tools still run on it. */
  removeNode(): Promise<void>
  /** The exact line "Add to PATH" writes and the file it goes into, for the app's own Node.js. */
  nodePath(): Promise<NodePath>
  setNodePath(add: boolean): Promise<NodePath>
  /** `fresh` runs every copy's `--version` again; otherwise an unchanged program keeps its last answer. */
  detectTools(fresh?: boolean): Promise<ToolState[]>
  /** `fresh` asks npm even when an answer from the last hour is kept. */
  latestVersions(fresh?: boolean): Promise<Record<string, string | null>>
  listProfiles(id: string): Promise<Profile[] | null>
  diagnose(id: string, profile: string | null): Promise<Diagnosis>
  install(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  uninstall(id: string, onEvent: (e: InstallEvent) => void): Promise<void>
  cancelInstall(id: string): Promise<void>
  /** One unused copy, by the path `detectTools` gave; Rust refuses the copy the app runs and unknown managers. */
  removeCopy(id: string, path: string): Promise<CopyRemoval>
  storage(): Promise<StorageArea[]>
  clearStorage(id: string): Promise<void>
  /** `entry` opens one item directly inside the folder; Rust builds and checks the path. */
  openFolder(id: string, kind: StorageFolder["kind"], entry?: string): Promise<void>
  /** The tool's own `config repair` (`config_repair.rs`), offered where `doctor` names it as the fix. */
  configRepair(id: string, profile: string | null): Promise<Repair>
  /** The tool's own `session end` for one profile: the fallback while the installed version has no `account remove`. */
  accountSignOut(id: string, profile: string): Promise<AccountRemoved>
  /** Whether the installed version has `account remove` (`accountRemove.remove.minVersion` in the catalog). */
  accountRemoveSupported(id: string): Promise<boolean>
  /** `account remove --dry-run`: what it would remove and keep. */
  accountRemovePlan(id: string, profile: string, deleteData: boolean): Promise<AccountRemoval>
  /** `account remove --yes`: signs the profile out and forgets it, keeping or deleting its data. */
  accountRemove(id: string, profile: string, deleteData: boolean): Promise<AccountRemoval>
  /** What the shared archive holds, from the installed tool that reads the newest schema; null when none is installed. */
  storeInfo(): Promise<StoreInfo | null>
  /** Every installed tool's own `store info`: whether it reads the shared store, and what its next run does to it. */
  storeCompat(): Promise<StoreCompat>
  storePreflight(id: string): Promise<Preflight>
  /** Every table with its kind and rows; `sizes` reads the whole file, from seconds to minutes. */
  storeTables(sizes: boolean): Promise<TableList | null>
  /** The archive's integrity and health checks; a minute or more on a large archive. */
  storeCheck(): Promise<StoreCheck | null>
  /** The tool's `store recover` damage report, each step marked runnable or not; null when healthy or older. */
  storeRecover(id: string): Promise<DamageReport | null>
  /** Runs one step of the last report by its place; Rust refuses one it did not mark runnable. */
  storeRecoverStep(id: string, index: number): Promise<void>
  /**
   * The newest-schema tool's own `store backup`, zipped into the backups folder; progress and the result arrive as
   * events. With a password, the tool's `store backup --encrypt` seals it instead, reading the password on stdin.
   */
  storeBackup(onEvent: (e: BackupEvent) => void, password?: string): Promise<void>
  cancelStoreBackup(): Promise<void>
  /** Finished backups in the backups folder, newest first. */
  listBackups(): Promise<Backups>
  /** The backups folder, or one backup shown in it by name. */
  openBackups(name: string | null): Promise<void>
  /** What clearing storage deletes, from `store reset --dry-run`; null when no messenger tool is installed. */
  storeResetPreview(): Promise<ResetPreview | null>
  /** Empties storage with the tool's own `store reset`; resolves with the new empty store's schema. */
  storeReset(): Promise<number | null>
  /** Every known agent; `foundBy` is null for the ones not on this computer. */
  detectAgents(): Promise<Agent[]>
  skillStatus(id: string): Promise<SkillReport>
  /** Resolves with the version written. */
  skillInstall(id: string, target: Target): Promise<string | null>
  skillShow(id: string): Promise<SkillText>
  /** By tool id, for installed tools: whether a terminal finds it on its own PATH. */
  terminalReach(agent?: string): Promise<Record<string, boolean>>
  /** Puts the folders of these tools on the user's PATH where a new terminal does not find them. */
  fixTerminalPath(ids: string[]): Promise<PathFix>
  /** The shells installed here (Linux and macOS), for the owner to say which one their terminal runs. */
  terminalShells(): Promise<ShellChoices>
  /** Saves the owner's shell (one of `terminalShells`), puts these tools on its PATH and checks again. */
  useTerminalShell(shell: string, ids: string[]): Promise<PathFix>
  /** Opens a coding agent (`claude`, `codex`, `gemini`) in a terminal with this prompt, written to a file by Rust. */
  runAgent(agent: string, prompt: string): Promise<AgentRun>
  /** Which chat apps drive the agent (Hermes's gateway, OpenClaw's channels), read only. */
  agentChats(agent: string): Promise<Chats>
  /** WireCat servers an agent has registered; rejects when the agent's list cannot be read. */
  mcpRegistrations(agent: string): Promise<Registrations>
  /** The tool's own `mcp check` for one profile; starts the server once, writes nothing. */
  /** The tool's own `mcp add`; `allowWrites` passes `--allow-writes`, which the owner confirmed. */
  /** The agent's own `mcp remove` of `<bin>-<profile>`, or of `<bin>` when `profile` is null. */
  mcpRemove(id: string, profile: string | null, agent: string): Promise<void>
  /** The tool's HTTP MCP server for browser apps: one per tool, serving every profile (each call names one). */
  mcpServerStatus(id: string): Promise<McpServerStatus>
  /** Rust checks the port and the tunnel's address, then runs the tool's `mcp server start` and answers its status. */
  mcpServerStart(id: string, port: number, url: string): Promise<McpServerStatus>
  /** The tool refuses a server it did not start. */
  mcpServerStop(id: string): Promise<void>
  /** `mcp --revoke`: every browser app must log in again. */
  mcpServerRevoke(id: string): Promise<void>
  /** The `mcpServers` entry a desktop app pastes, as JSON text. */
  mcpServerConfig(id: string): Promise<string>
  /** The running server's login endpoints, to type by hand where a browser app does not find them. */
  mcpServerOAuth(id: string): Promise<OAuthSettings>
  /** Whether the internet reaches the running server: public DNS, then its metadata from the public address. */
  mcpServerPublic(id: string): Promise<PublicCheck>
  /** Every step of the Tailscale guide at once: installed, allowed to change settings, logged in, Funnel allowed. */
  tailscaleStatus(): Promise<TailscaleStatus>
  /** Downloads Tailscale's official installer into Downloads, then opens it or shows it in the file manager. */
  tailscaleDownload(kind: NonNullable<TailscaleStatus["package"]>): Promise<TailscaleDownload>
  /** Opens a terminal running Tailscale's install commands for this Linux, which ask for the password themselves. */
  tailscaleTerminal(what: "install"): Promise<void>
  /** `tailscale login` on a logged-out computer; the login page opens in the browser and `onPage` gets its link. */
  tailscaleLogin(onPage: (url: string) => void): Promise<void>
  /** Stops a waiting login or Funnel approval. */
  tailscaleStop(): Promise<void>
  /** Funnel from the tool's paths of the shared public address to its local port; answers `https://<host>/<tool>`. */
  tailscaleFunnelOpen(id: string, port: number, onPage: (url: string) => void): Promise<string>
  /** Turns off only the paths the app set up for this tool, an older whole-port funnel of it too. */
  tailscaleFunnelClose(id: string): Promise<void>
  tailscaleFunnels(): Promise<FunnelState[]>
  /** WireCat's own Tailscale connection: installed, and where it is (`wirecat-funnel status --json`). */
  funnelHelperStatus(): Promise<FunnelHelperStatus>
  /** Starts it and waits until it runs; each Tailscale page it needs opens in the browser once and `onPage` gets it. */
  funnelHelperStart(onPage: (url: string) => void): Promise<FunnelHelperStatus>
  /** Adds the tool's three paths to it, to the tool's local port; answers `https://<name>/<tool>`. */
  funnelHelperOpen(id: string, port: number): Promise<string>
  /** Every step of the Cloudflare tunnel guide at once: cloudflared downloaded, account connected, address made. */
  cloudflareStatus(): Promise<CloudflareStatus>
  /** Downloads cloudflared's own release into the app's folder, checked against GitHub's checksum; answers its version. */
  cloudflareInstall(): Promise<string>
  /** `cloudflared tunnel login`: the owner logs in and picks the domain in the browser; `onPage` gets the page's link. */
  cloudflareLogin(onPage: (url: string) => void): Promise<void>
  /** Stops a waiting login or download. */
  cloudflareStop(): Promise<void>
  /** Makes the tunnel and its DNS record for this name on the owner's domain; answers the name as kept. */
  cloudflareCreate(hostname: string): Promise<string>
  /** Routes the tool's paths of the tunnel's name to its local port and runs cloudflared; answers `https://<name>/<tool>`. */
  cloudflareTunnelOpen(id: string, port: number): Promise<string>
  /** Takes the tool's paths off the tunnel; cloudflared stops when no tool is left. */
  cloudflareTunnelClose(id: string): Promise<void>
  cloudflareRoutes(): Promise<TunnelRoute[]>
  /** memo's account groups: the saved ones, then `all`, each account with its profiles; "old" before `memo groups`. */
  groupsRead(): Promise<GroupsRead>
  /** Puts an account in a group (made when new); it stays in its other groups. Answers every group again. */
  groupsAdd(group: string, source: string): Promise<GroupsRead>
  groupsRemove(group: string, source: string): Promise<GroupsRead>
  /** Out of one saved group and into another, in one write. */
  groupsMove(source: string, from: string, to: string): Promise<GroupsRead>
  /** memo's memories, facts and proposed actions in one list, and the agents' recent calls; "old" below memo 0.130.0. */
  memoryRead(): Promise<MemoryRead>
  /** What a memory or a fact rests on: each source read back, with a quoted line, or marked deleted since. */
  memorySources(ref: string): Promise<MemorySource[]>
  /**
   * Confirms a memory or a fact; approves an action, which becomes a task and sends nothing. For an agent's findings
   * batch, `accept` names the findings to create (all when absent); the rest are rejected.
   */
  memoryConfirm(ref: string, accept?: string[]): Promise<MemoryEntry>
  /** "No longer holds": a memory goes stale, a fact is rejected or reversed, an action is rejected. */
  memoryDiscard(ref: string): Promise<MemoryEntry>
  /** Writes the owner's version, which replaces the old one; answers the new record. */
  memoryCorrect(ref: string, text: string): Promise<MemoryEntry>
  /** Erases the record, its links to sources and its search entry. */
  memoryForget(ref: string): Promise<Forgot>
  /** A cited source read back: a message with its neighbours, or a note's text. */
  memorySourceContext(ref: string): Promise<SourceContext>
  /** A chat or mail thread a link names, read only through memo: the first view, or the page past one edge. */
  conversationRead(place: ChatPlace, ask: ChatPage): Promise<Conversation>
  /** Opens a note's file with the system's app; Rust finds the file from the ref, inside memo's folders. */
  memoryOpenSource(ref: string): Promise<void>
  /** memo's deals or leads of one pipeline (the first when none is asked), with each stage's count and sums. */
  clientsRead(kind: CrmKind, pipeline: string | null): Promise<CrmRead>
  /**
   * Moves a deal or lead to another stage of its own pipeline. The owner's own goes through memo, which answers the
   * card; a CRM's copy goes through that CRM's CLI as `via`'s profile, which answers none: the page reads it again.
   */
  clientsMove(kind: CrmKind, ref: string, stage: string, via: CrmVia | null): Promise<CrmCard | null>
  /**
   * Whether a CRM account syncs only what is assigned to the owner (`mine`) or everything (`all`), read through its
   * CRM's CLI as `profile`, and whether the app can change it (`why` says why not).
   */
  clientsScope(account: CrmAccount, profile: string | null): Promise<CrmScope>
  /** Saves the account's scope through its CRM's CLI as `profile`; the page then starts that profile's sync. */
  clientsScopeSet(account: CrmAccount, profile: string, scope: "mine" | "all"): Promise<void>
  /** Points a pipeline's stage (`stage:<id>`) at a base stage; memo takes it as confirmed. */
  clientsMapSet(stage: string, base: string): Promise<void>
  /** Confirms memo's suggested mappings of one pipeline, or with `null` of every pipeline of the kind. */
  clientsMapConfirm(kind: CrmKind, pipeline: string | null): Promise<void>
  /** Adds, renames, moves or removes a stage of the kind's base set. */
  clientsBaseEdit(kind: CrmKind, edit: CrmBaseEdit): Promise<void>
  /** Everyone memo knows (merged-away people left out) and the matches waiting; "old" below the catalog's minimum. */
  peopleRead(): Promise<PeopleRead>
  /** One person: identities by source with the accounts that saw each, merges and open matches. */
  peopleShow(ref: string): Promise<PersonDetail>
  /** The owner's answer to a match about this person; answers the person read again. */
  peopleDecide(ref: string, id: string, answer: MatchAnswer, reason?: string): Promise<PersonDetail>
  /** Joins the chosen people of one group of matches into one, a match at a time. */
  peopleMerge(refs: string[]): Promise<Merged>
  /** Moves some of the person's accounts to one new person; only accounts the person's own read listed. */
  peopleUnlink(ref: string, identities: string[]): Promise<Unlinked>
  /** The person who has exactly this account (`<messenger>:<id>`, a username or an email address); `null` if no one. */
  peopleFind(account: string): Promise<PersonDetail | null>
  /** Gives a merge's accounts back to the person they came from. */
  peopleUnmerge(ref: string, merge: string): Promise<PersonDetail>
  /** One memory or fact as memo now has it. */
  memoryShow(ref: string): Promise<MemoryEntry>
  /** The open source review of a memory or a fact: each source as the record cited it and as it is now. */
  memoryReviewShow(ref: string, id: string): Promise<SourceReview>
  /** The owner's answer to a source review; answers the record as it now is, with no open review. */
  memoryReviewDecide(ref: string, id: string, answer: ReviewAnswer, reason?: string): Promise<MemoryEntry>
  /** The system's file window; `null` when the owner closes it. */
  memoryPickFile(): Promise<string | null>
  /** Keeps a file, a web page or pasted text as a source of its own; only its text unless memo says `copy`. */
  memorySourceAdd(source: AddSource): Promise<AddedSource>
  /** A source's stored text, what it is and what is kept. */
  memorySourceShow(ref: string): Promise<StoredSource>
  /** People and organizations memo knows whose names appear in a source, found on this computer. */
  memoryMentions(ref: string): Promise<Mentions>
  /** Facts suggested from a source by the reader the owner chose, as a findings batch to tick. */
  memorySourceSuggest(ref: string, reader: string, subjects: string[], again: boolean): Promise<Suggested>
  /** The ways to read a source for facts that memo found on this computer; memo never chooses one. */
  memoryReaders(): Promise<Reader[]>
  /** The owner's pick of a reader; answers the readers again. */
  memoryReaderChoose(id: string): Promise<Reader[]>
  /** Hands the provider's key to memo, which keeps it in the system keyring; it never comes back. */
  memoryReaderKey(provider: string, key: string): Promise<KeySaved>
  /** memo's project tasks matching the owner's search, highest priority first; "old" below the catalog's minimum. */
  taskList(query: string): Promise<TaskRead>
  /** The open tasks memo found in the owner's chats, mail and notes, of every account; memo cannot filter them more. */
  taskChats(): Promise<ChatTasks>
  /** How many tasks each filter choice would show, from memo; each facet ignores the search's own terms on it. */
  taskCounts(query: string): Promise<TaskCounts>
  taskShow(key: string): Promise<Task>
  /** Who changed the task, what and when, oldest first. */
  taskHistory(key: string): Promise<TaskEvent[]>
  taskCreate(task: NewTask): Promise<TaskWrite>
  /** Every write carries the revision the page read; a stale one answers the task as it now is and writes nothing. */
  taskUpdate(key: string, revision: number, edit: TaskEdit): Promise<TaskWrite>
  /** A card dropped into a column, above or below another card: memo gives it a priority between its neighbours. */
  taskMove(key: string, revision: number, place: TaskPlace): Promise<TaskWrite>
  /** Makes one person the assignee, or nobody with `null`. */
  taskAssign(key: string, revision: number, person: string | null): Promise<TaskWrite>
  /** What people and agents wrote on a task, oldest first. */
  taskComments(key: string): Promise<TaskComment[]>
  /** Comments in the owner's name; a comment moves no revision. */
  taskCommentAdd(key: string, text: string): Promise<TaskComment>
  /** Everyone memo knows: the owner, people from messages, and people added here. */
  peopleList(): Promise<Person[]>
  /** Adds a person by name, so a task can be given to them before any message names them. */
  personAdd(name: string): Promise<Person>
  projectList(): Promise<Project[]>
  taskClaims(id: string, profile: string): Promise<Claims>
  /** Releases a claim as the owner, who may release any. */
  taskRelease(id: string, profile: string, task: string): Promise<void>
  openSetup(id: string, profile: string | null): Promise<void>
  /**
   * Signs the named profile in inside the window with one of the tool's own sign-ins (`signIn.methods` in the catalog);
   * steps arrive as events and the last one is `done`, `failed` or `stopped`. Never with a profile the owner did not
   * choose.
   */
  signIn(
    id: string,
    method: string,
    profile: string,
    onEvent: (e: SignInEvent) => void,
    inputs?: SignInInputs,
  ): Promise<void>
  /** The answer to the running sign-in's `needs` step, written to the tool's stdin; never logged or kept. */
  signInAnswer(id: string, value: string): Promise<void>
  /** Asks the tool to stop, then ends it after a few seconds; `signIn` then answers `stopped`, or `done` with what came. */
  signInStop(id: string): Promise<void>
  /** zm's own `app --json`: what to enter when making the Zoom app; `old` from a zm before it, which has the list built in. */
  zoomAppSetup(id: string): Promise<ZoomAppAnswer>
  /** One level of the profile's Drive folders; no `parent` lists My Drive, Shared with me and the shared drives. */
  driveFoldersBrowse(id: string, profile: string, parent: string | null): Promise<FolderLevel>
  /** Adds one folder, by its id, to what the profile's sync imports. */
  driveFolderAdd(id: string, profile: string, folder: string): Promise<FolderAdded>
  /** The folders the profile's sync imports, named once a sync has copied them. */
  driveFoldersChosen(id: string, profile: string): Promise<ChosenFolders>
  /** Stops importing one folder; drive's next sync drops what it copied from there. */
  driveFolderRemove(id: string, profile: string, folder: string): Promise<FolderRemoved>
  /**
   * Connects a bot to the profile the owner named with the tool's own `bot auth set`: `fields` first (WhatsApp's ids,
   * `bot.fields` in the catalog), then the token on its stdin. The token is never logged, kept or sent back.
   */
  botSignIn(id: string, profile: string, token: string, fields: Record<string, string>): Promise<BotResult>
  /** Every bot name on this computer with a token, from the tool's own `bot list`. */
  listBots(id: string): Promise<BotProfile[]>
  /**
   * Runs the tool's own sync (`sync.run` in the catalog) for the profile the owner chose, or none for a tool without
   * profiles. Stages and the result arrive as events; only counts, never chat or account names.
   */
  syncRun(id: string, profile: string | null, onEvent: (e: SyncEvent) => void): Promise<void>
  /** Asks that sync to stop; `syncRun` then answers `stopped`. What came is kept by the tool. */
  syncStop(id: string, profile: string | null): Promise<void>
  /** When the profile's last successful sync ended, from the tool's own `runs list` or `status`. */
  syncLast(id: string, profile: string | null): Promise<LastSync>
  /** The account's sync on a timer (`sync.schedule` in the catalog), from the tool's own `schedule list`. */
  syncScheduleStatus(id: string, profile: string): Promise<SyncSchedule>
  /** The tool's own `schedule command` at that interval, or `schedule remove` for null. */
  syncScheduleSet(id: string, profile: string, every: string | null): Promise<SyncSchedule>
  /** Whether the tool's own `server status` says its `serve` keeps the profile current (`background` in the catalog). */
  backgroundStatus(id: string, profile: string): Promise<Background>
  /** One of the tool's own `server` commands for one profile; a failure comes back as `fault`, sorted for the page. */
  backgroundRun(id: string, profile: string, action: BackgroundAction): Promise<BackgroundOutcome>
  /** memo's mail agent schedule (`mailAgent` in the catalog): on or off, its last run and the day's spend. */
  mailAgentStatus(id: string): Promise<MailAgent>
  /** memo's own `schedule agent` at `every` (the catalog's default when left out) or `schedule remove`; rejects
   * with memo's words, masked. On again with another interval replaces the schedule. */
  mailAgentSet(id: string, on: boolean, every?: string): Promise<MailAgent>
  /** How many proposals wait for the owner's decision, from memo's `review status`; null when memo does not say. */
  mailAgentWaiting(id: string): Promise<number | null>
  /** memo's `models consents show` (`enrichment` in the catalog): whether a hosted model rewrites records for search. */
  enrichmentStatus(id: string): Promise<Enrichment>
  /** What turning it on with one of memo's offers sends and costs (`consents set` without `--yes`); changes nothing. */
  enrichmentPreview(id: string, provider: string, model: string): Promise<EnrichmentStatus>
  /** Turns it on with that offer; only after the owner agreed in the consent step. Rust refuses a pair memo does not offer. */
  enrichmentOn(id: string, provider: string, model: string): Promise<EnrichmentStatus>
  /**
   * memo's `models keys set`: Rust hands the key to memo on stdin, and memo keeps it in the system keyring (a private file
   * when none answers). The app never stores it; the answer says only whether a key is found and where.
   */
  enrichmentKeySet(id: string, provider: string, key: string): Promise<EnrichmentStatus>
  /** memo's `models keys remove`; a key in an environment variable stays. */
  enrichmentKeyRemove(id: string, provider: string): Promise<EnrichmentStatus>
  /** Turns it off; memo deletes what the model wrote. */
  enrichmentOff(id: string): Promise<EnrichmentStatus>
  /** memo's first run (`notesSetup` in the catalog): its notes folders on this computer and the search model. */
  notesSetupStatus(id: string): Promise<NotesSetup>
  /** The system's own folder window; the chosen path, or null when the owner closes it. */
  notesPickFolder(): Promise<string | null>
  /** memo's `folders add` for a path the window returned; Rust checks it first. Failures come as a closed problem. */
  notesFolderAdd(id: string, path: string): Promise<NotesFolderAdded>
  /** memo's `folders remove`; with `deleteNotes` also that folder's notes in memo's store (never files on disk). */
  notesFolderRemove(id: string, folder: string, deleteNotes: boolean): Promise<NotesFolderRemoved>
  /** memo's `sync --only notes`; the same events as `syncRun`, stopped with `syncStop(id, null)`. */
  notesSync(id: string, onEvent: (e: SyncEvent) => void): Promise<void>
  /** Downloads the catalog's search model; a memo that prints no progress lines sends only the end. */
  notesModelDownload(id: string, model: string, onEvent: (e: NotesModelEvent) => void): Promise<void>
  /** memo's `models set` for a downloaded model the card shows; what memo will embed again, or a closed problem. */
  notesModelUse(id: string, model: string): Promise<NotesModelUsed>
  notesModelStop(id: string): Promise<void>
  /** What a bug report carries about this computer, masked, including recent failed runs (private). */
  reportContext(): Promise<ReportContext>
  sendReport(draft: ReportDraft, context: ReportContext): Promise<ReportSent>
  /** News from WireCat for this version and OS. The request carries nothing about the owner; rejects when offline. */
  notifications(): Promise<Notification[]>
  /** `query` is the CLI's own filter (exact `field:value` terms); `page` starts at 1. */
  listRuns(id: string, query: string | null, limit: number, page: number): Promise<RunsPage>
  showRun(id: string, run: string): Promise<RunDetail>
  /**
   * The tool's own search of what it stored on this computer, for the profile the owner chose (null for a tool
   * without profiles). Never asks the provider. A query the tool refuses is an answer, not a rejection.
   */
  searchStore(id: string, profile: string | null, query: string, limit: number, page: number): Promise<SearchAnswer>
  /**
   * A messenger's own count of what it stored for one profile in the period, by day, hour, sender (`me` is the owner)
   * or chat, of all messages or one kind. Local store only. Names are the owner's own data: shown on the page, never logged or reported.
   */
  messageStats(id: string, profile: string, ask: Ask, timezone: string): Promise<MessageCounts>
  /** One of the tool's own aggregates for the period (`aggregates` in the catalog); `old` until the tool has it. */
  analyticsAggregate(
    id: string,
    which: Which,
    profile: string | null,
    period: Period,
    timezone: string,
  ): Promise<Aggregate>
  /** What no tool counts yet: always null in the real app, sample data in the browser build. */
  analyticsPreview(period: Period): Promise<AnalyticsPreview | null>
  /** The values one of the tool's own read-only lists names (`search.values` in the catalog), such as chat titles. */
  searchValues(id: string, profile: string | null, source: string): Promise<ValueItem[]>
  /** What surrounds one hit in the local store (`search.context` in the catalog), by the ref the hit carries. */
  searchContext(id: string, profile: string | null, reference: string): Promise<SearchContext>
  /**
   * The owner's words as the tool's query, written by the agent or key the owner set up; never run by itself. Only
   * the browser build has it so far: the tool command it needs is planned, not built.
   */
  searchDraft(id: string, request: string): Promise<QueryDraft>
  /** `profile: null` is the defaults every profile gets, or the one file a tool without per-profile settings keeps. */
  settingsShow(id: string, profile: string | null): Promise<Settings>
  /** `defaults` changes what every profile gets instead of one profile. Rejects with the tool's own message. */
  settingsSet(id: string, profile: string | null, defaults: boolean, setting: string, value: string): Promise<void>
  settingsUnset(id: string, profile: string | null, defaults: boolean, setting: string): Promise<void>
  /** Levels the owner set, plus per-command access when the tool reports it. Saved with `settingsSet`. */
  permissionsShow(id: string, profile: string | null): Promise<Permissions>
  /** Null when this is the newest release. */
  checkUpdate(): Promise<AppUpdate | null>
  /** Downloads and installs the update `checkUpdate` found; the app keeps running until `restart`. */
  installUpdate(onProgress: (p: UpdateProgress) => void): Promise<void>
  /** A .deb or .rpm copy: downloads that version's package, signature checked, into Downloads and opens it. */
  downloadPackageUpdate(version: string, onProgress: (p: UpdateProgress) => void): Promise<PackageOutcome>
  /** Opens the user's terminal with the install command for the package just saved; they type their password there. */
  openPackageTerminal(): Promise<void>
  restart(): Promise<void>
  /**
   * wirecat:// links the system hands the app, the one that started it first; `null` for a link Rust refused, whose
   * text never reaches the interface. One listener for the app's life.
   */
  listenLinks(onLink: (target: DeepLinkTarget | null) => void): Promise<void>
  /** A digest's runs, one per day, newest first, from the files its schedule keeps; no name is the morning digest. */
  digestList(digest?: string): Promise<DigestDay[]>
  digestShow(date: string, digest?: string): Promise<Digest>
  /** A system notification for a new digest; on Linux a click opens that day (`digest/<date>`). */
  digestNotify(date: string, title: string, body: string, open: string): Promise<void>
  /**
   * memo's `digest list`, every digest by name, and its other schedules, read only. A memo without `digest list`
   * answers with its morning digest as the one row (`named: false`).
   */
  digestBook(): Promise<DigestBook>
  /** memo's `digest add` (`create`) or `digest edit`; rejects with memo's words, or before memo for a bad value. */
  digestSave(spec: DigestSpec, create: boolean): Promise<DigestBook>
  /** memo's `digest run`: one paid run now, sent as `to` says; answers once it ends. */
  digestRun(digest: string, to: SendTo): Promise<DigestBook>
  /** memo's `digest pause|resume`; every setting stays. */
  digestSetScheduled(digest: string, on: boolean): Promise<DigestBook>
  /** memo's `digest remove`: the settings and schedule go, the past days stay. */
  digestRemove(digest: string): Promise<DigestBook>
  /** memo's `digest backfill`: without `yes` the price only, with it the days built (never delivered). */
  digestBackfill(from: string, to: string, yes: boolean, digest?: string): Promise<Backfill>
  /** memo's `digest brief show`: the owner's own words on what the digest collects. */
  digestBrief(digest?: string): Promise<Brief>
  /** memo's `digest brief edit --file -`, the text on stdin; rejects with memo's words (too long, not the owner). */
  digestBriefSave(body: string, digest?: string): Promise<Brief>
  /** memo's `digest brief edit --undo`: the body the last change replaced comes back. */
  digestBriefUndo(digest?: string): Promise<Brief>
  /** memo's `digest brief reset`: the digest follows its skill alone; undo brings the brief back. */
  digestBriefReset(digest?: string): Promise<Brief>
  /** memo's `templates show report/<digest>` for one channel and language. */
  digestTemplate(channel: TemplateChannel, locale: TemplateLocale, digest?: string): Promise<DigestTemplate>
  /** memo's `templates edit`, the body on stdin; memo checks it first and rejects with why. */
  digestTemplateSave(
    channel: TemplateChannel,
    locale: TemplateLocale,
    body: string,
    digest?: string,
  ): Promise<DigestTemplate>
  digestTemplateUndo(channel: TemplateChannel, locale: TemplateLocale, digest?: string): Promise<DigestTemplate>
  /** memo's `templates reset`: the shipped template applies again; undo brings the owner's back. */
  digestTemplateReset(channel: TemplateChannel, locale: TemplateLocale, digest?: string): Promise<DigestTemplate>
  /** memo's `templates preview`: what would be sent with `draft`, or with the template that applies when null. */
  digestTemplatePreview(
    channel: TemplateChannel,
    locale: TemplateLocale,
    draft: string | null,
    digest?: string,
  ): Promise<TemplatePreview>
  openUrl(url: string): Promise<void>
  window(action: WindowAction): Promise<void>
}

/** What the last sync applied (`item.scope` of a CRM sync, cli-core #2695); a CRM that cannot limit reports `all`. */
export type CrmAppliedScope = { mode: "mine"; also: string[] } | { mode: "all" }

/** `scope` is the setting `crm.<provider>:<account>.scope`: what the next sync copies, not what the board shows. */
export type CrmScope =
  | { kind: "settable"; scope: "mine" | "all"; applied: CrmAppliedScope | null }
  | {
      kind: "unavailable"
      scope: "mine" | "all" | null
      applied: null
      /** No CLI here writes this CRM or has the setting yet, it is not installed, too old, or no profile is chosen. */
      why: "crmCli" | "crmCliMissing" | "crmCliOld" | "profile"
    }
