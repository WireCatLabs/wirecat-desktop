//! memo's command server: a few long-running `memo` processes that take a page's commands one line at a time, so a
//! page does not pay memo's start (about 0.6 s of loading Node modules) on every call. One server starts with the
//! app. A call that finds no server with room waits up to a second for one that is starting; past that, or for a memo
//! without the server, it starts its own process as before, so the worst case is about the old behaviour.
//!
//! Protocol (cli-core): the first stdout line is `{"ready":true,"protocol":1,"version":…}`; each request is
//! `{"id":n,"argv":[…]}` on stdin, each answer `{"id":n,"code":…,"stdout":…,"stderr":…}`, exactly what a started
//! process would have printed. A ready line with `"concurrent":n` runs up to n requests at once and answers each when
//! it ends, so answers come in any order; without it, one request at a time.

use crate::cache::Stamp;
use crate::run::{self, Output, RunError};
use std::collections::{HashMap, HashSet};
use std::ffi::{OsStr, OsString};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Stdio};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Condvar, LazyLock, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

/// How memo starts its command server; the one place to change when cli-core settles the name.
pub const SERVER_ARGV: [&str; 2] = ["commands", "--serve"];
const PROTOCOL: u64 = 1;
const NOT_IN_SERVER: &str = "start it as a process of its own";
const SERVERS: usize = 2;
const READY_WAIT: Duration = Duration::from_secs(10);
/// memo quits after 10 idle minutes; a request written as it quits would be lost, so it is retired first.
const IDLE_KEPT: Duration = Duration::from_mins(9);
/// An update outside the app may leave the program's file stamp as it was; the version cache in `tools.rs` is
/// asked again after the same time.
const SERVER_KEPT: Duration = Duration::from_mins(10);
/// A server gets ready in about 0.35 s; a call waits this long for one that is starting before it starts memo itself.
const STARTING_WAIT: Duration = Duration::from_secs(1);
/// A server that only failed to get ready in time may have met a busy moment, so it is tried again after this.
const SLOW_START_KEPT: Duration = Duration::from_mins(2);

static POOL: LazyLock<Pool> = LazyLock::new(|| Pool::new(&SERVER_ARGV, SERVERS, READY_WAIT));

/// One memo command through a server with room, waiting a moment for one that is starting, or its own process. The same `Output` and the same
/// errors a started process gives.
pub fn run(bin: &Path, args: &[&str], timeout: Duration) -> Result<Output, RunError> {
    POOL.run(bin, args, &crate::paths::search_path(), timeout)
}

/// Starts a server for `bin` in the background, unless one runs, is starting, or memo has none.
pub fn warm(bin: &Path) {
    POOL.warm(bin, &crate::paths::search_path());
}

/// A tool's command: memo's through a server, any other CLI's in a process of its own.
pub fn run_tool(tool: &crate::catalog::Tool, bin: &Path, args: &[&str], timeout: Duration) -> Result<Output, RunError> {
    if tool.id == "memo" {
        run(bin, args, timeout)
    } else {
        run::run(bin, args, Some(&crate::paths::search_path()), timeout)
    }
}

/// Ends every server: before memo is installed, updated or removed, before the store is reset or repaired, and when
/// the app exits. A server busy with requests ends when it gives the last one back.
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
    starting_wait: Duration,
    /// Rung when a server gets ready or fails to.
    changed: Condvar,
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
    live: Vec<Slot>,
    /// Started and not ready yet; they count toward the pool's size.
    starting: usize,
}

/// A server out of `live` takes no new request; the callers still on it hold it, and the last one's drop ends it.
struct Slot {
    server: Arc<Server>,
    busy: usize,
    idle_since: Instant,
}

struct Refusal {
    stamp: Stamp,
    until: Option<Instant>,
}

struct Server {
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    waiting: Arc<Mutex<Waiting>>,
    concurrent: usize,
    stamp: Stamp,
    search: OsString,
    generation: u64,
    born: Instant,
    next_id: AtomicU64,
    /// The commands running now, by their first two words. memo 0.131.76's server mixes up the options of two
    /// requests of one command at once (`people list kind:person` and `kind:organization` both answered the second),
    /// so a request waits for the one of its command before it; other commands still run side by side.
    running: Mutex<HashSet<String>>,
    finished: Condvar,
}

/// A command's place on a server, given back when the request ends, answered or not.
struct Lane<'a> {
    server: &'a Server,
    key: String,
}

