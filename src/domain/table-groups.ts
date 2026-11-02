// What each table of the shared store holds, for the Storage page's table list. `store tables` says only whether a
// table is data, internal or a search index, so the grouping is by name: the store's own tables as of schema 33, plus
// patterns for the families that grow (`*_index_pending`, `vector_index_*`). A table no rule names is "other".

export const TABLE_GROUPS = [
  "messages",
  "mail",
  "meetings",
  "documents",
  "people",
  "tasks",
  "memory",
  "tags",
  "search",
  "system",
  "other",
] as const
export type TableGroup = (typeof TABLE_GROUPS)[number]

const NAMED: Record<Exclude<TableGroup, "other">, readonly string[]> = {
  messages: [
    "chats",
    "chat_members",
    "chat_revisions",
    "chat_revision_source",
    "chat_events",
    "chat_event_people",
    "messages",
    "message_revisions",
    "message_reactions",
    "message_links",
    "message_transcripts",
    "message_counter_observations",
    "member_counts",
    "member_observations",
    "member_observation_members",
    "member_stays",
    "poll_votes",
    "bots",
    "bot_updates",
    "conversations",
    "conversation_messages",
    "conversation_state",
  ],
  mail: [
    "emails",
    "email_threads",
    "email_recipients",
    "email_locations",
    "email_mailboxes",
    "mailboxes",
    "mail_rules",
  ],
  meetings: [
    "meetings",
    "meeting_series",
    "meeting_participants",
    "meeting_transcripts",
    "meeting_transcript_rows",
    "meeting_summaries",
    "meeting_chat_messages",
    "calendars",
    "calendar_entries",
    "calendar_entry_participants",
    "calendar_entry_revisions",
    "events",
    "event_series",
  ],
  documents: [
    "documents",
    "document_revisions",
    "document_annotation_transfers",
    "files",
    "notes",
    "note_revisions",
    "attachments",
  ],
  people: [
    "persons",
    "identities",
    "identity_links",
    "identity_link_events",
    "identity_revisions",
    "account_identities",
    "organizations",
    "organization_identities",
    "aliases",
    "places",
  ],
  tasks: ["tasks", "task_assignments", "task_events", "task_key_counters", "task_pairs", "projects", "reminders"],
  memory: [
    "memories",
    "facts",
    "decisions",
    "proposed_actions",
    "agent_actions",
    "involvements",
    "mentions",
    "links",
    "link_reviews",
    "entity_link_events",
  ],
  tags: [
    "tags",
    "canonical_tags",
    "canonical_auto_tag_claims",
    "tag_consolidations",
    "taggings",
    "tag_redirects",
    "resolved_tags",
    "searches",
  ],
  search: [
    "chunks",
    "chunk_messages",
    "embeddings",
    "search_terms",
    "search_term_trigrams",
    "search_index_state",
    "vector_indexes",
    "vector_index_redo",
  ],
  system: ["accounts", "syncs", "sync_cursors", "sync_ranges", "fetch_leases", "store_settings", "schema_migrations"],
}

const BY_NAME = new Map(
  (Object.entries(NAMED) as [TableGroup, readonly string[]][]).flatMap(([g, names]) => names.map((n) => [n, g])),
)

export function groupOf(t: { name: string; kind: string }): TableGroup {
  if (t.kind === "search_index" || t.kind === "search_index_part") return "search"
  const named = BY_NAME.get(t.name)
  if (named) return named
  if (/_pending$|^vector_index_/.test(t.name)) return "search"
  return t.kind === "internal" ? "system" : "other"
}
