//! The skipped tests that read the owner's real store and accounts, or change this computer, run only when the owner
//! names what they may touch: `cargo test -- --include-ignored` alone must not read an account or toggle Funnel.

const VAR: &str = "WIRECAT_PROBES";

/// Whether the owner allowed probes for this run; a probe returns at once without it.
pub fn allowed() -> bool {
    std::env::var(VAR).is_ok_and(|v| !v.trim().is_empty())
}

/// The accounts the owner named, as `tool:profile` (or a bare `tool` for one without profiles), comma-separated.
pub fn accounts() -> Vec<(String, Option<String>)> {
    std::env::var(VAR)
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "1")
        .map(|s| match s.split_once(':') {
            Some((tool, profile)) => (tool.to_string(), Some(profile.to_string())),
            None => (s.to_string(), None),
        })
        .collect()
}
