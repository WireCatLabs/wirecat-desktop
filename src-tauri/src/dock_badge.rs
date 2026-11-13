//! The bell's unread count on the app icon in the Linux dock, sent as Unity's `LauncherEntry` signal.
//!
//! Tauri's own badge addresses `WireCat.desktop`, but every Linux package installs `wirecat.desktop`, so the dock
//! ignores it. Ubuntu's dock, Dash to Dock and KDE's task manager listen for this signal by the app's desktop file id.

use std::collections::HashMap;
use std::sync::OnceLock;
use tauri::utils::config::BundleType;
use zbus::blocking::Connection;
use zbus::zvariant::Value;

const PATH: &str = "/dev/wirecat/desktop/LauncherEntry";
const INTERFACE: &str = "com.canonical.Unity.LauncherEntry";

/// The entry the .deb, the .rpm and an `AppImage` install: Tauri names it after the Linux `productName`.
const PACKAGE_ID: &str = "wirecat.desktop";
/// The entry `bin/install-desktop-entry` writes for a build that is not a package.
const DEV_ID: &str = "wirecat-desktop.desktop";

fn desktop_id(bundle: Option<BundleType>) -> &'static str {
    match bundle {
        Some(BundleType::Deb | BundleType::Rpm | BundleType::AppImage) => PACKAGE_ID,
        _ => DEV_ID,
    }
}

type Body = (String, HashMap<&'static str, Value<'static>>);

fn update(bundle: Option<BundleType>, count: u32) -> Body {
    let props = HashMap::from([("count", Value::from(i64::from(count))), ("count-visible", Value::from(count > 0))]);
    (format!("application://{}", desktop_id(bundle)), props)
}

/// One connection for the app's life: the dock drops a sender's count when its bus name leaves, which also clears the
/// badge if the app crashes.
fn connection() -> Option<&'static Connection> {
    static BUS: OnceLock<Option<Connection>> = OnceLock::new();
    BUS.get_or_init(|| {
        Connection::session().inspect_err(|e| tracing::info!("no session bus, the dock shows no count: {e}")).ok()
    })
    .as_ref()
}

/// Without a session bus (a sandbox, a headless run) there is no dock to tell, so that is not an error.
pub fn set(count: u32) -> Result<(), String> {
    let Some(bus) = connection() else { return Ok(()) };
    let body = update(tauri::utils::platform::bundle_type(), count);
    bus.emit_signal(None::<&str>, PATH, INTERFACE, "Update", &body).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use zbus::zvariant::Type;

    #[test]
    fn sends_the_count_for_the_installed_entry() {
        let (uri, props) = update(Some(BundleType::Deb), 3);
        assert_eq!(uri, "application://wirecat.desktop");
        assert_eq!(props["count"], Value::from(3_i64));
        assert_eq!(props["count-visible"], Value::from(true));
        assert_eq!(<Body as Type>::SIGNATURE.to_string(), "(sa{sv})");
    }

    #[test]
    fn hides_the_badge_at_zero() {
        let (_, props) = update(Some(BundleType::AppImage), 0);
        assert_eq!(props["count"], Value::from(0_i64));
        assert_eq!(props["count-visible"], Value::from(false));
    }

    #[test]
    fn every_package_shares_one_entry_and_a_dev_build_uses_the_launcher_script_one() {
        for bundle in [BundleType::Deb, BundleType::Rpm, BundleType::AppImage] {
            assert_eq!(update(Some(bundle), 1).0, "application://wirecat.desktop");
        }
        assert_eq!(update(None, 1).0, "application://wirecat-desktop.desktop");
    }

    #[test]
    fn the_ids_match_the_packaging_files() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let linux: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(root.join("tauri.linux.conf.json")).unwrap()).unwrap();
        assert_eq!(format!("{}.desktop", linux["productName"].as_str().unwrap()), PACKAGE_ID);
        let script = std::fs::read_to_string(root.join("../bin/install-desktop-entry")).unwrap();
        assert!(script.contains(&format!("id=\"{}\"", DEV_ID.trim_end_matches(".desktop"))));
    }

    /// Sends a real signal on this session's bus; watch it with
    /// `dbus-monitor --session "interface='com.canonical.Unity.LauncherEntry'"`.
    #[test]
    #[ignore = "needs a desktop session bus"]
    fn sends_on_the_session_bus() {
        set(7).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(3));
        set(0).unwrap();
    }
}
