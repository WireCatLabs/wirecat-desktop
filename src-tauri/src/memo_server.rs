//! memo's command server: a few long-running `memo` processes that take a page's commands one line at a time, so a
//! page does not pay memo's start (about 0.6 s of loading Node modules) on every call. A call that finds no idle
//! server, or a memo without the server, starts its own process as before, so the worst case is the old behaviour.
//!
//! Protocol (cli-core): the first stdout line is `{"ready":true,"protocol":1,"version":…}`; each request is
//! `{"id":n,"argv":[…]}` on stdin, each answer `{"id":n,"code":…,"stdout":…,"stderr":…}`, exactly what a started
//! process would have printed. One request at a time per server.

use crate::cache::Stamp;
use crate::run::{self, Output, RunError};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{LazyLock, Mutex, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

/// How memo starts its command server; the one place to change when cli-core settles the name.
pub const SERVER_ARGV: [&str; 2] = ["commands", "serve"];
const PROTOCOL: u64 = 1;
const SERVERS: usize = 2;
const READY_WAIT: Duration = Duration::from_secs(10);
/// memo quits after 10 idle minutes; a request written as it quits would be lost, so it is retired first.
const IDLE_KEPT: Duration = Duration::from_mins(9);
/// An update outside the app may leave the program's file stamp as it was; the version cache in `tools.rs` is
/// asked again after the same time.
const SERVER_KEPT: Duration = Duration::from_mins(10);
/// A server that only failed to get ready in time may have met a busy moment, so it is tried again after this.
const SLOW_START_KEPT: Duration = Duration::from_mins(2);

static POOL: LazyLock<Pool> = LazyLock::new(|| Pool::new(&SERVER_ARGV, SERVERS, READY_WAIT));

/// One memo command through an idle server, or its own process when none is free. The same `Output` and the same
/// errors a started process gives.
pub fn run(bin: &Path, args: &[&str], timeout: Duration) -> Result<Output, RunError> {
    POOL.run(bin, args, &crate::paths::search_path(), timeout)
}

/// Ends every server: before memo is installed, updated or removed, before the store is reset or repaired, and when
/// the app exits. A server busy with a request ends when it gives it back.
pub fn stop_all() {
    POOL.stop_all();
}

/// Ends every server and starts none until the guard is dropped: an install replaces memo's files, and a reset or a
/// repair needs the store free, so calls meanwhile start their own processes.
pub fn pause() -> Paused<'static> {
    POOL.pause()
}

pub struct Paused<'a>(&'a Pool);

impl Drop for Paused<'_> {
    fn drop(&mut self) {
        self.0.paused.fetch_sub(1, Ordering::Relaxed);
    }
}

/// Commands the servers answered since launch; `page_loads` prints them beside the processes started.
#[cfg(test)]
pub fn served() -> usize {
    POOL.served.load(Ordering::Relaxed)
}

pub struct Pool {
    argv: &'static [&'static str],
    size: usize,
    ready_wait: Duration,
    state: Mutex<State>,
    generation: AtomicU64,
    paused: AtomicUsize,
    max_age: Duration,
    served: AtomicUsize,
    #[cfg(test)]
    starts: AtomicUsize,
}

#[derive(Default)]
struct State {
    by_bin: HashMap<PathBuf, Servers>,
    refused: HashMap<PathBuf, Refusal>,
}

#[derive(Default)]
struct Servers {
    idle: Vec<Server>,
    /// Lent out or still starting; both count toward the pool's size.
    out: usize,
}

struct Refusal {
    stamp: Stamp,
    until: Option<Instant>,
}

struct Server {
    child: Child,
    stdin: ChildStdin,
    lines: Receiver<String>,
    stamp: Stamp,
    search: OsString,
    generation: u64,
    idle_since: Instant,
    born: Instant,
    next_id: u64,
}

impl Drop for Server {
    fn drop(&mut self) {
        run::kill(&mut self.child);
    }
}

enum Checkout {
    Idle(Box<Server>),
    Start,
    Spawn,
}

enum Asked {
    NotSent,
    Failed(RunError),
}

