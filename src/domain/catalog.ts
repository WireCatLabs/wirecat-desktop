import * as v from "valibot"
import raw from "../../catalog/tools.json"

/** What a tool's sign-out takes away: its sign-in here, and the session the service keeps for this computer. */
export const ACCOUNT_REMOVES = ["signIn", "serverSession", "deviceKeys", "linkedDevice"] as const
/** What stays after it: the app keys, settings, chosen folders, the copied data, the name in the list, the access. */
export const ACCOUNT_KEEPS = [
  "appKeys",
  "settings",
  "folders",
  "data",
  "mail",
  "listed",
  "googleAccess",
  "providerAccess",
] as const

const ToolSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
  name: v.string(),
  /** Another tool's id: this one ships in that tool's package and has no install of its own. */
  partOf: v.optional(v.pipe(v.string(), v.regex(/^[a-z]+$/))),
  /** Installed and run by the app for a feature and never listed as a tool: WireCat's own Tailscale connection. */
  helper: v.optional(v.boolean(), false),
  /** The owner's command group that is this part, such as memo's `mail …`: its run logs are filed under the part. */
  commandPrefix: v.optional(v.string()),
  tagline: v.pipe(v.string(), v.maxLength(55)),
  bin: v.string(),
  package: v.string(),
  /** Made outside WireCatLabs and added at start from Rust's `extra_tools`; never set in tools.json. */
  community: v.optional(v.literal(true)),
  summary: v.string(),
  docs: v.pipe(v.string(), v.url()),
  /** Null only for an own tool whose repository is private or outside GitHub. */
  repo: v.nullable(v.pipe(v.string(), v.url())),
  profiles: v.nullable(v.object({ args: v.array(v.string()), shape: v.string() })),
  doctor: v.array(v.string()),
  runs: v.nullable(v.object({ list: v.array(v.string()), show: v.array(v.string()) })),
  /**
   * The tool's own Lucene search of its local store; Rust fills the slots. `fields` are what the query bar suggests:
   * `top` ones first, the rest behind "More fields"; `values` is a fixed list, or the name of a `values` list that the
   * tool's own read-only command gives.
   */
  search: v.nullable(
    v.object({
      args: v.array(v.string()),
      shape: v.picklist(["items", "item.hits"]),
      what: v.picklist(["messages", "meetings", "documents", "notes", "mail"]),
      fields: v.array(
        v.object({
          name: v.string(),
          group: v.picklist(["who", "where", "when", "what", "files"]),
          example: v.string(),
          top: v.boolean(),
          values: v.nullable(v.union([v.string(), v.array(v.string())])),
        }),
      ),
      values: v.record(v.string(), v.object({ args: v.array(v.string()), key: v.string() })),
      /** What surrounds a hit: the messages around it, its mail thread, or a meeting's transcript. */
      context: v.optional(v.object({ args: v.array(v.string()) })),
    }),
  ),
  setup: v.nullable(v.array(v.string())),
  signIn: v.nullable(
    v.object({
      gives: v.string(),
      asks: v.string(),
      guide: v.optional(v.pipe(v.string(), v.url())),
      /** Shown for the owner to run when the tool has no interactive `setup`; the app never runs it. */
      command: v.optional(v.string()),
      /** The methods are the owner's first choice, such as the mail provider, rather than another way to sign in. */
      pick: v.optional(v.boolean()),
      /** zm's `app --json`: what to enter when making the Zoom app, read by `zoom_app_setup` (zoom-cli PR #337). */
      appSetup: v.optional(v.array(v.string())),
      /**
       * Sign-ins the app runs in its own window instead of a terminal, the first one by default. `address`, `password`
       * and `clientFile` name where Rust passes what the owner typed; `clientId` is the setting that names the owner's
       * own app, saved before the run (WC-SECR-25). `oauth`: the words for the browser with the tool's own app, from `oauthMinVersion`.
       */
      methods: v.optional(
        v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            words: v.array(v.string()),
            address: v.optional(v.string()),
            password: v.optional(v.string()),
            clientFile: v.optional(v.string()),
            clientId: v.optional(v.string()),
            oauth: v.optional(v.array(v.string())),
            oauthMinVersion: v.optional(v.string()),
          }),
        ),
      ),
    }),
  ),
  /**
   * A bot of the messenger's own Bot API beside the personal account: `set` reads the token on stdin, `fields` are the
   * settings it needs first (WhatsApp's ids), `create` is where the owner makes the bot.
   */
  bot: v.optional(
    v.nullable(
      v.object({
        set: v.array(v.string()),
        list: v.array(v.string()),
        token: v.picklist(["telegram", "opaque"]),
        create: v.pipe(v.string(), v.url()),
        docs: v.pipe(v.string(), v.url()),
        fields: v.array(v.object({ key: v.pipe(v.string(), v.regex(/^[a-z_]+$/)), words: v.array(v.string()) })),
      }),
    ),
    null,
  ),
  skill: v.nullable(
    v.object({
      status: v.array(v.string()),
      install: v.array(v.string()),
      doctorSkills: v.optional(v.array(v.string())),
      show: v.array(v.string()),
    }),
  ),
  /** The HTTP MCP server for browser apps, run in the background by the tool; `{port}` and `{url}` are filled in Rust. */
  mcpServer: v.nullable(
    v.object({
      /** The port the guide offers; a different one per tool, so two tools' servers do not collide. */
      port: v.number(),
      start: v.array(v.string()),
      stop: v.array(v.string()),
      status: v.array(v.string()),
      revoke: v.array(v.string()),
      config: v.nullable(v.array(v.string())),
    }),
  ),
  /** The Memory page: memo from this version on lists, corrects and forgets memories, facts and proposed actions. */
  memory: v.optional(v.nullable(v.object({ minVersion: v.string() })), null),
  /** Open tasks with their claim holders, and releasing a claim as the owner. */
  tasks: v.nullable(v.object({ list: v.array(v.string()), release: v.array(v.string()) })),
  /** The Tasks page's lowest version of the tool; only memo keeps project tasks. */
  taskBoard: v.optional(v.nullable(v.object({ minVersion: v.string() })), null),
  /** Only memo: the first-run card's folder, notes sync and search model; Rust runs the commands. */
  notesSetup: v.optional(v.nullable(v.object({ minVersion: v.string(), recommended: v.string() })), null),
  /** Only memo: a hosted model rewrites records for search once the owner agrees; memo lists what it offers. */
  enrichment: v.optional(v.nullable(v.object({ show: v.array(v.string()) })), null),
  /** Only drive: `folders browse` and `folders add` after sign-in, run by `drive_folders_browse` and `drive_folder_add`. */
  folderPicker: v.optional(v.nullable(v.object({ parent: v.string() })), null),
  /**
   * Removing one account with the tool's own words. `remove` is cli-core's `account remove`, run by Rust from
   * `minVersion` on (null: not released yet); before it, `signOut` is the fallback, and `removes` and `keeps` say what
   * that sign-out takes away and what stays, read from each CLI's source.
   */
  accountRemove: v.optional(
    v.nullable(
      v.object({
        signOut: v.nullable(v.array(v.string())),
        remove: v.optional(
          v.nullable(
            v.object({
              minVersion: v.nullable(v.string()),
              keepData: v.array(v.string()),
              deleteData: v.array(v.string()),
              dryRun: v.string(),
              confirm: v.string(),
            }),
          ),
          null,
        ),
        removes: v.array(v.picklist(ACCOUNT_REMOVES)),
        keeps: v.array(v.picklist(ACCOUNT_KEEPS)),
      }),
    ),
    null,
  ),
  /** The messengers' own `serve` in the background, per profile: `server status`, `install`, `start`, `stop` and `uninstall`. */
  background: v.optional(
    v.nullable(
      v.object({
        status: v.array(v.string()),
        install: v.array(v.string()),
        start: v.array(v.string()),
        stop: v.array(v.string()),
        uninstall: v.array(v.string()),
      }),
    ),
    null,
  ),
  /** Only email: memo's scheduled agent that reads new mail and proposes; Rust runs its commands. */
  mailAgent: v.optional(v.nullable(v.object({ via: v.string(), name: v.string() })), null),
  /** The tool's own sync; `run` is null when there is none to start and `note` says how it syncs instead. */
  sync: v.nullable(
    v.object({
      run: v.nullable(v.array(v.string())),
      last: v.nullable(v.array(v.string())),
      lastShape: v.picklist(["runs", "driveStatus"]),
      what: v.picklist(["messages", "files", "meetings", "notes and mail", "mail", "records"]),
      note: v.nullable(v.string()),
    }),
  ),
  storeInfo: v.nullable(v.array(v.string())),
  storeTables: v.nullable(v.array(v.string())),
  storeTableSizes: v.nullable(v.array(v.string())),
  storeCheck: v.nullable(v.array(v.string())),
  configRepair: v.optional(v.nullable(v.array(v.string())), null),
  storeBackup: v.nullable(v.array(v.string())),
  storeBackupEncrypted: v.nullable(v.array(v.string())),
  storeResetPreview: v.nullable(v.array(v.string())),
  storeReset: v.nullable(v.array(v.string())),
  storage: v.object({ app: v.string(), env: v.string() }),
  settings: v.nullable(
    v.object({
      show: v.array(v.string()),
      set: v.array(v.string()),
      unset: v.nullable(v.array(v.string())),
      shape: v.picklist(["rows", "flat", "profiles"]),
      perProfile: v.boolean(),
      defaults: v.boolean(),
      jsonValues: v.boolean(),
      keys: v.nullable(v.record(v.string(), v.string())),
      readOnly: v.array(v.string()),
    }),
  ),
  /** Each group is a top-level command word that is also a permission key `config set` accepts. */
  permissions: v.optional(
    v.object({
      commands: v.array(v.string()),
      groups: v.array(v.object({ key: v.pipe(v.string(), v.regex(/^[a-z][a-z-]*$/)), label: v.string() })),
    }),
  ),
})

