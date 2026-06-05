# Light Markdown Editor

[English](README.md) | [中文](README.zh-CN.md)

A lightweight cross-platform Markdown desktop editor inspired by Typora.

Light Markdown Editor is built around a quiet, app-first writing experience. It aims to be a simple desktop editor rather than an IDE, with native file operations, live preview, and a compact document workflow. The project is intended to stay focused on Markdown writing itself instead of workspace or project management, with a cross-platform direction across macOS, Linux, and Windows.

## Features

- Markdown editing with live rendered preview.
- `Write`, `Split`, and `Read` viewing modes.
- Native desktop `Open`, `Save`, and `Save As...`.
- Native export actions: `Export HTML...` and `Export PDF...`.
- Multi-document session handling with an open documents drawer.
- Multi-draft persistence and session restore across app restarts.
- Light and dark themes.
- Proportional document zoom.
- Toolbar `Insert` snippets for block-level Markdown structures.
- KaTeX math rendering for inline (`$...$`) and display (`$$...$$`) formulas.
- Built-in `Find / Replace` panel with `Match case (Aa)` and `Whole word ("")` toggles.
- Keyboard-driven find flow (`Cmd/Ctrl+F` for Find, `Cmd/Ctrl+R` for Replace panel toggle).
- Autocomplete hints with configurable trigger key combinations.
- `File > Open Recent` with real filename + path history entries (up to 10).
- Formatting toolbar actions (`Bold`, `Italic`, `Link`, `Code`, `Quote`) plus native `Formatting` menu support.
- Image paste/drag support: image files are copied into document-scoped `assets/<document-name>/` and inserted as Markdown links.
- Paste-as-Markdown: clipboard content with an HTML flavor (copied from web pages or rich-text apps) is converted to Markdown on paste while standard paste shortcuts remain native.
- HTML export inlines local images so exported single-file documents remain viewable offline.
- Standard PDF export with block-aware pagination tuned for long Markdown documents.
- KaTeX formulas are rendered in preview and exports; exported documents use embedded layout CSS, while the app preview uses bundled KaTeX fonts.
- `File > Clean Unused Assets...` to safely move unreferenced current-document assets to Trash/Recycle Bin.
- `File > Download Remote Images...` to fetch remote `http(s)` images in the current document into scoped assets and rewrite the links to local paths (so they display under the editor's image CSP); failed downloads are skipped and reported.
- Native app menu localization follows in-app language for custom menu items (English, 中文, 日本語).
- Settings panel for theme, zoom, and autocomplete shortcut preferences.
- Built-in UI language switching (`English`, `中文`, `日本語`) from Settings.
- Native file dialogs and desktop shortcuts.
- OS-aware shortcut display and shortcut option filtering.
- Strict CSP, file IO restrictions, and a sanitized preview pipeline.

## Tech Stack

- Tauri v2 for the desktop application shell.
- TypeScript and Vite for the editor UI.
- Rust for native commands and file operations.
- `marked` for Markdown rendering.
- `KaTeX` for math formula rendering.
- `highlight.js` for code block syntax highlighting.
- `turndown` (with the GFM plugin) for converting pasted HTML to Markdown.
- `html2canvas` and `jsPDF` for PDF export.
- `DOMPurify` for preview sanitization.
- Vitest for unit tests on extracted helpers.
- ESLint and Prettier for code style.
- TypeScript `strict` mode with `noUnusedLocals`, `noUnusedParameters`, and `exactOptionalPropertyTypes` enabled.

## Project Structure

- `src/main.ts` — application entry and top-level wiring.
- `src/core/` — file workflow controllers for open/save/export/assets.
- `src/ui/` — UI controllers for autocomplete, find, insert menu, outline, and settings.
- `src/editor/` — pure editor helpers (snippets, find matches, list/code continuation) with unit tests.
- `src/utils/` — shared utilities (`html`, `path`, `platform`, `storage`).
- `src/storage/` — session persistence and recent file synchronization.
- `src/i18n/` — translation dictionaries and lookup helpers.
- `src/types.ts` / `src/constants.ts` — shared type aliases and constants.
- `src-tauri/` — Rust commands, Tauri configuration, and native menu wiring.

## Security

- Strict Content Security Policy in `tauri.conf.json` (`default-src 'self'`, no remote scripts, `object-src 'none'`, `frame-ancestors 'none'`).
- Tauri file IO rejects extensions other than `.md`, `.markdown`, and `.txt`, and refuses symlinks or non-regular files for both read and write.
- Preview HTML is sanitized through `DOMPurify`, with attribute and text escaping covering `'` and `>`.

## Run Locally

```bash
npm install
npm run tauri:dev
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (browser). |
| `npm run tauri:dev` | Tauri desktop dev shell. |
| `npm run build` | `tsc` type-check followed by `vite build`. |
| `npm run test` / `test:watch` / `test:coverage` | Vitest single run / watch / coverage. |
| `npm run lint` / `lint:fix` | ESLint over `src`. |
| `npm run format` / `format:check` | Prettier write / check. |
| `npm run check` | Full pre-PR gate: build + test + lint + `cargo check`. |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, development principles, and pull request guidelines.

## Status

The project is in alpha-stage development. It already supports basic Markdown editing workflows, but the app is still evolving and not yet positioned as a finished stable release.

## Release Workflow

- Packaging CI is intentionally scoped to release flow only.
- macOS build workflow is triggered by `release` branch pushes and `v*` tags (not by regular `master` pushes).
- About/version metadata is synchronized from release tag versions during tag-based builds.

## License

Copyright (c) 2026 Renbin.Cai

This project is available under a dual-license model:

- Open source: GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
- Commercial licensing: see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
