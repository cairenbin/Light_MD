use serde::Serialize;
use std::fs;
use std::path::PathBuf;

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
        .invoke_handler(tauri::generate_handler![
            open_markdown_file,
            save_markdown_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[tauri::command]
fn open_markdown_file() -> Result<Option<MarkdownFile>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .pick_file()
    else {
        return Ok(None);
    };

    read_markdown_file(path).map(Some)
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

fn read_markdown_file(path: PathBuf) -> Result<MarkdownFile, String> {
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
