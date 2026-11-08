mod account;
mod agent_run;
mod analytics;
mod archive;
mod background;
mod backup;
#[cfg(test)]
mod bindings;
mod bots;
mod cache;
mod catalog;
mod chats;
mod cloudflare;
mod cloudflare_install;
mod commands;
mod community;
mod compat;
mod config_repair;
mod conversation;
mod deep_link;
mod digest_schedule;
mod digests;
mod drive_folders;
mod error;
mod funnel_helper;
mod install;
#[cfg(test)]
mod install_e2e;
mod log;
mod mail_agent;
mod mcp;
mod mcp_server;
mod memory;
mod names;
mod node;
mod notes_setup;
mod notifications;
mod npm_prefix;
mod own_risks;
mod own_scan;
#[cfg(test)]
mod own_tool_e2e;
mod own_tools;
mod package_update;
#[cfg(test)]
mod page_loads;
mod paths;
mod permissions;
mod preflight;
mod profile;
mod provenance;
mod public_address;
mod query_writer;
mod redact;
mod registry;
mod report;
mod run;
mod runs;
mod search;
mod self_test;
mod settings;
mod signin;
mod signin_steps;
mod skills;
mod storage;
mod sync;
mod sync_schedule;
mod system;
mod tailscale;
mod tailscale_install;
mod tailscale_linux;
mod task_board;
mod tasks;
mod terminal;
mod terminal_path;
mod tools;
mod zoom_app;

use install::Running;
use std::sync::Arc;
use tauri::Manager;

