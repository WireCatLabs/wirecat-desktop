import * as v from "valibot"
import type { UpdateFailure } from "./bindings"

export type { AptProgress, AptStage, PackageOutcome, UpdateFailure, UpdateKind, UpdateProgress } from "./bindings"

/** Why a package download failed (`package_update::Failure`). A rejected command's value is not typed, so it is
 * checked before the dialog reads it. */
export const UpdateFailureSchema = v.variant("reason", [
  v.object({
    reason: v.picklist(["offline", "server", "refused", "busy", "unavailable", "other"]),
    detail: v.string(),
  }),
  v.object({ reason: v.picklist(["diskFull", "notWritable"]), folder: v.string(), detail: v.string() }),
  v.object({ reason: v.picklist(["newer", "notYet"]), version: v.string() }),
]) satisfies v.GenericSchema<unknown, UpdateFailure>
