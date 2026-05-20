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
- Multi-draft session persistence with automatic restore of open documents and active draft after restart.
- Insert snippets menu for block-level Markdown structures.
- Toolbar settings panel with grouped controls for theme, zoom, and autocomplete trigger shortcut.
- Configurable autocomplete trigger key combinations with per-OS availability filtering.
- UI localization support with Chinese, Japanese, and English language options.
- Settings-level language selector with persisted language preference.
- In-app Find/Replace panel with match status indicator, Replace/Replace All actions, and quick toggle behavior.
- Match options for Find: `Match case (Aa)` and `Match whole word ("")`.
- File menu `Open Recent` history with real filename + full path labels (up to 10 entries).
- Formatting toolbar actions and dedicated native `Formatting` menu (`Bold`, `Italic`, `Link`, `Code`, `Quote`).

### Changed

- Reworked the left sidebar from an IDE-style explorer into a simpler document drawer designed for a focused Markdown writing workflow.
- Added explicit `Save As...` support to match desktop editor expectations.
- Added OS-aware shortcut guidance for macOS, Windows, and Linux conventions.
- Improved open document cards with filename initials, clearer path display, and better vertical alignment.
- Moved current document metadata beside the sidebar toggle and linked its visibility to the drawer toggle state.
- Refined toolbar responsive behavior so controls stay on one row at wider compact window sizes.
- Unified settings panel control styling for theme, zoom, and autocomplete trigger controls.
- Refined multilingual layout behavior for CJK environments (spacing, control widths, and title styling).
- Refined find/replace panel placement and interaction to behave like an IDE bottom panel for better layout stability.
- Updated keyboard behavior for find workflow (`Cmd/Ctrl+F`, `Cmd/Ctrl+R`) to support predictable open/close toggling.
- Expanded localization coverage for newly added editor actions and find/replace UI copy in English, Chinese, and Japanese.

### Security

- Enabled a strict Content Security Policy in `tauri.conf.json` (`default-src 'self'`, no remote scripts, `object-src 'none'`, `frame-ancestors 'none'`) to harden the renderer against XSS and resource loading attacks.
- Hardened Tauri file IO commands: reject paths whose extensions are not `.md`, `.markdown`, or `.txt`, and refuse symlinks or non-regular files for both read and write.
- Completed HTML escaping helpers to cover `'` and `>` in attribute and text interpolation.

### Fixed

- Fixed Find/Replace incorrectly handling Unicode case-folding (e.g. German `ß`, Turkish `İ`) by switching match indexing to operate on the original source via case-insensitive regex.
- Fixed Replace All not restoring properly on undo by focusing the editor, placing the caret at the end of the last replacement, and capturing a clean history snapshot.
- Fixed Recent Files reopening a dirty tab silently discarding the user's unsaved edits; the existing tab is now activated without overwriting in-memory content.
- Fixed settings panel i18n breaking when DOM order changes by selecting elements via `data-settings-group` / `data-settings-field` instead of array indices.
- Fixed potential focus failure when opening the Find panel by switching to `requestAnimationFrame` after the `hidden` class toggles.
- Removed redundant autocomplete render in `openAutocomplete` and added HMR cleanup for the Tauri menu event listener to avoid duplicate handlers during dev reloads.

- Resolved split-view scroll feedback issues that could cause the editor and preview panes to jump or auto-scroll back unexpectedly.
- Improved menu-driven document actions so native desktop commands route through the same editor workflow as toolbar actions.
- Fixed Insert menu overflow behavior that could create unwanted horizontal/vertical window-level scrollbars.
- Fixed Insert menu positioning near viewport edges by switching to dynamic viewport-aware placement.
- Fixed block-level Insert behavior so snippets are not injected into non-empty lines and do not add extra blank lines.
- Fixed keyboard interaction for autocomplete and insert overlays (focus handling, arrow navigation, and escape behavior).
- Fixed find result index display edge cases (for example `1/1` initialization when the first match is already active).
- Fixed replace panel layout breakage under multilingual labels, especially in English/Japanese compact widths.

### Notes

- The app is not ready for a stable release yet.
- Packaging scripts and release artifacts are intentionally not finalized.
- The project uses GPL-3.0-or-later for open source use with a separate commercial licensing path.