fn window_state() -> tauri_plugin_window_state::StateFlags {
    use tauri_plugin_window_state::StateFlags;
    // Not VISIBLE: a window saved while hidden would never show again. Not DECORATIONS: the app draws its own frame.
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

fn listen_for_links(app: &tauri::AppHandle) {
    use tauri_plugin_deep_link::DeepLinkExt;
    // An AppImage, a moved copy and a dev build are not registered by an installer; macOS cannot register at runtime.
    #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
    if let Err(e) = app.deep_link().register_all() {
        eprintln!("[wirecat] wirecat:// links not registered: {e}");
    }
    if let Ok(Some(urls)) = app.deep_link().get_current() {
        deep_link::open(app, urls.iter().map(tauri::Url::as_str));
    }
    let handle = app.clone();
    app.deep_link().on_open_url(move |event| deep_link::open(&handle, event.urls().iter().map(tauri::Url::as_str)));
}

/// The exit code when the command line asks for the install check's self-test (`self_test.rs`), before any window.
#[must_use]
pub fn self_test() -> Option<i32> {
    self_test::from_command_line()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[expect(clippy::too_many_lines, reason = "the handler list names every command, one per line")]
pub fn run() {
    // The login shell's PATH takes about half a second; read it while the window opens, not on the first page.
    std::thread::spawn(|| {
        paths::search_path();
        npm_prefix::keep_tools_on_windows_path();
    });
    std::thread::spawn(|| {
        node::make_app_data_private();
        cloudflare::remove_left_scratch();
    });
    std::thread::spawn(registry::keep_fresh);
    tauri::Builder::default()
        // First, as the plugin asks: a second launch for a wirecat:// link reaches this window through it.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| deep_link::show_window(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        // Every launch, a restart included, opens where the owner left the window. A saved spot on a monitor that is
        // gone is ignored and the window opens centred.
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(window_state()).build())
        .manage(Arc::new(Running::default()))
        .manage(deep_link::Links::default())
        .setup(|app| {
            // Without a log the app still works; it says why on stderr.
            if let Err(e) = app.path().app_log_dir().map_err(|e| e.to_string()).and_then(|dir| log::init(&dir)) {
                eprintln!("[wirecat] no log file: {e}");
            }
            listen_for_links(app.handle());
            digests::mark_running();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::community::extra_tools,
            commands::community::community_status,
            commands::community::set_community_shown,
            commands::own_tools::own_tools_status,
            commands::own_tools::set_own_tools_allowed,
            commands::own_tools::own_tool_discover,
            commands::own_tools::own_tool_risks,
            commands::own_tools::own_tool_add,
            commands::own_tools::own_tool_uninstall,
            commands::own_tools::own_tool_remove,
            commands::app::deep_link_listen,
            commands::app::digest_list,
            commands::app::digest_show,
            commands::app::digest_notify,
            commands::app::digest_schedule,
            commands::app::digest_schedule_save,
            commands::app::digest_schedule_remove,
            commands::app::digest_schedule_run,
            commands::app::digest_backfill,
            commands::app::readiness,
            commands::app::report_context,
            commands::app::send_report,
            commands::app::notifications,
            commands::app::update_kind,
            commands::app::update_download_package,
            commands::app::update_package_terminal,
            commands::node::node_offer,
            commands::node::setup_node,
            commands::node::cancel_node_setup,
            commands::node::remove_node,
            commands::node::node_path,
            commands::node::set_node_path,
            commands::tools::detect_tools,
            commands::tools::latest_versions,
            commands::tools::list_profiles,
            commands::tools::diagnose,
            commands::tools::install_tool,
            commands::tools::uninstall_tool,
            commands::tools::remove_copy,
            commands::tools::background_status,
            commands::tools::background_run,
            commands::tools::mail_agent_status,
            commands::tools::mail_agent_set,
            commands::tools::mail_agent_waiting,
            commands::tools::cancel_install,
            commands::notes_setup::notes_setup_status,
            commands::notes_setup::notes_pick_folder,
            commands::notes_setup::notes_folder_add,
            commands::notes_setup::notes_folder_remove,
            commands::notes_setup::notes_sync,
            commands::notes_setup::notes_model_download,
            commands::notes_setup::notes_model_stop,
            commands::notes_setup::notes_model_use,
            commands::tools::config_repair,
            commands::tools::account_sign_out,
            commands::tools::account_remove_supported,
            commands::tools::account_remove_plan,
            commands::tools::account_remove,
            commands::tools::open_setup,
            commands::storage::storage_report,
            commands::storage::clear_storage,
            commands::storage::open_folder,
            commands::store::store_info,
            commands::store::store_compat,
            commands::store::store_preflight,
            commands::store::store_tables,
            commands::store::store_check,
            commands::store::store_backup,
            commands::store::cancel_store_backup,
            commands::store::list_backups,
            commands::store::open_backups,
            commands::store::store_reset_preview,
            commands::store::store_reset,
            commands::agents::run_agent,
            commands::agents::detect_agents,
            commands::agents::skill_status,
            commands::agents::skill_install,
            commands::agents::skill_show,
            commands::agents::terminal_reach,
            commands::agents::fix_terminal_path,
            commands::agents::terminal_shells,
            commands::agents::use_terminal_shell,
            commands::agents::agent_chats,
            commands::agents::mcp_registrations,
            commands::agents::mcp_remove,
            commands::tailscale::tailscale_status,
            commands::tailscale::tailscale_download,
            commands::tailscale::tailscale_terminal,
            commands::tailscale::tailscale_login,
            commands::tailscale::tailscale_stop,
            commands::tailscale::tailscale_funnel_open,
            commands::tailscale::tailscale_funnel_close,
            commands::tailscale::tailscale_funnels,
            commands::tailscale::funnel_helper_status,
            commands::tailscale::funnel_helper_start,
            commands::tailscale::funnel_helper_open,
            commands::cloudflare::cloudflare_status,
            commands::cloudflare::cloudflare_install,
            commands::cloudflare::cloudflare_login,
            commands::cloudflare::cloudflare_stop,
            commands::cloudflare::cloudflare_create,
            commands::cloudflare::cloudflare_tunnel_open,
            commands::cloudflare::cloudflare_tunnel_close,
            commands::cloudflare::cloudflare_routes,
            commands::mcp_server::mcp_server_status,
            commands::mcp_server::mcp_server_start,
            commands::mcp_server::mcp_server_stop,
            commands::mcp_server::mcp_server_revoke,
            commands::mcp_server::mcp_server_oauth,
            commands::mcp_server::mcp_server_public,
            commands::mcp_server::mcp_server_config,
            commands::tasks::task_claims,
            commands::tasks::task_release,
            commands::tasks::task_list,
            commands::tasks::task_counts,
            commands::tasks::task_show,
            commands::tasks::task_history,
            commands::tasks::task_create,
            commands::tasks::task_update,
            commands::tasks::task_move,
            commands::tasks::task_assign,
            commands::tasks::task_comments,
            commands::tasks::task_comment_add,
            commands::tasks::people_list,
            commands::tasks::person_add,
            commands::tasks::project_list,
            commands::memory::memory_read,
            commands::memory::conversation_read,
            commands::memory::memory_sources,
            commands::memory::memory_confirm,
            commands::memory::memory_discard,
            commands::memory::memory_correct,
            commands::memory::memory_forget,
            commands::memory::memory_source_context,
            commands::memory::memory_open_source,
            commands::search::list_runs,
            commands::search::search_store,
            commands::search::message_stats,
            commands::search::analytics_aggregate,
            commands::search::search_context,
            commands::search::search_draft,
            commands::search::search_values,
            commands::search::show_run,
            commands::settings::settings_show,
            commands::settings::settings_set,
            commands::settings::settings_unset,
            commands::settings::permissions_show,
            commands::signin::sign_in,
            commands::signin::bot_sign_in,
            commands::signin::list_bots,
            commands::signin::sign_in_answer,
            commands::signin::sign_in_stop,
            commands::setup_extras::zoom_app_setup,
            commands::setup_extras::drive_folders_browse,
            commands::setup_extras::drive_folder_add,
            commands::setup_extras::drive_folders_chosen,
            commands::setup_extras::drive_folder_remove,
            commands::sync::sync_run,
            commands::sync::sync_stop,
            commands::sync::sync_last,
            commands::sync::sync_schedule_status,
            commands::sync::sync_schedule_set
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_, event| {
            if let tauri::RunEvent::Exit = event {
                digests::unmark_running();
            }
        });
}
