use serde::Deserialize;
use std::collections::HashMap;
use tauri::{LogicalSize, Manager, PhysicalSize, Runtime, WebviewWindow};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

/// The size `tauri.conf.json` opens the main window at.
const DEFAULT: LogicalSize<f64> = LogicalSize { width: 1120.0, height: 760.0 };
/// GNOME maximizes a new window that takes most of the screen (`auto-maximize`), so a window this big opens as if
/// fullscreen and stays so, since a maximized window is saved as maximized.
const MOST_OF_SCREEN: f64 = 0.8;

#[derive(Deserialize)]
struct Saved {
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
}

pub fn flags() -> StateFlags {
    // Not VISIBLE: a window saved while hidden would never show again. Not DECORATIONS: the app draws its own frame.
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

/// Whether a saved size, put back the way the window-state plugin does it (physical pixels over the window's scale
/// at that moment), leaves room on the screen. The saved pixels may come from a screen of another scale, and the
/// window's scale may not be its screen's yet, so both scales count.
fn fits(saved: PhysicalSize<u32>, window_scale: f64, screen: PhysicalSize<u32>, screen_scale: f64) -> bool {
    let window = saved.to_logical::<f64>(window_scale);
    let screen = screen.to_logical::<f64>(screen_scale);
    window.width < screen.width
        && window.height < screen.height
        && window.width * window.height <= screen.width * screen.height * MOST_OF_SCREEN
}

fn saved<R: Runtime>(window: &WebviewWindow<R>) -> Option<Saved> {
    let app = window.app_handle();
    let file = app.path().app_config_dir().ok()?.join(app.filename());
    let mut all: HashMap<String, Saved> = serde_json::from_str(&std::fs::read_to_string(file).ok()?).ok()?;
    all.remove(window.label())
}

/// Puts the window back where the owner left it, at the default size instead when the saved one would not fit the
/// screen it opens on.
pub fn restore<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.restore_state(flags());
    let Some(saved) = saved(window).filter(|s| !s.maximized) else { return };
    let Some(screen) = window.current_monitor().ok().flatten().or_else(|| window.primary_monitor().ok().flatten())
    else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    if !fits(PhysicalSize::new(saved.width, saved.height), scale, screen.work_area().size, screen.scale_factor()) {
        let _ = window.set_size(DEFAULT);
        let _ = window.center();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAVED: PhysicalSize<u32> = PhysicalSize { width: 2240, height: 1594 };

    #[test]
    fn a_size_saved_on_a_scaled_screen_does_not_fit_an_unscaled_one() {
        assert!(!fits(SAVED, 1.0, PhysicalSize::new(2560, 1440), 1.0));
    }

    #[test]
    fn a_size_saved_on_a_scaled_screen_fits_it_again() {
        assert!(fits(SAVED, 2.0, PhysicalSize::new(4800, 3000), 2.0));
    }

    #[test]
    fn a_window_whose_scale_is_not_its_screens_yet_is_checked_at_the_size_it_will_get() {
        assert!(!fits(SAVED, 1.0, PhysicalSize::new(4800, 3000), 2.0));
    }
}
