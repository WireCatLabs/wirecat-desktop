use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

const APP: &str = env!("CARGO_BIN_EXE_wirecat-desktop");

/// Killed after a while: an app that ignored the flag would open its window and never exit.
fn run(args: &[&str], env: Option<&str>) -> Output {
    let mut cmd = Command::new(APP);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).env_remove("WIRECAT_SELF_TEST");
    if let Some(value) = env {
        cmd.env("WIRECAT_SELF_TEST", value);
    }
    let mut child = cmd.spawn().expect("the app starts");
    let started = Instant::now();
    while child.try_wait().unwrap().is_none() {
        if started.elapsed() > Duration::from_mins(1) {
            child.kill().unwrap();
            panic!("{args:?} did not exit within a minute");
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    child.wait_with_output().unwrap()
}

#[test]
fn the_self_test_refuses_to_run_without_its_variable() {
    let out = run(&["--self-test", "install-tool", "wa"], None);
    assert_eq!(out.status.code(), Some(2));
    assert!(out.stdout.is_empty(), "{}", String::from_utf8_lossy(&out.stdout));
    assert!(String::from_utf8_lossy(&out.stderr).contains("WIRECAT_SELF_TEST=1"));
}

#[test]
fn the_self_test_answers_one_json_line_with_its_variable() {
    let out = run(&["--self-test", "version"], Some("1"));
    assert_eq!(out.status.code(), Some(0));
    let line: serde_json::Value = serde_json::from_slice(&out.stdout).expect("one JSON line");
    assert_eq!(line["ok"], true);
    assert_eq!(line["app"], env!("CARGO_PKG_VERSION"));
}

#[test]
fn an_unknown_self_test_is_a_usage_error() {
    let out = run(&["--self-test", "install-tool"], Some("1"));
    assert_eq!(out.status.code(), Some(2));
    let line: serde_json::Value = serde_json::from_slice(&out.stdout).expect("one JSON line");
    assert_eq!(line["ok"], false);
    assert_eq!(line["failure"]["step"], "arguments");
}
