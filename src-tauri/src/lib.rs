mod watcher;

use serde::Serialize;
use std::fs;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use base64::Engine;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, State};
use tauri_plugin_log::{Builder as LogBuilder, RotationStrategy, Target, TargetKind};
use watcher::WatcherState;

const ALLOWED_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];
const ALLOWED_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

#[derive(Clone, Copy)]
enum MenuLocale {
    En,
    Zh,
    Ja,
}

struct MenuLabels {
    file_menu: &'static str,
    edit_menu: &'static str,
    formatting_menu: &'static str,
    view_menu: &'static str,
    help_menu: &'static str,
    file_new: &'static str,
    file_open: &'static str,
    file_open_recent: &'static str,
    file_save: &'static str,
    file_save_as: &'static str,
    file_clean_unused_assets: &'static str,
    file_close: &'static str,
    edit_undo: &'static str,
    edit_redo: &'static str,
    edit_cut: &'static str,
    edit_copy: &'static str,
    edit_paste: &'static str,
    edit_select_all: &'static str,
    edit_find: &'static str,
    edit_replace: &'static str,
    format_bold: &'static str,
    format_italic: &'static str,
    format_link: &'static str,
    format_code: &'static str,
    format_quote: &'static str,
    view_write: &'static str,
    view_split: &'static str,
    view_read: &'static str,
    view_zoom_in: &'static str,
    view_zoom_out: &'static str,
    view_actual_size: &'static str,
    view_toggle_sidebar: &'static str,
    view_toggle_theme: &'static str,
}

fn parse_menu_locale(value: &str) -> MenuLocale {
    match value {
        "zh" => MenuLocale::Zh,
        "ja" => MenuLocale::Ja,
        _ => MenuLocale::En,
    }
}

fn menu_labels(locale: MenuLocale) -> MenuLabels {
    match locale {
        MenuLocale::En => MenuLabels {
            file_menu: "File",
            edit_menu: "Edit",
            formatting_menu: "Formatting",
            view_menu: "View",
            help_menu: "Help",
            file_new: "New",
            file_open: "Open...",
            file_open_recent: "Open Recent",
            file_save: "Save",
            file_save_as: "Save As...",
            file_clean_unused_assets: "Clean Unused Assets...",
            file_close: "Close Document",
            edit_undo: "Undo",
            edit_redo: "Redo",
            edit_cut: "Cut",
            edit_copy: "Copy",
            edit_paste: "Paste",
            edit_select_all: "Select All",
            edit_find: "Find",
            edit_replace: "Replace",
            format_bold: "Bold",
            format_italic: "Italic",
            format_link: "Link",
            format_code: "Code",
            format_quote: "Blockquote",
            view_write: "Write Mode",
            view_split: "Split Mode",
            view_read: "Read Mode",
            view_zoom_in: "Zoom In",
            view_zoom_out: "Zoom Out",
            view_actual_size: "Actual Size",
            view_toggle_sidebar: "Toggle Documents Sidebar",
            view_toggle_theme: "Toggle Theme",
        },
        MenuLocale::Zh => MenuLabels {
            file_menu: "文件",
            edit_menu: "编辑",
            formatting_menu: "格式",
            view_menu: "视图",
            help_menu: "帮助",
            file_new: "新建",
            file_open: "打开...",
            file_open_recent: "最近打开",
            file_save: "保存",
            file_save_as: "另存为...",
            file_clean_unused_assets: "清理未使用资源...",
            file_close: "关闭文档",
            edit_undo: "撤销",
            edit_redo: "重做",
            edit_cut: "剪切",
            edit_copy: "复制",
            edit_paste: "粘贴",
            edit_select_all: "全选",
            edit_find: "查找",
            edit_replace: "替换",
            format_bold: "加粗",
            format_italic: "斜体",
            format_link: "链接",
            format_code: "代码",
            format_quote: "引用块",
            view_write: "写作模式",
            view_split: "分栏模式",
            view_read: "阅读模式",
            view_zoom_in: "放大",
            view_zoom_out: "缩小",
            view_actual_size: "实际大小",
            view_toggle_sidebar: "切换文档侧栏",
            view_toggle_theme: "切换主题",
        },
        MenuLocale::Ja => MenuLabels {
            file_menu: "ファイル",
            edit_menu: "編集",
            formatting_menu: "書式",
            view_menu: "表示",
            help_menu: "ヘルプ",
            file_new: "新規作成",
            file_open: "開く...",
            file_open_recent: "最近開いたファイル",
            file_save: "保存",
            file_save_as: "名前を付けて保存...",
            file_clean_unused_assets: "未使用アセットを整理...",
            file_close: "ドキュメントを閉じる",
            edit_undo: "元に戻す",
            edit_redo: "やり直し",
            edit_cut: "切り取り",
            edit_copy: "コピー",
            edit_paste: "貼り付け",
            edit_select_all: "すべてを選択",
            edit_find: "検索",
            edit_replace: "置換",
            format_bold: "太字",
            format_italic: "斜体",
            format_link: "リンク",
            format_code: "コード",
            format_quote: "引用ブロック",
            view_write: "書き込みモード",
            view_split: "分割モード",
            view_read: "閲覧モード",
            view_zoom_in: "拡大",
            view_zoom_out: "縮小",
            view_actual_size: "実際のサイズ",
            view_toggle_sidebar: "ドキュメントサイドバーを切り替え",
            view_toggle_theme: "テーマを切り替え",
        },
    }
}