const BuiltInSchema = v.pipe(
  ToolSchema,
  v.check((t) => !t.community && t.package.startsWith("@wirecat/"), "a built-in tool is a @wirecat package"),
)

/** Rust already refused anything unsafe (`community.rs`); this only keeps the interface's own types honest. */
const CommunitySchema = v.pipe(
  ToolSchema,
  v.check(
    (t) => t.community === true && !t.package.startsWith("@wirecat/") && !t.partOf,
    "a community tool has its own npm scope and is no part of ours",
  ),
)

const CatalogSchema = v.object({
  requirements: v.object({ nodeLabel: v.string(), nodeDownload: v.pipe(v.string(), v.url()) }),
  tools: v.array(BuiltInSchema),
  sharedStorage: v.object({ app: v.string(), env: v.string(), label: v.string() }),
})

/** Where a tool came from: compiled in, the signed list, or the owner's own file. Rust sets it, never the entry. */
export type ToolSource = "official" | "community" | "own"
export type CatalogTool = v.InferOutput<typeof ToolSchema> & { source?: ToolSource }
export type SearchField = NonNullable<CatalogTool["search"]>["fields"][number]

const catalog = v.parse(CatalogSchema, raw)

/** The tools the pages list; a helper (WireCat's own Tailscale connection) is installed by a feature and never listed. */
const all: CatalogTool[] = catalog.tools.filter((t) => !t.helper)
const helpers: readonly CatalogTool[] = catalog.tools.filter((t) => t.helper)
export const tools: readonly CatalogTool[] = all
export const requirements = catalog.requirements
export const sharedStorage = catalog.sharedStorage

