import * as v from "valibot"
import type { UpdateFailure } from "./bindings"

export type { PackageOutcome, UpdateFailure, UpdateKind, UpdateProgress } from "./bindings"

/** Why a package download failed (`package_update::Failure`). A rejected command's value is not typed, so it is
 * checked before the dialog reads it. */
export const UpdateFailureSchema = v.variant("reason", [
  v.object({ reason: v.picklist(["offline", "server", "other"]), detail: v.string() }),
  v.object({ reason: v.picklist(["diskFull", "notWritable"]), folder: v.string(), detail: v.string() }),
  v.object({ reason: v.literal("newer"), version: v.string() }),
]) satisfies v.GenericSchema<unknown, UpdateFailure>