fn has_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lowered = ext.to_ascii_lowercase();
            ALLOWED_EXTENSIONS.iter().any(|allowed| *allowed == lowered)
        })
        .unwrap_or(false)
}

fn has_allowed_image_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lowered = ext.to_ascii_lowercase();
            ALLOWED_IMAGE_EXTENSIONS
                .iter()
                .any(|allowed| *allowed == lowered)
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedImageAsset {
    file_name: String,
    relative_path: String,
    absolute_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CleanedAssetsResult {
    moved_count: usize,
    moved_files: Vec<String>,
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
                    | "file.clean_unused_assets"
                    | "file.close"
                    | "edit.undo"
                    | "edit.redo"
                    | "edit.cut"
                    | "edit.copy"
                    | "edit.paste"
                    | "edit.select_all"
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
            copy_image_to_assets,
            save_image_to_assets,
            read_image_as_data_url,
            clean_unused_assets_for_document,
            update_recent_menu,
            set_menu_locale,
            save_markdown_file,
            watch_file,
            unwatch_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let labels = menu_labels(MenuLocale::En);
    let about_metadata = AboutMetadata {
        name: Some("Light Markdown Editor".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        comments: Some(env!("CARGO_PKG_DESCRIPTION").into()),
        license: Some(env!("CARGO_PKG_LICENSE").into()),
        ..Default::default()
    };

    let new_file = MenuItem::with_id(app, "file.new", labels.file_new, true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(app, "file.open", labels.file_open, true, Some("CmdOrCtrl+O"))?;
    let save_file = MenuItem::with_id(app, "file.save", labels.file_save, true, Some("CmdOrCtrl+S"))?;
    let save_as_file = MenuItem::with_id(
        app,
        "file.save_as",
        labels.file_save_as,
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let clean_unused_assets = MenuItem::with_id(
        app,
        "file.clean_unused_assets",
        labels.file_clean_unused_assets,
        true,
        None::<&str>,
    )?;
    let close_file =
        MenuItem::with_id(app, "file.close", labels.file_close, true, Some("CmdOrCtrl+W"))?;
    let edit_undo = MenuItem::with_id(app, "edit.undo", labels.edit_undo, true, Some("CmdOrCtrl+Z"))?;
    let edit_redo = MenuItem::with_id(
        app,
        "edit.redo",
        labels.edit_redo,
        true,
        Some("CmdOrCtrl+Shift+Z"),
    )?;
    let edit_cut = MenuItem::with_id(app, "edit.cut", labels.edit_cut, true, Some("CmdOrCtrl+X"))?;
    let edit_copy = MenuItem::with_id(app, "edit.copy", labels.edit_copy, true, Some("CmdOrCtrl+C"))?;
    let edit_paste = MenuItem::with_id(app, "edit.paste", labels.edit_paste, true, Some("CmdOrCtrl+V"))?;
    let edit_select_all = MenuItem::with_id(
        app,
        "edit.select_all",
        labels.edit_select_all,
        true,
        Some("CmdOrCtrl+A"),
    )?;
    let find = MenuItem::with_id(app, "edit.find", labels.edit_find, true, Some("CmdOrCtrl+F"))?;
    let replace = MenuItem::with_id(app, "edit.replace", labels.edit_replace, true, Some("CmdOrCtrl+H"))?;

    let format_bold = MenuItem::with_id(app, "format.bold", labels.format_bold, true, Some("CmdOrCtrl+B"))?;
    let format_italic = MenuItem::with_id(app, "format.italic", labels.format_italic, true, Some("CmdOrCtrl+I"))?;
    let format_link =
        MenuItem::with_id(app, "format.link", labels.format_link, true, Some("CmdOrCtrl+Shift+K"))?;
    let format_code = MenuItem::with_id(app, "format.code", labels.format_code, true, Some("CmdOrCtrl+E"))?;
    let format_quote =
        MenuItem::with_id(app, "format.quote", labels.format_quote, true, Some("CmdOrCtrl+Shift+."))?;

    let write_mode = MenuItem::with_id(app, "view.write", labels.view_write, true, Some("Alt+1"))?;
    let split_mode = MenuItem::with_id(app, "view.split", labels.view_split, true, Some("Alt+2"))?;
    let read_mode = MenuItem::with_id(app, "view.preview", labels.view_read, true, Some("Alt+3"))?;
    let zoom_in = MenuItem::with_id(app, "view.zoom_in", labels.view_zoom_in, true, Some("CmdOrCtrl+="))?;
    let zoom_out =
        MenuItem::with_id(app, "view.zoom_out", labels.view_zoom_out, true, Some("CmdOrCtrl+-"))?;
    let actual_size = MenuItem::with_id(
        app,
        "view.actual_size",
        labels.view_actual_size,
        true,
        Some("CmdOrCtrl+0"),
    )?;
    let toggle_sidebar = MenuItem::with_id(
        app,
        "view.toggle_sidebar",
        labels.view_toggle_sidebar,
        true,
        Some("CmdOrCtrl+\\"),
    )?;
    let toggle_theme = MenuItem::with_id(
        app,
        "view.toggle_theme",
        labels.view_toggle_theme,
        true,
        Some("CmdOrCtrl+Alt+T"),
    )?;

    let file_menu = Submenu::with_id_and_items(
        app,
        "file.menu",
        labels.file_menu,
        true,
        &[
            &new_file,
            &open_file,
            &PredefinedMenuItem::separator(app)?,
            &Submenu::with_id_and_items(
                app,
                "file.open_recent",
                labels.file_open_recent,
                true,
                &[],
            )?,
            &PredefinedMenuItem::separator(app)?,
            &save_file,
            &save_as_file,
            &PredefinedMenuItem::separator(app)?,
            &clean_unused_assets,
            &PredefinedMenuItem::separator(app)?,
            &close_file,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_id_and_items(
        app,
        "edit.menu",
        labels.edit_menu,
        true,
        &[
            &edit_undo,
            &edit_redo,
            &PredefinedMenuItem::separator(app)?,
            &edit_cut,
            &edit_copy,
            &edit_paste,
            &PredefinedMenuItem::separator(app)?,
            &edit_select_all,
            &PredefinedMenuItem::separator(app)?,
            &find,
            &replace,
        ],
    )?;

    let formatting_menu = Submenu::with_id_and_items(
        app,
        "format.menu",
        labels.formatting_menu,
        true,
        &[&format_bold, &format_italic, &format_link, &format_code, &format_quote],
    )?;

    let view_menu = Submenu::with_id_and_items(
        app,
        "view.menu",
        labels.view_menu,
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

    let help_menu = Submenu::with_id_and_items(
        app,
        "help.menu",
        labels.help_menu,
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
fn set_menu_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    let Some(menu) = app.menu() else {
        return Ok(());
    };

    let labels = menu_labels(parse_menu_locale(locale.trim()));

    if let Some(file_menu_item) = menu.get("file.menu") {
        if let Some(file_submenu) = file_menu_item.as_submenu() {
            file_submenu
                .set_text(labels.file_menu)
                .map_err(|error| error.to_string())?;
            set_menu_item_text_in_submenu(file_submenu, "file.new", labels.file_new)?;
            set_menu_item_text_in_submenu(file_submenu, "file.open", labels.file_open)?;
            set_menu_item_text_in_submenu(file_submenu, "file.save", labels.file_save)?;
            set_menu_item_text_in_submenu(file_submenu, "file.save_as", labels.file_save_as)?;
            set_menu_item_text_in_submenu(
                file_submenu,
                "file.clean_unused_assets",
                labels.file_clean_unused_assets,
            )?;
            set_menu_item_text_in_submenu(file_submenu, "file.close", labels.file_close)?;
            set_submenu_text_in_submenu(file_submenu, "file.open_recent", labels.file_open_recent)?;
        }
    }

    if let Some(edit_menu_item) = menu.get("edit.menu") {
        if let Some(edit_submenu) = edit_menu_item.as_submenu() {
            edit_submenu
                .set_text(labels.edit_menu)
                .map_err(|error| error.to_string())?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.undo", labels.edit_undo)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.redo", labels.edit_redo)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.cut", labels.edit_cut)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.copy", labels.edit_copy)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.paste", labels.edit_paste)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.select_all", labels.edit_select_all)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.find", labels.edit_find)?;
            set_menu_item_text_in_submenu(edit_submenu, "edit.replace", labels.edit_replace)?;
        }
    }

    if let Some(format_menu_item) = menu.get("format.menu") {
        if let Some(format_submenu) = format_menu_item.as_submenu() {
            format_submenu
                .set_text(labels.formatting_menu)
                .map_err(|error| error.to_string())?;
            set_menu_item_text_in_submenu(format_submenu, "format.bold", labels.format_bold)?;
            set_menu_item_text_in_submenu(format_submenu, "format.italic", labels.format_italic)?;
            set_menu_item_text_in_submenu(format_submenu, "format.link", labels.format_link)?;
            set_menu_item_text_in_submenu(format_submenu, "format.code", labels.format_code)?;
            set_menu_item_text_in_submenu(format_submenu, "format.quote", labels.format_quote)?;
        }
    }

    if let Some(view_menu_item) = menu.get("view.menu") {
        if let Some(view_submenu) = view_menu_item.as_submenu() {
            view_submenu
                .set_text(labels.view_menu)
                .map_err(|error| error.to_string())?;
            set_menu_item_text_in_submenu(view_submenu, "view.write", labels.view_write)?;
            set_menu_item_text_in_submenu(view_submenu, "view.split", labels.view_split)?;
            set_menu_item_text_in_submenu(view_submenu, "view.preview", labels.view_read)?;
            set_menu_item_text_in_submenu(view_submenu, "view.zoom_in", labels.view_zoom_in)?;
            set_menu_item_text_in_submenu(view_submenu, "view.zoom_out", labels.view_zoom_out)?;
            set_menu_item_text_in_submenu(view_submenu, "view.actual_size", labels.view_actual_size)?;
            set_menu_item_text_in_submenu(
                view_submenu,
                "view.toggle_sidebar",
                labels.view_toggle_sidebar,
            )?;
            set_menu_item_text_in_submenu(view_submenu, "view.toggle_theme", labels.view_toggle_theme)?;
        }
    }

    if let Some(help_menu_item) = menu.get("help.menu") {
        if let Some(help_submenu) = help_menu_item.as_submenu() {
            help_submenu
                .set_text(labels.help_menu)
                .map_err(|error| error.to_string())?;
        }
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
fn copy_image_to_assets(
    source_path: String,
    document_path: String,
    target_file_name: String,
) -> Result<SavedImageAsset, String> {
    let source = PathBuf::from(source_path);
    let bytes = fs::read(&source).map_err(|error| error.to_string())?;
    save_image_bytes_to_assets(&document_path, &target_file_name, &bytes)
}

#[tauri::command]
fn save_image_to_assets(
    document_path: String,
    base64_data: String,
    mime_type: Option<String>,
    target_file_name: String,
) -> Result<SavedImageAsset, String> {
    let _mime_type = mime_type;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|error| error.to_string())?;
    save_image_bytes_to_assets(&document_path, &target_file_name, &bytes)
}

#[tauri::command]
fn read_image_as_data_url(path: String) -> Result<String, String> {
    let image_path = PathBuf::from(path);
    if !image_path.exists() {
        return Err("Image does not exist".to_string());
    }
    if !has_allowed_image_extension(&image_path) {
        return Err("Unsupported image file type".to_string());
    }

    let metadata = fs::symlink_metadata(&image_path).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinks are not allowed".to_string());
    }
    if !metadata.is_file() {
        return Err("Not a regular file".to_string());
    }

    let bytes = fs::read(&image_path).map_err(|error| error.to_string())?;
    let mime = mime_type_for_image_path(&image_path);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[tauri::command]
fn clean_unused_assets_for_document(
    document_path: String,
    referenced_sources: Vec<String>,
) -> Result<CleanedAssetsResult, String> {
    let markdown_path = PathBuf::from(document_path);
    validate_path_for_write(&markdown_path)?;

    let (document_dir, scoped_assets_dir, scoped_assets_prefix) =
        resolve_document_asset_scope(&markdown_path)?;

    if !scoped_assets_dir.exists() {
        return Ok(CleanedAssetsResult {
            moved_count: 0,
            moved_files: vec![],
        });
    }

    let meta = fs::symlink_metadata(&scoped_assets_dir).map_err(|error| error.to_string())?;
    if meta.file_type().is_symlink() {
        return Err("Assets directory symlinks are not allowed".to_string());
    }
    if !meta.is_dir() {
        return Err("Assets path is not a directory".to_string());
    }

    let mut referenced_absolute: HashSet<PathBuf> = HashSet::new();
    for source in referenced_sources {
        if let Some(path) = resolve_referenced_asset_path(&document_dir, &source, &scoped_assets_dir, &scoped_assets_prefix) {
            referenced_absolute.insert(path);
        }
    }

    let mut moved_files: Vec<String> = vec![];
    for entry in fs::read_dir(&scoped_assets_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let entry_meta = fs::symlink_metadata(&entry_path).map_err(|error| error.to_string())?;

        if entry_meta.file_type().is_symlink() || !entry_meta.is_file() {
            continue;
        }

        if !referenced_absolute.contains(&entry_path) {
            trash::delete(&entry_path).map_err(|error| error.to_string())?;
            moved_files.push(entry_path.to_string_lossy().into_owned());
        }
    }

    Ok(CleanedAssetsResult {
        moved_count: moved_files.len(),
        moved_files,
    })
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

fn save_image_bytes_to_assets(
    document_path: &str,
    target_file_name: &str,
    bytes: &[u8],
) -> Result<SavedImageAsset, String> {
    let markdown_path = PathBuf::from(document_path);
    validate_path_for_write(&markdown_path)?;

    let file_name = Path::new(target_file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid image file name".to_string())?;

    let (_document_dir, assets_dir, assets_prefix) = resolve_document_asset_scope(&markdown_path)?;
    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;

    let absolute_path = unique_asset_path(&assets_dir, file_name);
    fs::write(&absolute_path, bytes).map_err(|error| error.to_string())?;

    let final_file_name = absolute_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid saved image path".to_string())?;

    Ok(SavedImageAsset {
        file_name: final_file_name.to_string(),
        relative_path: format!("{assets_prefix}/{final_file_name}"),
        absolute_path: absolute_path.to_string_lossy().into_owned(),
    })
}

fn unique_asset_path(assets_dir: &Path, file_name: &str) -> PathBuf {
    let candidate = assets_dir.join(file_name);

    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("image");
    let extension = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    for index in 2..10_000 {
        let next_name = if extension.is_empty() {
            format!("{stem}-{index}")
        } else {
            format!("{stem}-{index}.{extension}")
        };
        let next_candidate = assets_dir.join(next_name);

        if !next_candidate.exists() {
            return next_candidate;
        }
    }

    assets_dir.join(file_name)
}

fn resolve_document_asset_scope(markdown_path: &Path) -> Result<(PathBuf, PathBuf, String), String> {
    let document_dir = markdown_path
        .parent()
        .ok_or_else(|| "Document path does not have a parent directory".to_string())?
        .to_path_buf();
    let scoped_asset_name = sanitize_asset_segment(
        markdown_path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("document"),
    );
    let scoped_assets_prefix = format!("assets/{}", scoped_asset_name);
    let scoped_assets_dir = document_dir.join("assets").join(&scoped_asset_name);
    Ok((document_dir, scoped_assets_dir, scoped_assets_prefix))
}

fn sanitize_asset_segment(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch.is_whitespace() || ch == '.' {
            out.push('-');
        }
    }

    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "document".to_string()
    } else {
        trimmed.to_string()
    }
}

fn looks_like_windows_absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

fn resolve_referenced_asset_path(
    document_dir: &Path,
    source: &str,
    scoped_assets_dir: &Path,
    scoped_assets_prefix: &str,
) -> Option<PathBuf> {
    let normalized = source.trim().replace('\\', "/");
    if normalized.is_empty() {
        return None;
    }
    let lowered = normalized.to_ascii_lowercase();
    if lowered.starts_with("http:")
        || lowered.starts_with("https:")
        || lowered.starts_with("data:")
        || lowered.starts_with("blob:")
        || lowered.starts_with("mailto:")
    {
        return None;
    }

    let relative = normalized.trim_start_matches("./");
    let candidate = if relative.starts_with(scoped_assets_prefix) {
        document_dir.join(relative)
    } else if Path::new(relative).is_absolute() || looks_like_windows_absolute(relative) {
        PathBuf::from(relative)
    } else {
        document_dir.join(relative)
    };

    if !candidate.starts_with(scoped_assets_dir) {
        return None;
    }

    Some(candidate)
}

fn mime_type_for_image_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
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

fn set_submenu_text_in_submenu<R: tauri::Runtime>(
    submenu: &Submenu<R>,
    id: &str,
    text: &str,
) -> Result<(), String> {
    let Some(item) = submenu.get(id) else {
        return Ok(());
    };
    let Some(child_submenu) = item.as_submenu() else {
        return Ok(());
    };
    child_submenu
        .set_text(text)
        .map_err(|error| error.to_string())
}

fn set_menu_item_text_in_submenu<R: tauri::Runtime>(
    submenu: &Submenu<R>,
    id: &str,
    text: &str,
) -> Result<(), String> {
    let Some(item) = submenu.get(id) else {
        return Ok(());
    };
    let Some(menu_item) = item.as_menuitem() else {
        return Ok(());
    };
    menu_item.set_text(text).map_err(|error| error.to_string())
}