impl Drop for Lane<'_> {
    fn drop(&mut self) {
        locked(&self.server.running).remove(&self.key);
        self.server.finished.notify_all();
    }
}

/// Who waits for which answer. The reader thread holds only this, never the server, so dropping the server ends it.
#[derive(Default)]
struct Waiting {
    by_id: HashMap<u64, Sender<Answer>>,
    closed: bool,
}

impl Drop for Server {
    fn drop(&mut self) {
        run::kill(self.child.get_mut().unwrap_or_else(PoisonError::into_inner));
    }
}

enum Checkout {
    Lent(Arc<Server>),
    Start,
    Spawn,
}

enum Asked {
    NotSent,
    Failed(RunError),
}

fn locked<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
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
            starting_wait: STARTING_WAIT,
            changed: Condvar::new(),
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
            Checkout::Lent(server) => server,
            Checkout::Start => {
                let started = self.start(bin, stamp, search, timeout.min(self.ready_wait));
                match self.started(bin, started, 1) {
                    Some(server) => server,
                    None => return spawn(),
                }
            }
        };
        let out = self.ask(bin, server, args, timeout).or_else(|asked| match asked {
            Asked::NotSent => spawn(),
            Asked::Failed(e) => Err(e),
        })?;
        // cli-core refuses in a server a command that never returns, waits on a person or reads stdin; a process of
        // its own runs it as before.
        if out.code != Some(0) && out.stderr.contains(NOT_IN_SERVER) {
            return spawn();
        }
        Ok(out)
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        locked(&self.state)
    }

    /// A call that finds a server starting waits for it rather than paying memo's start itself.
    fn checkout(&self, bin: &Path, stamp: &Stamp, search: &OsStr) -> Checkout {
        let deadline = Instant::now() + self.starting_wait;
        let mut retired: Vec<Slot> = Vec::new();
        let mut state = self.lock();
        let picked = loop {
            if self.paused.load(Ordering::Relaxed) > 0 {
                break Checkout::Spawn;
            }
            if let Some(r) = state.refused.get(bin) {
                if r.stamp == *stamp && r.until.is_none_or(|u| Instant::now() < u) {
                    break Checkout::Spawn;
                }
                state.refused.remove(bin);
            }
            let generation = self.generation.load(Ordering::Relaxed);
            let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
            let (kept, gone): (Vec<Slot>, Vec<Slot>) = std::mem::take(&mut servers.live)
                .into_iter()
                .partition(|slot| slot.usable(stamp, search, generation, self.max_age));
            servers.live = kept;
            retired.extend(gone);
            if let Some(slot) = servers.live.iter_mut().find(|slot| slot.busy < slot.server.concurrent) {
                slot.busy += 1;
                break Checkout::Lent(Arc::clone(&slot.server));
            }
            if servers.starting == 0 && servers.live.len() < self.size {
                servers.starting += 1;
                break Checkout::Start;
            }
            let left = deadline.saturating_duration_since(Instant::now());
            if servers.starting == 0 || left.is_zero() {
                break Checkout::Spawn;
            }
            state = self.changed.wait_timeout(state, left).unwrap_or_else(PoisonError::into_inner).0;
        };
        drop(state);
        drop(retired);
        picked
    }

    /// Starts a server in the background when `bin` has none, so the first page finds it ready.
    fn warm(&self, bin: &Path, search: &OsStr) {
        let Some(stamp) = Stamp::of(bin) else { return };
        {
            let mut state = self.lock();
            let refused = state.refused.get(bin).is_some_and(|r| r.stamp == stamp);
            let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
            if self.paused.load(Ordering::Relaxed) > 0 || refused || servers.starting > 0 || !servers.live.is_empty() {
                return;
            }
            servers.starting += 1;
        }
        let started = self.start(bin, stamp, search, self.ready_wait);
        self.started(bin, started, 0);
    }

    /// Puts a server that got ready into the pool, lent to `busy` requests; a refusal is remembered. Wakes the calls
    /// that wait for it either way.
    fn started(&self, bin: &Path, started: Result<Server, Option<Refusal>>, busy: usize) -> Option<Arc<Server>> {
        let mut state = self.lock();
        let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
        servers.starting = servers.starting.saturating_sub(1);
        let server = match started {
            Ok(server) => {
                let server = Arc::new(server);
                servers.live.push(Slot { server: Arc::clone(&server), busy, idle_since: Instant::now() });
                Some(server)
            }
            Err(refusal) => {
                if let Some(r) = refusal {
                    state.refused.insert(bin.to_path_buf(), r);
                }
                None
            }
        };
        self.changed.notify_all();
        server
    }

    /// Gives a request's place back. A server that failed a request takes no new one and ends when the others on it
    /// are answered.
    fn returned(&self, bin: &Path, server: &Arc<Server>, answered: bool) {
        let generation = self.generation.load(Ordering::Relaxed);
        let mut retired = None;
        {
            let mut state = self.lock();
            let servers = state.by_bin.entry(bin.to_path_buf()).or_default();
            if let Some(at) = servers.live.iter().position(|slot| Arc::ptr_eq(&slot.server, server)) {
                let slot = &mut servers.live[at];
                slot.busy = slot.busy.saturating_sub(1);
                slot.idle_since = Instant::now();
                // An update changes the program under a running server; it keeps the code it loaded.
                let current = slot.busy > 0
                    || (Stamp::of(bin).is_some_and(|now| now == server.stamp)
                        && server.generation == generation
                        && server.alive());
                if !answered || !current {
                    retired = Some(servers.live.remove(at));
                }
            }
        }
        self.changed.notify_all();
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
        let waiting = Arc::new(Mutex::new(Waiting::default()));
        let (ready_tx, ready) = mpsc::channel();
        let routed = Arc::clone(&waiting);
        thread::spawn(move || read_answers(stdout, &ready_tx, &routed));
        // Node's warnings go to stderr; an unread pipe would fill and stop the server.
        thread::spawn(move || std::io::copy(&mut stderr, &mut std::io::sink()));
        let mut server = Server {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            waiting,
            concurrent: 1,
            stamp: stamp.clone(),
            search: search.to_os_string(),
            generation: self.generation.load(Ordering::Relaxed),
            born: Instant::now(),
            next_id: AtomicU64::new(0),
            running: Mutex::new(HashSet::new()),
            finished: Condvar::new(),
        };
        let outcome = match ready.recv_timeout(wait.saturating_sub(started.elapsed())) {
            Ok(Ready::Speaks(concurrent)) => {
                server.concurrent = concurrent;
                return Ok(server);
            }
            // A memo without the server refuses the command and exits.
            Ok(Ready::Refused) | Err(RecvTimeoutError::Disconnected) => Refusal { stamp, until: None },
            Err(RecvTimeoutError::Timeout) => Refusal { stamp, until: Some(Instant::now() + SLOW_START_KEPT) },
        };
        crate::log::program(bin.as_os_str(), started, "server refused");
        drop(server);
        Err(Some(outcome))
    }

    fn ask(&self, bin: &Path, server: Arc<Server>, args: &[&str], timeout: Duration) -> Result<Output, Asked> {
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
        // A server that did not answer may still be working on the request, and so has one place less than it says.
        self.returned(bin, &server, result.is_ok());
        result
    }

    fn pause(&self) -> Paused<'_> {
        self.paused.fetch_add(1, Ordering::Relaxed);
        self.stop_all();
        Paused(self)
    }

    fn stop_all(&self) {
        self.generation.fetch_add(1, Ordering::Relaxed);
        let live: Vec<Slot> = {
            let mut state = self.lock();
            state.by_bin.values_mut().flat_map(|s| s.live.drain(..)).collect()
        };
        drop(live);
    }
}

