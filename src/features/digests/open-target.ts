import type { ReportTarget } from "@/domain/digest"
import { openCard } from "@/features/clients"
import { openDocument } from "@/features/documents"
import { openTarget } from "@/features/links"
import { openPerson } from "@/features/people"
import { openMeeting } from "@/shared/meeting-open"

/**
 * Opens what a digest's link names in its own card: a person on Contacts, a meeting, a document or a CRM card. The
 * rest are links, opened as the system's links are. Here and not in `links`, which those features import.
 */
export function openReportTarget(target: ReportTarget) {
  if (target.type === "person") return openPerson(`person:${target.id}`)
  if (target.type !== "record") return void openTarget(target)
  switch (target.kind) {
    case "meeting":
      return openMeeting(target.ref)
    case "document":
      return openDocument(target.ref)
    case "deal":
    case "lead":
      return openCard(target.kind, target.ref)
  }
}