impl Pool {
    pub fn new(argv: &'static [&'static str], size: usize, ready_wait: Duration) -> Pool {
        Pool {
            argv,
            size,
            ready_wait,
            state: Mutex::new(State::default()),
            generation: AtomicU64::new(0),
            paused: AtomicUsize::new(0),
            max_age: SERVER_KEPT,
            served: AtomicUsize::new(0),
            #[cfg(test)]
            starts: AtomicUsize::new(0),
        }
    }

    pub fn run(&self, bin: &Path, args: &[&str], search: &OsStr, timeout: Duration) -> Result<Output, RunError> {
        let spawn = || run::run(bin, args, Some(search), timeout);
        let Some(stamp) = Stamp::of(bin) else { return spawn() };
        let server = match self.checkout(bin, &stamp, search) {
            Checkout::Spawn => return spawn(),
            Checkout::Idle(server) => server,
            Checkout::Start => match self.start(bin, stamp, search, timeout.min(self.ready_wait)) {
                Ok(server) => Box::new(server),
                Err(refusal) => {
                    self.returned(bin, None, refusal);
                    return spawn();
                }
            },
        };
        self.ask(bin, server, args, timeout).or_else(|asked| match asked {
            Asked::NotSent => spawn(),
            Asked::Failed(e) => Err(e),
        })
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn checkout(&self, bin: &Path, stamp: &Stamp, search: &OsStr) -> Checkout {
        if self.paused.load(Ordering::Relaxed) > 0 {
            return Checkout::Spawn;
        }
        let generation = self.generation.load(Ordering::Relaxed);
        let mut retired = Vec::new();
        let picked = {
            let mut state = self.lock();
            if let Some(r) = state.refused.get(bin) {
                if r.stamp == *stamp && r.until.is_none_or(|u| Instant::now() < u) {
                    return Checkout::Spawn;
                }
                state.refused.remove(bin);
            }
            let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
            let mut picked = None;
            while let Some(mut s) = servers.idle.pop() {
                if s.usable(stamp, search, generation, self.max_age) {
                    picked = Some(Checkout::Idle(Box::new(s)));
                    break;
                }
                retired.push(s);
            }
            let picked = picked.unwrap_or(if servers.out + servers.idle.len() < self.size {
                Checkout::Start
            } else {
                Checkout::Spawn
            });
            if !matches!(picked, Checkout::Spawn) {
                servers.out += 1;
            }
            picked
        };
        drop(retired);
        picked
    }

    /// Hands a server back, or only its place in the pool when it is gone; a refusal is remembered for `bin`.
    fn returned(&self, bin: &Path, server: Option<Box<Server>>, refusal: Option<Refusal>) {
        let generation = self.generation.load(Ordering::Relaxed);
        let mut retired = None;
        {
            let mut state = self.lock();
            if let Some(r) = refusal {
                state.refused.insert(bin.to_path_buf(), r);
            }
            let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
            servers.out = servers.out.saturating_sub(1);
            if let Some(mut s) = server {
                // An update changes the program under a running server; it keeps the code it loaded.
                let current = Stamp::of(bin).is_some_and(|now| now == s.stamp);
                if current && s.generation == generation && matches!(s.child.try_wait(), Ok(None)) {
                    s.idle_since = Instant::now();
                    servers.idle.push(*s);
                } else {
                    retired = Some(s);
                }
            }
        }
        drop(retired);
    }

    fn start(&self, bin: &Path, stamp: Stamp, search: &OsStr, wait: Duration) -> Result<Server, Option<Refusal>> {
        #[cfg(test)]
        self.starts.fetch_add(1, Ordering::Relaxed);
        let started = Instant::now();
        let mut cmd = run::command(bin, self.argv, Some(search));
        cmd.stdin(Stdio::piped());
        // A program that cannot start says so again, with its own error, when the call starts it.
        let mut child = run::spawn_counted(cmd).map_err(|_| None)?;
        let (stdin, stdout, mut stderr) =
            (child.stdin.take().unwrap(), child.stdout.take().unwrap(), child.stderr.take().unwrap());
        let (tx, lines) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        // Node's warnings go to stderr; an unread pipe would fill and stop the server.
        thread::spawn(move || std::io::copy(&mut stderr, &mut std::io::sink()));
        let server = Server {
            child,
            stdin,
            lines,
            stamp: stamp.clone(),
            search: search.to_os_string(),
            generation: self.generation.load(Ordering::Relaxed),
            idle_since: Instant::now(),
            born: Instant::now(),
            next_id: 0,
        };
        let deadline = started + wait;
        let ready = loop {
            match server.lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(line) => {
                    if let Some(ok) = ready_line(&line) {
                        break Ok(ok);
                    }
                }
                Err(RecvTimeoutError::Timeout) => break Err(Some(Instant::now() + SLOW_START_KEPT)),
                // A memo without the server refuses the command and exits.
                Err(RecvTimeoutError::Disconnected) => break Err(None),
            }
        };
        let outcome = match ready {
            Ok(true) => return Ok(server),
            Ok(false) | Err(None) => Refusal { stamp, until: None },
            Err(Some(until)) => Refusal { stamp, until: Some(until) },
        };
        crate::log::program(bin.as_os_str(), started, "server refused");
        drop(server);
        Err(Some(outcome))
    }

    fn ask(&self, bin: &Path, mut server: Box<Server>, args: &[&str], timeout: Duration) -> Result<Output, Asked> {
        let started = Instant::now();
        let result = server.request(args, timeout);
        let name = bin.file_name().unwrap_or_default().to_string_lossy();
        match &result {
            Ok(out) => {
                self.served.fetch_add(1, Ordering::Relaxed);
                run::record(bin.as_os_str(), &name, args.len(), started, Ok(out.code));
            }
            Err(Asked::Failed(e)) => run::record(bin.as_os_str(), &name, args.len(), started, Err(e)),
            Err(Asked::NotSent) => {}
        }
        // A server that did not answer may still be working on the request; it is ended, never asked again.
        self.returned(bin, result.is_ok().then_some(server), None);
        result
    }

    fn pause(&self) -> Paused<'_> {
        self.paused.fetch_add(1, Ordering::Relaxed);
        self.stop_all();
        Paused(self)
    }

    fn stop_all(&self) {
        self.generation.fetch_add(1, Ordering::Relaxed);
        let idle: Vec<Server> = {
            let mut state = self.lock();
            state.by_bin.values_mut().flat_map(|s| s.idle.drain(..)).collect()
        };
        drop(idle);
    }
}

