// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = wirecat_desktop_lib::self_test() {
        std::process::exit(code);
    }
    wirecat_desktop_lib::run();
}
