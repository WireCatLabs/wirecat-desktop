import {
  blank,
  knownOf,
  nextOf,
  parseSetup,
  SETUP_LIMITS,
  type SetupDocument,
  visibleFields,
} from "@/domain/setup-flow"
import pbx from "@/domain/setup-v1/pbx.json"
import { CommandError, TOO_OLD } from "./command-error"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// A tool that describes its own connection flow (the setup format v1). `?setup=pbx` makes pbx answer `setup show` with
// cli-core's example flow; every other tool, and pbx without it, is a CLI from before the format, so the sign-in keeps
// its hand-made form. `&setup-values=1` edits an existing profile: its settings filled in and a database password kept.
// `&setup-step=<step>` (with `&setup-answers=cdr_source:mysql,files_from:local`) opens the flow on that step, for
// captures. `?setup-fail=auth|network` fails the check (`mock-signin.ts`).

const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const described = query.get("setup")
const editing = query.get("setup-values") === "1"

const VALUES: NonNullable<SetupDocument["values"]> = {
  cdr_source: "mysql",
  files_from: "local",
  db_host: "pbx.office.local",
  db_user: "asterisk",
  db: { set: true },
  phone_region: ["ES"],
}

/** A stand-in for the FreePBX screenshot a real package ships, drawn here so the mock carries no image file. */
function sampleScreen(): string | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = 960
  canvas.height = 540
  const g = canvas.getContext("2d")
  if (!g) return null
  g.fillStyle = "#f4f6f5"
  g.fillRect(0, 0, 960, 540)
  g.fillStyle = "#1f3b4d"
  g.fillRect(0, 0, 960, 64)
  g.fillStyle = "#ffffff"
  g.font = "bold 26px sans-serif"
  g.fillText("FreePBX  ·  Settings  ·  CDR Reports", 32, 42)
  const rows = [
    ["CDR database", "asteriskcdrdb"],
    ["Database host", "127.0.0.1"],
    ["Database port", "3306"],
    ["Table", "cdr"],
  ]
  rows.forEach(([label, value], i) => {
    const y = 130 + i * 90
    g.fillStyle = "#3a4a44"
    g.font = "22px sans-serif"
    g.fillText(label ?? "", 48, y)
    g.strokeStyle = "#b8c4bf"
    g.strokeRect(330, y - 34, 520, 50)
    g.fillStyle = "#14231d"
    g.font = "22px monospace"
    g.fillText(value ?? "", 348, y)
  })
  try {
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

/** The walk `setup apply --dry-run` makes: the first visited step with an empty required input stops it. */
function dryRun(doc: SetupDocument, answers: Record<string, unknown>) {
  const known = knownOf(doc, answers)
  const path: string[] = []
  let at: string | undefined = doc.start
  for (let moves = 0; at !== undefined && moves < SETUP_LIMITS.transitions; moves++) {
    const step: SetupDocument["steps"][string] | undefined = doc.steps[at]
    if (!step) break
    path.push(at)
    if (step.kind === "run" || step.kind === "done") return { valid: true, complete: true, at, path, errors: [] }
    const errors = visibleFields(step.blocks, known)
      .filter((f) => blank(answers[f.id]) && !f.optional && f.default === undefined)
      .filter((f) => !(f.type === "input" && f.input === "toggle"))
      .filter((f) => !(editing && ((f.setting && f.setting in VALUES) || (f.type === "input" && f.secret === "db"))))
      .map((f) => ({ input: f.id, setting: f.setting ?? null, message: "is needed" }))
    if (errors.length > 0) return { valid: false, complete: false, at, path, errors }
    at = nextOf(step, known)
  }
  return { valid: true, complete: false, at: path.at(-1) ?? doc.start, path, errors: [] }
}

export function setupMock(): Pick<Platform, "setupShow" | "setupCheck" | "setupPickPath"> {
  return {
    async setupShow(id) {
      await delay(300)
      if (described !== id || id !== "pbx") throw new CommandError(TOO_OLD, "unknown command 'setup'")
      const image = sampleScreen()
      return {
        document: editing ? { ...pbx, values: VALUES } : pbx,
        images: image ? { "freepbx-cdr": image } : {},
      }
    },
    async setupCheck(_id, _profile, answers) {
      await delay(400)
      const parsed = parseSetup(pbx)
      if (parsed.kind !== "flow") throw new Error(parsed.why)
      const doc = editing ? { ...parsed.document, values: VALUES } : parsed.document
      return dryRun(doc, JSON.parse(answers) as Record<string, unknown>)
    },
    async setupPickPath(folder) {
      await delay(200)
      return folder ? "/var/spool/asterisk/monitor" : "/home/you/asterisk/Master.csv"
    },
  }
}