impl Slot {
    fn usable(&self, stamp: &Stamp, search: &OsStr, generation: u64, max_age: Duration) -> bool {
        let s = &self.server;
        s.stamp == *stamp
            && s.search == search
            && s.generation == generation
            && (self.busy > 0 || self.idle_since.elapsed() < IDLE_KEPT)
            && s.born.elapsed() < max_age
            && s.alive()
    }
}

impl Server {
    fn alive(&self) -> bool {
        matches!(locked(&self.child).try_wait(), Ok(None))
    }

    /// Waits, within `timeout`, until no request of the same command runs on this server.
    fn lane(&self, args: &[&str], timeout: Duration) -> Option<Lane<'_>> {
        let key = args.iter().take(2).copied().collect::<Vec<_>>().join(" ");
        let deadline = Instant::now() + timeout;
        let mut running = locked(&self.running);
        while running.contains(&key) {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return None;
            }
            running = self.finished.wait_timeout(running, left).unwrap_or_else(PoisonError::into_inner).0;
        }
        running.insert(key.clone());
        Some(Lane { server: self, key })
    }

    fn request(&self, args: &[&str], timeout: Duration) -> Result<Output, Asked> {
        let started = Instant::now();
        let Some(_lane) = self.lane(args, timeout) else { return Err(Asked::Failed(RunError::TimedOut)) };
        let timeout = timeout.saturating_sub(started.elapsed());
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let words = serde_json::to_string(args).map_err(|e| Asked::Failed(RunError::Other(e.to_string())))?;
        let line = format!("{{\"id\":{id},\"argv\":{words}}}\n");
        let (tx, answered) = mpsc::channel();
        {
            let mut waiting = locked(&self.waiting);
            if waiting.closed {
                return Err(Asked::NotSent);
            }
            // Before the write: a quick answer would otherwise find nobody waiting and be skipped.
            waiting.by_id.insert(id, tx);
        }
        let sent = {
            let mut stdin = locked(&self.stdin);
            stdin.write_all(line.as_bytes()).and_then(|()| stdin.flush())
        };
        if sent.is_err() {
            locked(&self.waiting).by_id.remove(&id);
            return Err(Asked::NotSent);
        }
        match answered.recv_timeout(timeout) {
            Ok(Answer::Ours(out)) => Ok(out),
            Ok(Answer::Unreadable) => Err(Asked::Failed(RunError::Other(
                "memo's command server answered in a form WireCat cannot read".into(),
            ))),
            Err(RecvTimeoutError::Timeout) => {
                locked(&self.waiting).by_id.remove(&id);
                Err(Asked::Failed(RunError::TimedOut))
            }
            Err(RecvTimeoutError::Disconnected) => {
                Err(Asked::Failed(RunError::Other("memo's command server stopped before it answered".into())))
            }
        }
    }
}

