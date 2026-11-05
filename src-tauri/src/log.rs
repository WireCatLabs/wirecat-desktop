use crate::error::AppError;
use crate::redact;
use std::io::{self, Write};
use std::path::Path;
use std::time::Instant;
use tracing::Instrument;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::Layer;
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

const KEEP_FILES: usize = 7;

/// One file a day in `dir`, the last week kept. Only this crate's events: the HTTP and TLS crates log request
/// details of their own.
pub fn init(dir: &Path) -> Result<(), String> {
    let appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("wirecat")
        .filename_suffix("log")
        .max_log_files(KEEP_FILES)
        .build(dir)
        .map_err(|e| e.to_string())?;
    tracing_subscriber::registry()
        .with(
            layer(Masked(appender))
                .with_filter(Targets::new().with_target(env!("CARGO_CRATE_NAME"), LevelFilter::INFO)),
        )
        .try_init()
        .map_err(|e| e.to_string())
}

fn layer<S, W>(writer: W) -> impl Layer<S>
where
    S: tracing::Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
    W: for<'w> MakeWriter<'w> + Send + Sync + 'static,
{
    tracing_subscriber::fmt::layer().with_writer(writer).with_ansi(false).with_target(false)
}

/// What a command's result says in the log: `ok` or the error's kind, never its message.
pub trait Outcome {
    fn kind(&self) -> &'static str;
}

impl Outcome for () {
    fn kind(&self) -> &'static str {
        "ok"
    }
}

impl<T> Outcome for Result<T, AppError> {
    fn kind(&self) -> &'static str {
        self.as_ref().err().map_or("ok", AppError::kind)
    }
}

impl<T> Outcome for Result<T, crate::package_update::Failure> {
    fn kind(&self) -> &'static str {
        if self.is_ok() { "ok" } else { "failed" }
    }
}

/// Runs one command inside a span named after it, so the programs it starts are logged under it.
pub async fn command<R: Outcome>(name: &'static str, run: impl Future<Output = R>) -> R {
    let started = Instant::now();
    let result = run.instrument(tracing::info_span!("command", name)).await;
    finished(name, started, &result);
    result
}

/// `command`, for a command that answers at once.
pub fn command_now<R: Outcome>(name: &'static str, run: impl FnOnce() -> R) -> R {
    let started = Instant::now();
    let result = tracing::info_span!("command", name).in_scope(run);
    finished(name, started, &result);
    result
}

fn finished(name: &str, started: Instant, result: &impl Outcome) {
    tracing::info!(command = name, ms = millis(started), kind = result.kind());
}

/// The file name only: the arguments and the full path can hold profile names, chat names and the home folder.
pub fn program(program: &std::ffi::OsStr, started: Instant, outcome: &str) {
    let name = Path::new(program).file_name().unwrap_or_default().to_string_lossy();
    tracing::info!(program = %name, ms = millis(started), outcome);
}

fn millis(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// Every line passes through `redact::text` on its way to the file, so a field nobody thought to mask is masked
/// anyway (rule 4).
struct Masked<M>(M);

struct MaskedWriter<W>(W);

impl<'a, M: MakeWriter<'a>> MakeWriter<'a> for Masked<M> {
    type Writer = MaskedWriter<M::Writer>;

    fn make_writer(&'a self) -> Self::Writer {
        MaskedWriter(self.0.make_writer())
    }
}

impl<W: Write> Write for MaskedWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.0.write_all(redact::text(&String::from_utf8_lossy(buf)).as_bytes())?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.0.flush()
    }
}

#[cfg(test)]
mod tests {
    use super::{Masked, layer};
    use crate::error::AppError;
    use std::io;
    use std::sync::{Arc, Mutex};
    use tracing_subscriber::fmt::MakeWriter;
    use tracing_subscriber::layer::SubscriberExt;

    #[derive(Clone, Default)]
    struct Lines(Arc<Mutex<Vec<u8>>>);

    impl io::Write for Lines {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    impl MakeWriter<'_> for Lines {
        type Writer = Lines;

        fn make_writer(&self) -> Self::Writer {
            self.clone()
        }
    }

    fn logged(f: impl FnOnce()) -> String {
        let lines = Lines::default();
        let subscriber = tracing_subscriber::registry().with(layer(Masked(lines.clone())));
        tracing::subscriber::with_default(subscriber, f);
        String::from_utf8(lines.0.lock().unwrap().clone()).unwrap()
    }

    #[test]
    fn a_logged_line_is_masked() {
        let text = logged(|| {
            tracing::info!(program = "/home/slava/.local/bin/tg", detail = "ann@example.com +34 600 123 456");
        });
        assert!(text.contains("[user]") && text.contains("[email]") && text.contains("[number]"), "{text}");
        for personal in ["slava", "ann@example.com", "600 123 456"] {
            assert!(!text.contains(personal), "{personal} reached the log: {text}");
        }
    }

    #[test]
    fn a_command_logs_its_name_duration_and_kind_and_its_program_under_it() {
        let text = logged(|| {
            let _ = super::command_now("list_profiles", || {
                super::program("/home/slava/bin/tg".as_ref(), std::time::Instant::now(), "exit:0");
                Err::<(), _>(AppError::UnknownTool("zz".into()))
            });
        });
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2, "{text}");
        assert!(lines[0].contains("command{name=\"list_profiles\"}") && lines[0].contains("program=tg"), "{text}");
        assert!(lines[0].contains("outcome=\"exit:0\"") && lines[0].contains("ms="), "{text}");
        assert!(lines[1].contains("command=\"list_profiles\"") && lines[1].contains("kind=\"unknown_tool\""), "{text}");
        assert!(!text.contains("slava"), "{text}");
    }
}
