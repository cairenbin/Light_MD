# Light Markdown Editor

A lightweight cross-platform Markdown desktop editor inspired by Typora.

Light Markdown Editor is built around a quiet, app-first writing experience. It aims to be a simple desktop editor rather than an IDE, with native file operations, live preview, and a compact document workflow. The project is intended to stay focused on Markdown writing itself instead of workspace or project management, with a cross-platform direction across macOS, Linux, and Windows.

## Features

- Markdown editing with live rendered preview.
- `Write`, `Split`, and `Read` viewing modes.
- Native desktop `Open`, `Save`, and `Save As...`.
- Multi-document session handling with an open documents drawer.
- Multi-draft persistence and session restore across app restarts.
- Light and dark themes.
- Proportional document zoom.
- Toolbar `Insert` snippets for block-level Markdown structures.
- Autocomplete hints with configurable trigger key combinations.
- Settings panel for theme, zoom, and autocomplete shortcut preferences.
- Native file dialogs and desktop shortcuts.
- OS-aware shortcut display and shortcut option filtering.

## Tech Stack

- Tauri v2 for the desktop application shell.
- TypeScript and Vite for the editor UI.
- Rust for native commands and file operations.
- `marked` for Markdown rendering.
- `DOMPurify` for preview sanitization.

## Run Locally

```bash
npm install
npm run tauri:dev
```

## Status

The project is in alpha-stage development. It already supports basic Markdown editing workflows, but the app is still evolving and not yet positioned as a finished stable release.

## License

This project is available under a dual-license model:

- Open source: GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
- Commercial licensing: see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