impl Server {
    fn usable(&mut self, stamp: &Stamp, search: &OsStr, generation: u64, max_age: Duration) -> bool {
        self.stamp == *stamp
            && self.search == search
            && self.generation == generation
            && self.idle_since.elapsed() < IDLE_KEPT
            && self.born.elapsed() < max_age
            && matches!(self.child.try_wait(), Ok(None))
    }

    fn request(&mut self, args: &[&str], timeout: Duration) -> Result<Output, Asked> {
        self.next_id += 1;
        let id = self.next_id;
        let words = serde_json::to_string(args).map_err(|e| Asked::Failed(RunError::Other(e.to_string())))?;
        let line = format!("{{\"id\":{id},\"argv\":{words}}}\n");
        if self.stdin.write_all(line.as_bytes()).and_then(|()| self.stdin.flush()).is_err() {
            return Err(Asked::NotSent);
        }
        let deadline = Instant::now() + timeout;
        loop {
            match self.lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(line) => match answer(&line, id) {
                    Answer::Other => {}
                    Answer::Ours(out) => return Ok(out),
                    Answer::Unreadable => {
                        return Err(Asked::Failed(RunError::Other(
                            "memo's command server answered in a form WireCat cannot read".into(),
                        )));
                    }
                },
                Err(RecvTimeoutError::Timeout) => return Err(Asked::Failed(RunError::TimedOut)),
                Err(RecvTimeoutError::Disconnected) => {
                    return Err(Asked::Failed(RunError::Other(
                        "memo's command server stopped before it answered".into(),
                    )));
                }
            }
        }
    }
}

/// `Some(true)` for a ready line this app speaks, `Some(false)` for any other JSON (memo's refusal), `None` for a line
/// that is not JSON.
fn ready_line(line: &str) -> Option<bool> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    Some(v["ready"] == true && v["protocol"].as_u64() == Some(PROTOCOL))
}

enum Answer {
    /// Not an answer to this request: a stray line.
    Other,
    Ours(Output),
    Unreadable,
}

