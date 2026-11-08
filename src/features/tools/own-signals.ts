import type { OwnSignal } from "@/platform/bindings"
import type { OwnReviewText } from "./messages-own-review"

/** What to check and why, for each signal Rust reports (`own_risks.rs`). */
export function signalWords(s: OwnSignal, m: OwnReviewText["signals"]): [string, string] {
  switch (s.kind) {
    case "newPackage":
      return m.newPackage(s.days)
    case "fewVersions":
      return m.fewVersions(s.count)
    case "baseOutOfRange":
      return s.found === null ? m.baseMissing : m.baseOutOfRange(s.found, s.min)
    case "coreOutOfRange":
      return s.found === null ? m.coreMissing : m.coreOutOfRange(s.found, s.min)
    case "networkCode":
      return m.networkCode(s.modules.join(", "))
    case "undeclaredHosts":
      return m.undeclaredHosts(s.hosts.join(", "), s.more)
    case "hiddenCalls":
      return m.hiddenCalls(s.ways)
    case "repoMoved":
      return m.repoMoved(s.to)
    case "nativeCode":
      return m.nativeCode(s.files.join(", "))
    case "bundledUnknown":
      return m.bundledUnknown(s.package)
    case "repoNew":
      return m.repoNew(s.days)
    case "repoStale":
      return m.repoStale(s.days)
    case "fewStars":
      return m.fewStars(s.stars)
    case "noStandardChecks":
      return m.noStandardChecks(s.missing.join(", "))
    case "githubUnchecked":
      return m.githubUnchecked(s.reason)
    default:
      return m[s.kind]
  }
}