export const isCommunity = (t: CatalogTool) => t.community === true
/** Added by the owner without WireCat's review: the **Not verified** badge. */
export const isOwn = (t: CatalogTool) => t.source === "own"

type Rejection = { source: ToolSource; text: string }

/**
 * Appends the community tools Rust accepted; returns a sentence for each entry left out. Called once before the
 * interface loads, because pages build their lists (Storage areas, Search sources) when their module loads.
 */
export function addCommunityTools(entries: readonly { source: ToolSource; entry: unknown }[]): Rejection[] {
  const rejected: Rejection[] = []
  for (const { source, entry } of entries) {
    const parsed = v.safeParse(CommunitySchema, entry)
    if (!parsed.success) {
      rejected.push({ source, text: `${describe(entry)}: ${v.summarize(parsed.issues)}` })
    } else if (findTool(parsed.output.id)) {
      rejected.push({ source, text: `${parsed.output.id}: the id is taken` })
    } else {
      all.push({ ...parsed.output, source })
    }
  }
  return rejected
}

/**
 * The community and own tools again, after Rust reloaded its catalog: an own tool added or removed while the app runs.
 * Pages that keep a list of tools ask for it when they render, so they see the new one.
 */
export function replaceAddedTools(entries: readonly { source: ToolSource; entry: unknown }[]): Rejection[] {
  for (let i = all.length - 1; i >= 0; i--) if (isCommunity(all[i] as CatalogTool)) all.splice(i, 1)
  return addCommunityTools(entries)
}

/** The interface's own check of an entry Rust built for review, so a tool it would not show is never added. */
export function entryProblem(entry: unknown): string | null {
  const parsed = v.safeParse(CommunitySchema, entry)
  return parsed.success ? null : v.summarize(parsed.issues)
}

const describe = (entry: unknown) =>
  typeof entry === "object" && entry !== null && "id" in entry ? String(entry.id) : "an entry"