fn answer(line: &str, id: u64) -> Answer {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { return Answer::Other };
    if v["id"].as_u64() != Some(id) {
        return Answer::Other;
    }
    let code = match &v["code"] {
        serde_json::Value::Null => None,
        c => match c.as_i64().and_then(|c| i32::try_from(c).ok()) {
            Some(c) => Some(c),
            None => return Answer::Unreadable,
        },
    };
    match (v["stdout"].as_str(), v["stderr"].as_str()) {
        (Some(stdout), Some(stderr)) => Answer::Ours(Output { code, stdout: stdout.into(), stderr: stderr.into() }),
        _ => Answer::Unreadable,
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    const SPEAKS: &str = r#"
if [ "$1 $2" = "commands serve" ]; then
  echo 'starting up'
  echo '{"ready":true,"protocol":1,"version":"9.9.9"}'
  while IFS= read -r line; do
    id=$(printf '%s' "$line" | sed 's/^{"id":\([0-9]*\),.*/\1/')
    case "$line" in
      *'"slow"'*) sleep 30 ;;
      *'"hold"'*) sleep 1 ;;
      *'"die"'*) exit 3 ;;
      *'"bad"'*) echo "{\"id\":$id,\"code\":0}"; continue ;;
      *'"stray"'*) echo 'a note'; echo '{"id":999,"code":0,"stdout":"","stderr":""}' ;;
    esac
    printf '{"id":%s,"code":0,"stdout":"{\\"via\\":\\"server\\",\\"pid\\":%s}\\n","stderr":"%s"}\n' "$id" "$$" "$WIRECAT_CALLER"
  done
  exit 0
fi
echo '{"via":"spawn"}'
"#;

    const REFUSES: &str = r#"
if [ "$1 $2" = "commands serve" ]; then echo "error: unknown command 'commands'" >&2; exit 1; fi
echo '{"via":"spawn"}'
"#;

    const NEVER_READY: &str = r#"
