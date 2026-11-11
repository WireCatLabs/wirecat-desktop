import * as v from "valibot"

export const TargetSchema = v.picklist(["claude", "agents", "hermes"])

export const AgentsSchema = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    foundBy: v.nullable(v.picklist(["program", "folder"])),
    reads: v.array(TargetSchema),
    /** Only when not found: what was looked for, and where. */
    looked: v.optional(
      v.object({
        programs: v.array(v.string()),
        files: v.array(v.string()),
        folders: v.array(v.string()),
        shell: v.nullable(v.string()),
        shellProblem: v.nullable(v.string()),
      }),
    ),
  }),
)

/** `state: null` when only the installed version is known; the interface compares it with the tool's. */
export const SkillReportSchema = v.object({
  source: v.picklist(["status", "doctor", "none"]),
  targets: v.array(
    v.object({
      target: TargetSchema,
      path: v.nullable(v.string()),
      installed: v.nullable(v.string()),
      state: v.nullable(v.picklist(["current", "stale", "missing", "unversioned"])),
    }),
  ),
})

/** The version `skill install` wrote, when the tool said. */
export const SkillWrittenSchema = v.nullable(v.string())

export type Target = v.InferOutput<typeof TargetSchema>
export type Agent = v.InferOutput<typeof AgentsSchema>[number]
export type SkillReport = v.InferOutput<typeof SkillReportSchema>

/** The SKILL.md the installed version of a tool ships, as `skill show --json` prints it. */
export const SkillTextSchema = v.object({ name: v.string(), content: v.string() })

/** By tool id: whether a terminal's own PATH finds the tool, without the folders the app adds. */
export const TerminalReachSchema = v.record(v.string(), v.boolean())

/** What `fix_terminal_path` changed: folders put on the user's PATH, and where, or the line to add by hand. */
/** One shell whose startup files hold WireCat's PATH blocks, and whether a new terminal running it finds the tools. */
export const ShellReachSchema = v.object({
  name: v.string(),
  program: v.nullable(v.string()),
  files: v.array(v.string()),
  finds: v.nullable(v.boolean()),
  primary: v.boolean(),
})
export type ShellReach = v.InferOutput<typeof ShellReachSchema>

export const PathFixSchema = v.object({
  added: v.array(v.string()),
  unreachable: v.array(v.string()),
  file: v.nullable(v.string()),
  manual: v.nullable(v.string()),
  restart: v.boolean(),
  shells: v.optional(v.array(ShellReachSchema), []),
})
export type PathFix = v.InferOutput<typeof PathFixSchema>

/** The shells `/etc/shells` lists that exist, the one the checks use now, and the one the owner picked, if any. */
export const ShellChoicesSchema = v.object({
  shells: v.array(v.string()),
  current: v.nullable(v.string()),
  chosen: v.nullable(v.string()),
})
export type ShellChoices = v.InferOutput<typeof ShellChoicesSchema>

/** What `run_agent` did: the agent opened in a terminal with the prompt (saved to `file` too), or why it could not. */
export const AgentRunSchema = v.object({
  started: v.boolean(),
  agent: v.string(),
  file: v.string(),
  reason: v.nullable(v.picklist(["missing", "terminal", "automation"])),
  message: v.nullable(v.string()),
})
export type AgentRun = v.InferOutput<typeof AgentRunSchema>

/** WireCat server names an agent has registered, and where that was read. */
export const RegistrationsSchema = v.object({
  source: v.string(),
  names: v.array(v.string()),
  canAdd: v.boolean(),
  canRemove: v.boolean(),
  /** Where the owner can look when the app does not read this agent's servers. */
  unread: v.optional(v.nullable(v.string()), null),
})

/** The chat apps that can drive an agent, by name only; `running` is null when the source does not say. */
export const ChatsSchema = v.object({
  source: v.string(),
  running: v.nullable(v.boolean()),
  channels: v.array(v.string()),
})

/** Claimed open tasks of one profile: ids, keys and holders only, never a title. */
export const ClaimsSchema = v.object({
  items: v.array(
    v.object({ id: v.string(), key: v.nullable(v.string()), holder: v.string(), until: v.nullable(v.string()) }),
  ),
  open: v.number(),
  more: v.boolean(),
  signedOut: v.optional(v.boolean(), false),
})

export type SkillText = v.InferOutput<typeof SkillTextSchema>
export type Registrations = v.InferOutput<typeof RegistrationsSchema>
export type Chats = v.InferOutput<typeof ChatsSchema>
export type Claims = v.InferOutput<typeof ClaimsSchema>
export type Claim = Claims["items"][number]
