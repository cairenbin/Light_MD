# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0-alpha - Unreleased

### Added

- Initial Tauri desktop app setup.
- Markdown editing with live preview.
- Native Markdown file open and save.
- Native desktop application menu with standard editor actions.
- Write, Split, and Read modes.
- Solarized-inspired light and dark themes.
- Proportional document zoom controls.
- Synchronized editor and preview scrolling.
- Multi-document session handling with an open documents drawer.
- Save confirmation dialog when closing unsaved documents.

### Changed

- Reworked the left sidebar from an IDE-style explorer into a simpler document drawer designed for a focused Markdown writing workflow.
- Added explicit `Save As...` support to match desktop editor expectations.
- Added OS-aware shortcut guidance for macOS, Windows, and Linux conventions.
- Improved open document cards with filename initials, clearer path display, and better vertical alignment.

### Fixed

- Resolved split-view scroll feedback issues that could cause the editor and preview panes to jump or auto-scroll back unexpectedly.
- Improved menu-driven document actions so native desktop commands route through the same editor workflow as toolbar actions.

### Notes

- The app is not ready for a stable release yet.
- Packaging scripts and release artifacts are intentionally not finalized.
- The project uses GPL-3.0-or-later for open source use with a separate commercial licensing path.