if [ "$1 $2" = "commands serve" ]; then sleep 30; fi
echo '{"via":"spawn"}'
"#;

    struct Fake(PathBuf);

    impl Fake {
        fn new(name: &str, body: &str) -> Fake {
            let dir = std::env::temp_dir().join(format!("wirecat-memo-server-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let fake = Fake(dir.join("memo"));
            fake.write(body);
            fake
        }

        fn write(&self, body: &str) {
            std::fs::write(&self.0, format!("#!/bin/sh\n{body}")).unwrap();
            std::fs::set_permissions(&self.0, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    impl Drop for Fake {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
        }
    }

    fn pool(size: usize, ready_wait: Duration) -> Pool {
        Pool::new(&SERVER_ARGV, size, ready_wait)
    }

    fn call(pool: &Pool, fake: &Fake, word: &str, timeout: Duration) -> Result<Output, RunError> {
        let search = std::env::var_os("PATH").unwrap_or_default();
        pool.run(&fake.0, &[word, "--json", "--no-record"], &search, timeout)
    }

    /// Who answered: the server (with its pid) or a process of its own.
    fn via(out: &Output) -> (String, Option<u64>) {
        let v = out.json().unwrap();
        (v["via"].as_str().unwrap().to_string(), v["pid"].as_u64())
    }

    fn served_by(pool: &Pool, fake: &Fake) -> u64 {
        let out = call(pool, fake, "list", Duration::from_secs(10)).unwrap();
        let (who, pid) = via(&out);
        assert_eq!(who, "server");
        pid.unwrap()
    }

    fn alive(pid: u64) -> bool {
        std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }

    fn starts(pool: &Pool) -> usize {
        pool.starts.load(Ordering::Relaxed)
    }

    #[test]
    fn answers_from_one_server_and_keeps_it_for_the_next_call() {
        let fake = Fake::new("reuse", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let out = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
        assert_eq!((out.code, out.stderr.as_str()), (Some(0), "desktop"));
        let first = via(&out).1.unwrap();
        assert_eq!(served_by(&pool, &fake), first);
        assert_eq!((starts(&pool), pool.served.load(Ordering::Relaxed)), (1, 2));
    }

    #[test]
    fn a_call_that_finds_every_server_busy_starts_its_own_process() {
        let fake = Fake::new("busy", SPEAKS);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        thread::scope(|s| {
            let held = s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap());
            let lent = Instant::now();
            while pool.lock().by_bin[&fake.0].out == 0 {
                assert!(lent.elapsed() < Duration::from_secs(5), "the held call never took the server");
                thread::yield_now();
            }
            let own = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
            assert_eq!(via(&own), ("spawn".into(), None));
            assert_eq!(via(&held.join().unwrap()), ("server".into(), Some(server)));
        });
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_timed_out_request_kills_its_server_and_the_next_call_starts_another() {
        let fake = Fake::new("timeout", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let first = served_by(&pool, &fake);
        let slow = call(&pool, &fake, "slow", Duration::from_millis(300));
        assert!(matches!(slow, Err(RunError::TimedOut)), "{:?}", slow.map(|o| o.stdout));
        assert!(!alive(first));
        assert_ne!(served_by(&pool, &fake), first);
        assert_eq!(starts(&pool), 2);
    }

    #[test]
    fn a_memo_without_the_server_is_asked_once_then_started_as_before() {
        let fake = Fake::new("refuses", REFUSES);
        let pool = pool(2, Duration::from_secs(10));
        for _ in 0..2 {
            let out = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
            assert_eq!(via(&out), ("spawn".into(), None));
        }
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_server_that_never_gets_ready_is_left_for_a_while() {
        let fake = Fake::new("never-ready", NEVER_READY);
        let pool = pool(2, Duration::from_millis(300));
        for _ in 0..2 {
            let out = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
            assert_eq!(via(&out), ("spawn".into(), None));
        }
        assert_eq!(starts(&pool), 1);
        assert!(pool.lock().refused[&fake.0].until.is_some());
    }

    #[test]
    fn a_new_version_of_memo_is_asked_again_after_a_refusal() {
        let fake = Fake::new("upgraded", REFUSES);
        let pool = pool(2, Duration::from_secs(10));
        call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
        fake.write(SPEAKS);
        served_by(&pool, &fake);
        assert_eq!(starts(&pool), 2);
    }

    #[test]
    fn stray_lines_are_skipped_and_an_unreadable_answer_ends_the_server() {
        let fake = Fake::new("malformed", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let out = call(&pool, &fake, "stray", Duration::from_secs(10)).unwrap();
        let (who, first) = via(&out);
        assert_eq!(who, "server");
        let bad = call(&pool, &fake, "bad", Duration::from_secs(10));
        assert!(matches!(bad, Err(RunError::Other(ref m)) if m.contains("cannot read")));
        assert!(!alive(first.unwrap()));
        assert_ne!(Some(served_by(&pool, &fake)), first);
    }

    #[test]
    fn a_server_that_dies_mid_request_is_not_asked_again() {
        let fake = Fake::new("dies", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let first = served_by(&pool, &fake);
        let died = call(&pool, &fake, "die", Duration::from_secs(10));
        assert!(matches!(died, Err(RunError::Other(ref m)) if m.contains("stopped")));
        assert_ne!(served_by(&pool, &fake), first);
        assert_eq!(starts(&pool), 2);
    }

    #[test]
    fn an_update_of_memo_retires_the_server_that_runs_the_old_one() {
        let fake = Fake::new("update", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let old = served_by(&pool, &fake);
        fake.write(&format!("# 9.9.10\n{SPEAKS}"));
        assert_ne!(served_by(&pool, &fake), old);
        assert!(!alive(old));
    }

    #[test]
    fn a_server_past_its_age_is_retired_even_when_memo_looks_unchanged() {
        let fake = Fake::new("age", SPEAKS);
        let mut pool = pool(2, Duration::from_secs(10));
        pool.max_age = Duration::ZERO;
        let old = served_by(&pool, &fake);
        assert_ne!(served_by(&pool, &fake), old);
        assert!(!alive(old));
    }

    #[test]
    fn a_paused_pool_ends_its_servers_and_starts_none_until_resumed() {
        let fake = Fake::new("pause", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let old = served_by(&pool, &fake);
        let paused = pool.pause();
        assert!(!alive(old));
        let own = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
        assert_eq!(via(&own), ("spawn".into(), None));
        drop(paused);
        served_by(&pool, &fake);
        assert_eq!(starts(&pool), 2);
    }

    #[test]
    fn stop_all_ends_the_idle_servers() {
        let fake = Fake::new("stop", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let old = served_by(&pool, &fake);
        pool.stop_all();
        assert!(!alive(old));
        assert_ne!(served_by(&pool, &fake), old);
    }

    #[test]
    fn reads_an_answer_as_the_process_would_have_printed_it() {
        let Answer::Ours(out) = answer(r#"{"id":3,"code":6,"stdout":"","stderr":"{\"error\":{}}"}"#, 3) else {
            panic!("not read")
        };
        assert_eq!((out.code, out.stderr.as_str()), (Some(6), "{\"error\":{}}"));
        assert!(matches!(answer(r#"{"id":2,"code":0,"stdout":"","stderr":""}"#, 3), Answer::Other));
        assert!(matches!(answer(r#"{"id":3,"code":"0","stdout":"","stderr":""}"#, 3), Answer::Unreadable));
        assert_eq!(ready_line(r#"{"ready":true,"protocol":2}"#), Some(false));
        assert_eq!(ready_line("loading"), None);
    }
}
