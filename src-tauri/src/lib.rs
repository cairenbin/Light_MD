mod watcher;

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, State};
use tauri_plugin_log::{Builder as LogBuilder, RotationStrategy, Target, TargetKind};
use watcher::WatcherState;

const ALLOWED_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];

fn has_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lowered = ext.to_ascii_lowercase();
            ALLOWED_EXTENSIONS.iter().any(|allowed| *allowed == lowered)
        })
        .unwrap_or(false)
}

fn validate_path_for_read(path: &Path) -> Result<(), String> {
    if !has_allowed_extension(path) {
        return Err("Unsupported file type".to_string());
    }
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinks are not allowed".to_string());
    }
    if !metadata.is_file() {
        return Err("Not a regular file".to_string());
    }
    Ok(())
}

fn validate_path_for_write(path: &Path) -> Result<(), String> {
    if !has_allowed_extension(path) {
        return Err("Unsupported file type".to_string());
    }
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() {
            return Err("Symlinks are not allowed".to_string());
        }
        if !metadata.is_file() {
            return Err("Not a regular file".to_string());
        }
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkdownFile {
    path: String,
    name: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedMarkdownFile {
    path: String,
    name: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            LogBuilder::default()
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("error".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                ])
                .level(log::LevelFilter::Warn)
                .max_file_size(1_000_000)
                .rotation_strategy(RotationStrategy::KeepOne)
                .build(),
        )
        .setup(|app| {
            let watcher_state = watcher::init(app.handle().clone());
            app.manage(watcher_state);
            Ok(())
        })
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            let menu_id = event.id().as_ref();

            if matches!(
                menu_id,
                "file.new"
                    | "file.open"
                    | "file.open_recent.1"
                    | "file.open_recent.2"
                    | "file.open_recent.3"
                    | "file.open_recent.4"
                    | "file.open_recent.5"
                    | "file.open_recent.6"
                    | "file.open_recent.7"
                    | "file.open_recent.8"
                    | "file.open_recent.9"
                    | "file.open_recent.10"
                    | "file.save"
                    | "file.save_as"
                    | "file.close"
                    | "edit.find"
                    | "edit.replace"
                    | "format.bold"
                    | "format.italic"
                    | "format.link"
                    | "format.code"
                    | "format.quote"
                    | "view.write"
                    | "view.split"
                    | "view.preview"
                    | "view.zoom_in"
                    | "view.zoom_out"
                    | "view.actual_size"
                    | "view.toggle_sidebar"
                    | "view.toggle_theme"
            ) {
                let _ = app.emit("app-menu-action", menu_id.to_string());
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_markdown_file,
            open_markdown_file_from_path,
            update_recent_menu,
            save_markdown_file,
            watch_file,
            unwatch_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let about_metadata = AboutMetadata {
        name: Some("Light Markdown Editor".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        comments: Some(env!("CARGO_PKG_DESCRIPTION").into()),
        license: Some(env!("CARGO_PKG_LICENSE").into()),
        ..Default::default()
    };

    let new_file = MenuItem::with_id(app, "file.new", "New", true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(app, "file.open", "Open...", true, Some("CmdOrCtrl+O"))?;
    let save_file = MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_as_file = MenuItem::with_id(
        app,
        "file.save_as",
        "Save As...",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let close_file =
        MenuItem::with_id(app, "file.close", "Close Document", true, Some("CmdOrCtrl+W"))?;
    let find = MenuItem::with_id(app, "edit.find", "Find", true, Some("CmdOrCtrl+F"))?;
    let replace = MenuItem::with_id(app, "edit.replace", "Replace", true, Some("CmdOrCtrl+H"))?;

    let format_bold = MenuItem::with_id(app, "format.bold", "Bold", true, Some("CmdOrCtrl+B"))?;
    let format_italic = MenuItem::with_id(app, "format.italic", "Italic", true, Some("CmdOrCtrl+I"))?;
    let format_link =
        MenuItem::with_id(app, "format.link", "Link", true, Some("CmdOrCtrl+Shift+K"))?;
    let format_code = MenuItem::with_id(app, "format.code", "Code", true, Some("CmdOrCtrl+E"))?;
    let format_quote =
        MenuItem::with_id(app, "format.quote", "Blockquote", true, Some("CmdOrCtrl+Shift+."))?;

    let write_mode = MenuItem::with_id(app, "view.write", "Write Mode", true, Some("Alt+1"))?;
    let split_mode = MenuItem::with_id(app, "view.split", "Split Mode", true, Some("Alt+2"))?;
    let read_mode = MenuItem::with_id(app, "view.preview", "Read Mode", true, Some("Alt+3"))?;
    let zoom_in = MenuItem::with_id(app, "view.zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?;
    let zoom_out =
        MenuItem::with_id(app, "view.zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
    let actual_size = MenuItem::with_id(
        app,
        "view.actual_size",
        "Actual Size",
        true,
        Some("CmdOrCtrl+0"),
    )?;
    let toggle_sidebar = MenuItem::with_id(
        app,
        "view.toggle_sidebar",
        "Toggle Documents Sidebar",
        true,
        Some("CmdOrCtrl+\\"),
    )?;
    let toggle_theme = MenuItem::with_id(
        app,
        "view.toggle_theme",
        "Toggle Theme",
        true,
        Some("CmdOrCtrl+Alt+T"),
    )?;

    let file_menu = Submenu::with_id_and_items(
        app,
        "file.menu",
        "File",
        true,
        &[
            &new_file,
            &open_file,
            &PredefinedMenuItem::separator(app)?,
            &Submenu::with_id_and_items(
                app,
                "file.open_recent",
                "Open Recent",
                true,
                &[],
            )?,
            &PredefinedMenuItem::separator(app)?,
            &save_file,
            &save_as_file,
            &PredefinedMenuItem::separator(app)?,
            &close_file,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &find,
            &replace,
        ],
    )?;

    let formatting_menu = Submenu::with_items(
        app,
        "Formatting",
        true,
        &[&format_bold, &format_italic, &format_link, &format_code, &format_quote],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &write_mode,
            &split_mode,
            &read_mode,
            &PredefinedMenuItem::separator(app)?,
            &zoom_in,
            &zoom_out,
            &actual_size,
            &PredefinedMenuItem::separator(app)?,
            &toggle_sidebar,
            &toggle_theme,
        ],
    )?;

    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[&PredefinedMenuItem::about(
            app,
            None,
            Some(about_metadata.clone()),
        )?],
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                app.package_info().name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about_metadata.clone()))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &file_menu,
            &edit_menu,
            &formatting_menu,
            &view_menu,
            &help_menu,
        ],
    )
}

#[tauri::command]
fn open_markdown_file() -> Result<Option<MarkdownFile>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .pick_file()
    else {
        return Ok(None);
    };

    read_markdown_file_from_path(path).map(Some)
}