/// Sends what the ready line said once, then hands each answer to whoever waits for
/// its id. Lines nobody waits for (a note, a late answer to a request that timed out) are skipped.
fn read_answers(stdout: ChildStdout, ready: &Sender<Ready>, waiting: &Mutex<Waiting>) {
    let mut lines = BufReader::new(stdout).lines().map_while(Result::ok);
    for line in lines.by_ref() {
        if let Some(said) = ready_line(&line) {
            let _ = ready.send(said);
            break;
        }
    }
    for line in lines {
        if let Some((id, answer)) = answer(&line)
            && let Some(tx) = locked(waiting).by_id.remove(&id)
        {
            let _ = tx.send(answer);
        }
    }
    let mut waiting = locked(waiting);
    waiting.closed = true;
    waiting.by_id.clear();
}

#[derive(Debug, PartialEq)]
enum Ready {
    /// How many requests it runs at once; a server that does not say takes one at a time.
    Speaks(usize),
    /// Any other JSON: memo's refusal.
    Refused,
}

/// `None` for a line that is not JSON.
fn ready_line(line: &str) -> Option<Ready> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v["ready"] != true || v["protocol"].as_u64() != Some(PROTOCOL) {
        return Some(Ready::Refused);
    }
    let concurrent = v["concurrent"].as_u64().and_then(|n| usize::try_from(n).ok()).filter(|n| *n >= 1);
    Some(Ready::Speaks(concurrent.unwrap_or(1)))
}

enum Answer {
    Ours(Output),
    Unreadable,
}

/// The id a line answers and what it says; `None` for a line that answers no request.
fn answer(line: &str) -> Option<(u64, Answer)> {
    let v = serde_json::from_str::<serde_json::Value>(line).ok()?;
    let id = v["id"].as_u64()?;
    let code = match &v["code"] {
        serde_json::Value::Null => None,
        c => match c.as_i64().and_then(|c| i32::try_from(c).ok()) {
            Some(c) => Some(c),
            None => return Some((id, Answer::Unreadable)),
        },
    };
    let answer = match (v["stdout"].as_str(), v["stderr"].as_str()) {
        (Some(stdout), Some(stderr)) => Answer::Ours(Output { code, stdout: stdout.into(), stderr: stderr.into() }),
        _ => Answer::Unreadable,
    };
    Some((id, answer))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    const SPEAKS: &str = r#"
if [ "$1 $2" = "commands --serve" ]; then
  echo 'starting up'
  echo '{"ready":true,"protocol":1,"version":"9.9.9"}'
  while IFS= read -r line; do
    id=$(printf '%s' "$line" | sed 's/^{"id":\([0-9]*\),.*/\1/')
    case "$line" in
      *'"slow"'*) sleep 30 ;;
      *'"hold"'*) sleep 1 ;;
      *'"die"'*) exit 3 ;;
      *'"bad"'*) echo "{\"id\":$id,\"code\":0}"; continue ;;
      *'"waits"'*) echo "{\"id\":$id,\"code\":2,\"stdout\":\"\",\"stderr\":\"error: waits on a person; start it as a process of its own\"}"; continue ;;
      *'"stray"'*) echo 'a note'; echo '{"id":999,"code":0,"stdout":"","stderr":""}' ;;
    esac
    printf '{"id":%s,"code":0,"stdout":"{\\"via\\":\\"server\\",\\"pid\\":%s}\\n","stderr":"%s"}\n' "$id" "$$" "$WIRECAT_CALLER"
  done
  exit 0
