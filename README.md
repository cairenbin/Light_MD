# Light Markdown Editor

[English](README.md) | [中文](README.zh-CN.md)

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
- Built-in `Find / Replace` panel with `Match case (Aa)` and `Whole word ("")` toggles.
- Keyboard-driven find flow (`Cmd/Ctrl+F` for Find, `Cmd/Ctrl+R` for Replace panel toggle).
- Autocomplete hints with configurable trigger key combinations.
- `File > Open Recent` with real filename + path history entries (up to 10).
- Formatting toolbar actions (`Bold`, `Italic`, `Link`, `Code`, `Quote`) plus native `Formatting` menu support.
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
- `DOMPurify` for preview sanitization.
- Vitest for unit tests on extracted helpers.
- ESLint and Prettier for code style.
- TypeScript `strict` mode with `noUnusedLocals`, `noUnusedParameters`, and `exactOptionalPropertyTypes` enabled.

## Project Structure

- `src/main.ts` — application entry and top-level wiring.
- `src/editor/` — pure editor helpers (snippets, find matches, list/code continuation) with unit tests.
- `src/utils/` — shared utilities (`html`, `path`, `platform`, `storage`).
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

## License

This project is available under a dual-license model:

- Open source: GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
- Commercial licensing: see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
