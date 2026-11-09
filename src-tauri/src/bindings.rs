use specta::Types;
use specta_typescript::Typescript;
use std::path::PathBuf;

const HEADER: &str =
    "// Generated from the Rust types by `cargo test bindings` (src-tauri/src/bindings.rs). Do not edit.";

fn types() -> Types {
    Types::default()
        .register::<crate::system::Readiness>()
        .register::<crate::node::Offer>()
        .register::<crate::node::NodeEvent>()
        .register::<crate::profile::PathPlan>()
        .register::<crate::tools::ToolState>()
        .register::<crate::tools::Profile>()
        .register::<crate::tools::Diagnosis>()
        .register::<crate::install::InstallEvent>()
        .register::<crate::install::CopyRemoval>()
        .register::<crate::storage::Area>()
        .register::<crate::registry::Status>()
        .register::<crate::community::Extra>()
        .register::<crate::own_tools::Discovery>()
        .register::<crate::own_tools::Status>()
        .register::<crate::package_update::Kind>()
        .register::<crate::package_update::Progress>()
        .register::<crate::package_update::Outcome>()
        .register::<crate::package_update::Failure>()
        .register::<crate::cloudflare::Status>()
        .register::<crate::cloudflare::RouteState>()
        .register::<crate::mcp_server::ServerStatus>()
        .register::<crate::mcp_server::OAuthSettings>()
        .register::<crate::public_address::PublicCheck>()
        .register::<crate::sync::SyncEvent>()
        .register::<crate::sync::LastSync>()
        .register::<crate::background::Background>()
        .register::<crate::background::BackgroundAction>()
        .register::<crate::background::BackgroundOutcome>()
        .register::<crate::mail_agent::MailAgent>()
        .register::<crate::notes_setup::NotesSetup>()
        .register::<crate::notes_setup::NotesFolderAdded>()
        .register::<crate::notes_setup::NotesFolderRemoved>()
        .register::<crate::notes_setup::NotesModelEvent>()
        .register::<crate::notes_setup::NotesProblem>()
        .register::<crate::enrichment::Enrichment>()
        .register::<crate::enrichment::EnrichmentStatus>()
        .register::<crate::enrichment::SyncEnrichment>()
        .register::<crate::notes_setup::NotesModelUsed>()
        .register::<crate::notes_setup::NotesModelRole>()
        .register::<crate::zoom_app::ZoomAppAnswer>()
        .register::<crate::drive_folders::FolderLevel>()
        .register::<crate::drive_folders::FolderAdded>()
        .register::<crate::drive_folders::FolderRemoved>()
        .register::<crate::drive_folders::ChosenFolders>()
        .register::<crate::account::AccountRemoved>()
        .register::<crate::account::AccountRemoval>()
        .register::<crate::backup::Backups>()
        .register::<crate::backup::BackupEvent>()
        .register::<crate::backup::ResetPreview>()
        .register::<crate::bots::BotResult>()
        .register::<crate::bots::BotProfile>()
        .register::<crate::config_repair::Repair>()
        .register::<crate::preflight::Preflight>()
        .register::<crate::conversation::ChatPage>()
        .register::<crate::conversation::ChatPlace>()
        .register::<crate::conversation::Conversation>()
        .register::<crate::digest_schedule::DigestSchedules>()
        .register::<crate::digest_schedule::Backfill>()
        .register::<crate::digest_editors::Brief>()
        .register::<crate::digest_editors::DigestTemplate>()
        .register::<crate::digest_editors::TemplatePreview>()
        .register::<crate::sync_schedule::SyncSchedule>()
}

fn render() -> String {
    // Every integer the app sends fits a JavaScript number: sizes, counts and milliseconds, never ids.
    let types = specta_util::Remapper::new().dangerous_bigints_as_number().remap_types(types());
    Typescript::default().header(HEADER).export(&types, specta_serde::Format).expect("the Rust types export")
}

fn committed() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/platform/bindings.ts")
}

#[test]
fn bindings_match_the_rust_types() {
    let fresh = render();
    let path = committed();
    let old = std::fs::read_to_string(&path).unwrap_or_default();
    if old != fresh {
        std::fs::write(&path, &fresh).expect("write the bindings");
        panic!("{} was out of date and is now regenerated: review and commit it", path.display());
    }
}