fi
echo '{"via":"spawn"}'
"#;

    /// cli-core's server since #2812: each request runs in the background and is answered when it ends.
    const CONCURRENT: &str = r#"
if [ "$1 $2" = "commands --serve" ]; then
  echo '{"ready":true,"protocol":1,"version":"9.9.9","concurrent":8}'
  while IFS= read -r line; do
    (
      id=$(printf '%s' "$line" | sed 's/^{"id":\([0-9]*\),.*/\1/')
      case "$line" in
        *'"slow"'*) sleep 30 ;;
        *'"hold"'*) sleep 1 ;;
      esac
      printf '{"id":%s,"code":0,"stdout":"{\\"via\\":\\"server\\",\\"pid\\":%s}\\n","stderr":""}\n' "$id" "$$"
    ) &
  done
  wait
  exit 0
fi
echo '{"via":"spawn"}'
"#;

    const REFUSES: &str = r#"
if [ "$1 $2" = "commands --serve" ]; then echo "error: unknown command 'commands'" >&2; exit 1; fi
echo '{"via":"spawn"}'
"#;

    const NEVER_READY: &str = r#"
if [ "$1 $2" = "commands --serve" ]; then sleep 30; fi
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

    fn busy(pool: &Pool, fake: &Fake) -> usize {
        pool.lock().by_bin.get(&fake.0).map_or(0, |s| s.live.iter().map(|slot| slot.busy).sum())
    }

    fn wait_until_busy(pool: &Pool, fake: &Fake, n: usize) {
        let since = Instant::now();
        while busy(pool, fake) < n {
            assert!(since.elapsed() < Duration::from_secs(5), "the held call never took the server");
            thread::yield_now();
        }
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
    fn a_command_the_server_refuses_runs_in_a_process_of_its_own() {
        let fake = Fake::new("refused-here", SPEAKS);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        let out = call(&pool, &fake, "waits", Duration::from_secs(10)).unwrap();
        assert_eq!((out.code, via(&out)), (Some(0), ("spawn".into(), None)));
        assert_eq!(served_by(&pool, &fake), server);
    }

    #[test]
    fn a_server_that_does_not_say_concurrent_takes_one_request_at_a_time() {
        let fake = Fake::new("busy", SPEAKS);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        thread::scope(|s| {
            let held = s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap());
            wait_until_busy(&pool, &fake, 1);
            let own = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
            assert_eq!(via(&own), ("spawn".into(), None));
            assert_eq!(via(&held.join().unwrap()), ("server".into(), Some(server)));
        });
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_concurrent_server_answers_a_quick_request_while_a_slow_one_runs() {
        let fake = Fake::new("concurrent", CONCURRENT);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        thread::scope(|s| {
            let held = s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap());
            wait_until_busy(&pool, &fake, 1);
            assert_eq!(served_by(&pool, &fake), server);
            assert!(!held.is_finished(), "the quick request waited for the slow one");
            assert_eq!(via(&held.join().unwrap()), ("server".into(), Some(server)));
        });
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn two_requests_of_one_command_take_turns_on_a_concurrent_server() {
        let fake = Fake::new("same-command", CONCURRENT);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        let started = Instant::now();
        thread::scope(|s| {
            let asked = [
                s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap()),
                s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap()),
            ];
            for h in asked {
                assert_eq!(via(&h.join().unwrap()), ("server".into(), Some(server)));
            }
        });
        assert!(started.elapsed() >= Duration::from_secs(2), "the two ran at once and memo would mix their options");
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_timeout_on_a_concurrent_server_leaves_the_other_requests_on_it_running() {
        let fake = Fake::new("concurrent-timeout", CONCURRENT);
        let pool = pool(1, Duration::from_secs(10));
        let server = served_by(&pool, &fake);
        thread::scope(|s| {
            let held = s.spawn(|| call(&pool, &fake, "hold", Duration::from_secs(10)).unwrap());
            wait_until_busy(&pool, &fake, 1);
            let slow = call(&pool, &fake, "slow", Duration::from_millis(300));
            assert!(matches!(slow, Err(RunError::TimedOut)), "{:?}", slow.map(|o| o.stdout));
            assert!(alive(server));
            assert_ne!(served_by(&pool, &fake), server, "a server that timed out took a new request");
            assert_eq!(via(&held.join().unwrap()), ("server".into(), Some(server)));
        });
        assert!(!alive(server));
        assert_eq!(starts(&pool), 2);
    }

    #[test]
    fn a_burst_while_the_server_starts_waits_for_it_and_goes_through_it() {
        let fake = Fake::new("burst", &CONCURRENT.replacen("then\n", "then\n  sleep 0.3\n", 1));
        let pool = pool(2, Duration::from_secs(10));
        let answers: Vec<_> = thread::scope(|s| {
            let calls: Vec<_> =
                (0..7).map(|_| s.spawn(|| call(&pool, &fake, "list", Duration::from_secs(10)).unwrap())).collect();
            calls.into_iter().map(|c| via(&c.join().unwrap())).collect()
        });
        let pid = answers[0].1;
        assert!(pid.is_some() && answers.iter().all(|a| *a == ("server".into(), pid)), "{answers:?}");
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_call_waits_a_moment_for_a_starting_server_then_starts_its_own_process() {
        let fake = Fake::new("slow-start", NEVER_READY);
        let mut pool = pool(2, Duration::from_secs(10));
        pool.starting_wait = Duration::from_millis(300);
        thread::scope(|s| {
            let starter = s.spawn(|| call(&pool, &fake, "list", Duration::from_secs(2)).unwrap());
            let since = Instant::now();
            while pool.lock().by_bin.get(&fake.0).is_none_or(|s| s.starting != 1) {
                assert!(since.elapsed() < Duration::from_secs(5), "the server never started");
                thread::yield_now();
            }
            let asked = Instant::now();
            let own = call(&pool, &fake, "list", Duration::from_secs(10)).unwrap();
            assert_eq!(via(&own), ("spawn".into(), None));
            assert!((Duration::from_millis(300)..Duration::from_secs(2)).contains(&asked.elapsed()));
            assert_eq!(via(&starter.join().unwrap()), ("spawn".into(), None));
        });
        assert_eq!(starts(&pool), 1);
    }

    #[test]
    fn a_warmed_server_answers_the_first_call() {
        let fake = Fake::new("warm", SPEAKS);
        let pool = pool(2, Duration::from_secs(10));
        let search = std::env::var_os("PATH").unwrap_or_default();
        pool.warm(&fake.0, &search);
        pool.warm(&fake.0, &search);
        assert_eq!(busy(&pool, &fake), 0);
        served_by(&pool, &fake);
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
        let Some((3, Answer::Ours(out))) = answer(r#"{"id":3,"code":6,"stdout":"","stderr":"{\"error\":{}}"}"#) else {
            panic!("not read")
        };
        assert_eq!((out.code, out.stderr.as_str()), (Some(6), "{\"error\":{}}"));
        assert!(answer("a note").is_none());
        assert!(matches!(answer(r#"{"id":3,"code":"0","stdout":"","stderr":""}"#), Some((3, Answer::Unreadable))));
        assert_eq!(ready_line(r#"{"ready":true,"protocol":2}"#), Some(Ready::Refused));
        assert_eq!(ready_line(r#"{"ready":true,"protocol":1}"#), Some(Ready::Speaks(1)));
        assert_eq!(ready_line(r#"{"ready":true,"protocol":1,"concurrent":8}"#), Some(Ready::Speaks(8)));
        assert_eq!(ready_line(r#"{"ready":true,"protocol":1,"concurrent":0}"#), Some(Ready::Speaks(1)));
        assert_eq!(ready_line("loading"), None);
    }
}