/** The GitHub owner a community tool's npm release must be built by, shown in its trust note. */
export const maker = (t: CatalogTool) =>
  t.repo
    ? (t.repo.replace(/^https:\/\/github\.com\//, "").split("/")[0] ?? t.repo)
    : (t.package.split("/")[0] ?? t.package)

export function findTool(id: string): CatalogTool | undefined {
  return all.find((t) => t.id === id) ?? helpers.find((t) => t.id === id)
}

/** WireCat's own Tailscale connection (`wirecat-funnel`), installed from the connect guide. */
export const FUNNEL_HELPER = "funnel"

/** The tool whose package is installed for `id`: installs, updates and uninstalls run once, under this id. */
export const ownerId = (id: string) => findTool(id)?.partOf ?? id

/** The command a tool's sync records in its runs: the words before the first flag (`messages sync`, not `120m`). */
export function syncCommand(tool: CatalogTool): string {
  const words = (tool.sync?.run ?? []).filter((w) => w !== "{profile}")
  const flag = words.findIndex((w) => w.startsWith("-"))
  return (flag < 0 ? words : words.slice(0, flag)).join(" ")
}

/** Every tool that one install brings, the owner first. */
export const samePackage = (id: string) => tools.filter((t) => ownerId(t.id) === ownerId(id))

/** The tool a run belongs to: the owner's, or a part's when the run's command is in the part's command group. */
export function runTool(owner: string, command: string): string {
  // memo puts `mcp` before the command words of a run an agent started through its MCP server.
  const words = command.split(" ")
  const word = words[0] === "mcp" && words.length > 1 ? words[1] : words[0]
  return tools.find((t) => t.partOf === owner && t.commandPrefix === word)?.id ?? owner
}

/** "Memo and Email" for a shared package, the tool's own name otherwise. */
export const installCommand = (t: CatalogTool) => `npm install -g ${t.package}`

/** Removes one copy with the program that installed it; `install.rs` uninstall_steps maps the same managers. */
export function removeCommand(manager: string, pkg: string, path: string) {
  if (manager === "pnpm") return `pnpm remove --global ${pkg}`
  if (manager === "bun") return `bun remove --global ${pkg}`
  if (manager === "volta") return `volta uninstall ${pkg}`
  // An nvm copy belongs to the npm of its own Node version, which may not be the one a terminal has active.
  const nvm = path.match(/[\\/]\.nvm[\\/]versions[\\/]node[\\/](v[^\\/]+)[\\/]/)?.[1]
  return nvm ? `nvm exec ${nvm} npm uninstall --global ${pkg}` : `npm uninstall --global ${pkg}`
}

export const usesProfiles = (t: CatalogTool) => t.profiles !== null

/** Whether the app can sign this tool in inside its own window (`sign_in`), with no terminal. */
export const signsInHere = (t: CatalogTool) => (t.signIn?.methods?.length ?? 0) > 0

/** Whether the app can start this tool's sync; a profile is then needed when its words name one. */
export const syncsHere = (t: CatalogTool) => (t.sync?.run?.length ?? 0) > 0
export const syncNeedsProfile = (t: CatalogTool) => t.sync?.run?.includes("{profile}") ?? false

export const signInMethods = (t: CatalogTool) => t.signIn?.methods ?? []

export type BotSource = NonNullable<CatalogTool["bot"]>

export function setupCommand(t: CatalogTool, profile: string | null): string | null {
  if (!t.setup) return null
  const args = t.setup.map((a) => (a === "{profile}" ? (profile ?? "<profile>") : a))
  return [t.bin, ...args].join(" ")
}

export function doctorCommand(t: CatalogTool, profile: string | null): string {
  const args = t.doctor.map((a) => (a === "{profile}" ? (profile ?? "<profile>") : a))
  return [t.bin, ...args].join(" ")
}

export type SettingsSource = NonNullable<CatalogTool["settings"]>
export type PermissionGroup = NonNullable<CatalogTool["permissions"]>["groups"][number]

export const doctorNeedsProfile = (t: CatalogTool) => t.doctor.includes("{profile}")

export const PROFILE_NAME = /^[A-Za-z0-9._-]{1,64}$/
export const isValidProfile = (name: string) =>
  PROFILE_NAME.test(name) && !name.startsWith("-") && !name.startsWith(".")

/** The command line a catalog template runs, for showing before the owner confirms it. */
export function catalogCommand(t: CatalogTool, args: readonly string[], fill: Record<string, string>): string {
  return [t.bin, ...args.map((a) => (/^\{\w+\}$/.test(a) ? (fill[a.slice(1, -1)] ?? a) : a))].join(" ")
}