#[tauri::command]
fn open_markdown_file_from_path(path: String) -> Result<Option<MarkdownFile>, String> {
    if path.trim().is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(path);

    if !path.exists() {
        return Ok(None);
    }

    validate_path_for_read(&path)?;

    read_markdown_file_from_path(path).map(Some)
}

#[tauri::command]
fn update_recent_menu(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    let Some(menu) = app.menu() else {
        return Ok(());
    };

    let Some(file_menu_item) = menu.get("file.menu") else {
        return Ok(());
    };

    let Some(file_submenu) = file_menu_item.as_submenu() else {
        return Ok(());
    };

    let Some(recent_submenu_item) = file_submenu.get("file.open_recent") else {
        return Ok(());
    };

    let Some(recent_submenu) = recent_submenu_item.as_submenu() else {
        return Ok(());
    };

    while recent_submenu.remove_at(0).map_err(|error| error.to_string())?.is_some() {}

    for (index, path) in paths.iter().take(10).enumerate() {
        let item = MenuItem::with_id(
            &app,
            format!("file.open_recent.{}", index + 1),
            format_recent_menu_label(path),
            true,
            None::<&str>,
        )
        .map_err(|error| error.to_string())?;

        recent_submenu
            .append(&item)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn save_markdown_file(
    path: Option<String>,
    suggested_name: String,
    content: String,
    watcher_state: State<Arc<WatcherState>>,
) -> Result<Option<SavedMarkdownFile>, String> {
    let path = match path {
        Some(path) if !path.trim().is_empty() => {
            let path_buf = PathBuf::from(path);
            validate_path_for_write(&path_buf)?;
            path_buf
        }
        _ => {
            let Some(path) = rfd::FileDialog::new()
                .add_filter("Markdown", &["md", "markdown", "txt"])
                .set_file_name(&suggested_name)
                .save_file()
            else {
                return Ok(None);
            };

            path
        }
    };

    fs::write(&path, content).map_err(|error| error.to_string())?;

    watcher::note_self_write(&watcher_state, &path);

    Ok(Some(SavedMarkdownFile {
        name: file_name(&path),
        path: path.to_string_lossy().into_owned(),
    }))
}

#[tauri::command]
fn watch_file(path: String, watcher_state: State<Arc<WatcherState>>) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }
    watcher::watch(&watcher_state, &PathBuf::from(path))
}

#[tauri::command]
fn unwatch_file(path: String, watcher_state: State<Arc<WatcherState>>) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }
    watcher::unwatch(&watcher_state, &PathBuf::from(path))
}

fn read_markdown_file_from_path(path: PathBuf) -> Result<MarkdownFile, String> {
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;

    Ok(MarkdownFile {
        name: file_name(&path),
        path: path.to_string_lossy().into_owned(),
        content,
    })
}

fn file_name(path: &PathBuf) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled.md")
        .to_string()
}

fn format_recent_menu_label(path: &str) -> String {
    let path_buf = PathBuf::from(path);
    let file_name = file_name(&path_buf);
    let escaped_file_name = escape_menu_mnemonic(&file_name);
    let escaped_path = escape_menu_mnemonic(path);
    format!("{escaped_file_name} — {escaped_path}")
}

fn escape_menu_mnemonic(value: &str) -> String {
    value.replace('&', "&&")
}
