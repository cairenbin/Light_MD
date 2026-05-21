// Watches open document paths for external modifications.
// Delete/rename are intentionally not surfaced (see plan #17).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::RecommendedWatcher;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

const SELF_WRITE_SUPPRESSION: Duration = Duration::from_secs(1);
const DEBOUNCE_INTERVAL: Duration = Duration::from_millis(250);

pub struct WatcherState {
    debouncer: Mutex<Option<Debouncer<RecommendedWatcher>>>,
    self_writes: Arc<Mutex<HashMap<PathBuf, Instant>>>,
    watched: Arc<Mutex<HashSet<PathBuf>>>,
}

#[derive(Serialize, Clone)]
struct ExternalFileChangedPayload {
    path: String,
}

pub fn init<R: Runtime>(app: AppHandle<R>) -> Arc<WatcherState> {
    let self_writes: Arc<Mutex<HashMap<PathBuf, Instant>>> = Arc::new(Mutex::new(HashMap::new()));
    let watched: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));

    let callback_self_writes = Arc::clone(&self_writes);
    let callback_watched = Arc::clone(&watched);
    let callback_app = app.clone();

    let debouncer = new_debouncer(
        DEBOUNCE_INTERVAL,
        move |result: DebounceEventResult| {
            let events = match result {
                Ok(events) => events,
                Err(errors) => {
                    eprintln!("file watcher error: {errors:?}");
                    return;
                }
            };

            let now = Instant::now();
            let mut to_emit: HashSet<PathBuf> = HashSet::new();

            let watched_set = match callback_watched.lock() {
                Ok(set) => set.clone(),
                Err(error) => {
                    eprintln!("watcher.watched lock poisoned: {error}");
                    return;
                }
            };

            {
                let mut self_writes_map = match callback_self_writes.lock() {
                    Ok(map) => map,
                    Err(error) => {
                        eprintln!("watcher.self_writes lock poisoned: {error}");
                        return;
                    }
                };

                self_writes_map.retain(|_, instant| now.duration_since(*instant) < SELF_WRITE_SUPPRESSION);

                for event in events {
                    let canonical = match std::fs::canonicalize(&event.path) {
                        Ok(path) => path,
                        Err(_) => event.path.clone(),
                    };

                    if !watched_set.contains(&canonical) {
                        continue;
                    }

                    if let Some(last_write) = self_writes_map.get(&canonical) {
                        if now.duration_since(*last_write) < SELF_WRITE_SUPPRESSION {
                            continue;
                        }
                    }

                    to_emit.insert(canonical);
                }
            }

            if to_emit.is_empty() {
                return;
            }

            for path in &to_emit {
                let payload = ExternalFileChangedPayload {
                    path: path.to_string_lossy().into_owned(),
                };
                if let Err(error) = callback_app.emit("external-file-changed", payload) {
                    eprintln!("failed to emit external-file-changed: {error}");
                }
            }
        },
    );

    let debouncer = match debouncer {
        Ok(debouncer) => Some(debouncer),
        Err(error) => {
            eprintln!("failed to create file watcher: {error}");
            None
        }
    };

    Arc::new(WatcherState {
        debouncer: Mutex::new(debouncer),
        self_writes,
        watched,
    })
}

pub fn watch(state: &WatcherState, path: &Path) -> Result<(), String> {
    let canonical = std::fs::canonicalize(path).map_err(|error| error.to_string())?;

    let mut guard = state.debouncer.lock().map_err(|error| error.to_string())?;
    let debouncer = guard.as_mut().ok_or_else(|| "watcher unavailable".to_string())?;

    let mut watched = state.watched.lock().map_err(|error| error.to_string())?;
    if watched.contains(&canonical) {
        return Ok(());
    }

    debouncer
        .watcher()
        .watch(&canonical, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    watched.insert(canonical);
    Ok(())
}

pub fn unwatch(state: &WatcherState, path: &Path) -> Result<(), String> {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

    let mut guard = state.debouncer.lock().map_err(|error| error.to_string())?;
    let debouncer = guard.as_mut().ok_or_else(|| "watcher unavailable".to_string())?;

    let mut watched = state.watched.lock().map_err(|error| error.to_string())?;
    if !watched.remove(&canonical) {
        return Ok(());
    }

    let _ = debouncer.watcher().unwatch(&canonical);
    Ok(())
}

pub fn note_self_write(state: &WatcherState, path: &Path) {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if let Ok(mut map) = state.self_writes.lock() {
        map.insert(canonical, Instant::now());
    }
}
