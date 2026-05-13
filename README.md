# Light Markdown Editor

A lightweight desktop Markdown editor inspired by Typora, built with Tauri, Vite, and TypeScript.

This project is now app-first. The Vite frontend is kept as the UI layer required by Tauri, but the product direction is a cross-platform desktop app rather than a standalone web editor.

## Current Features

- Markdown source editing with live rendered preview.
- Write, Split, and Read modes.
- Native file open and save through Tauri.
- VS Code style open-file explorer.
- Solarized-inspired light and dark themes.
- Proportional document zoom with `A-` and `A+`.
- Synchronized scrolling between editor and preview in Split mode.
- Local draft recovery for the current editing state.

## Tech Stack

- Tauri v2 for the desktop shell and native file operations.
- Vite for frontend development and bundling.
- TypeScript for the editor UI.
- marked for Markdown rendering.
- DOMPurify for sanitized preview output.
- Rust for Tauri commands.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development mode:

```bash
npm run tauri:dev
```

Run project checks:

```bash
npm run check
```

The `dev` and `build` scripts are still present because Tauri uses Vite under the hood:

```bash
npm run dev
npm run build
```

For normal app development, prefer `npm run tauri:dev`.

## Project Status

The project is pre-alpha. The editor is usable for basic Markdown workflows, but the app is still evolving quickly and should not yet be treated as a polished release.

See [docs/ALPHA_RELEASE_CHECKLIST.md](docs/ALPHA_RELEASE_CHECKLIST.md) before publishing the first alpha build or opening the repository publicly.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## License

This project is available under a dual-license model:

- Open source use: GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
- Commercial use: contact the project owner for a separate commercial license if you need proprietary distribution, closed-source integration, or terms that are not compatible with GPLv3.

See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for the commercial licensing note.
