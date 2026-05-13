use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

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
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            let menu_id = event.id().as_ref();

            if matches!(
                menu_id,
                "file.new"
                    | "file.open"
                    | "file.save"
                    | "file.save_as"
                    | "file.close"
                    | "edit.undo"
                    | "edit.redo"
                    | "edit.cut"
                    | "edit.copy"
                    | "edit.paste"
                    | "edit.select_all"
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
            save_markdown_file
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

    let undo = MenuItem::with_id(app, "edit.undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
    let redo = MenuItem::with_id(app, "edit.redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
    let cut = MenuItem::with_id(app, "edit.cut", "Cut", true, Some("CmdOrCtrl+X"))?;
    let copy = MenuItem::with_id(app, "edit.copy", "Copy", true, Some("CmdOrCtrl+C"))?;
    let paste = MenuItem::with_id(app, "edit.paste", "Paste", true, Some("CmdOrCtrl+V"))?;
    let select_all = MenuItem::with_id(
        app,
        "edit.select_all",
        "Select All",
        true,
        Some("CmdOrCtrl+A"),
    )?;

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

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_file,
            &open_file,
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
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &PredefinedMenuItem::separator(app)?,
            &select_all,
        ],
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
fn save_markdown_file(
    path: Option<String>,
    suggested_name: String,
    content: String,
) -> Result<Option<SavedMarkdownFile>, String> {
    let path = match path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
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

    Ok(Some(SavedMarkdownFile {
        name: file_name(&path),
        path: path.to_string_lossy().into_owned(),
    }))
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
