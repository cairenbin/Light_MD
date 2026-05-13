# Contributing

Thanks for taking an interest in Light Markdown Editor.

This project is still pre-alpha, so the main goal is to keep the codebase small, understandable, and easy to reshape.

## Local Setup

```bash
npm install
npm run tauri:dev
```

Before opening a pull request, run:

```bash
npm run check
```

## Development Principles

- Keep the app desktop-first. Do not add browser-only workflows unless they also make sense inside Tauri.
- Prefer simple, readable TypeScript and Rust over early abstraction.
- Preserve the lightweight editor feel.
- Avoid Electron-specific assumptions.
- Keep generated output such as `dist/`, `node_modules/`, and `src-tauri/target/` out of commits.

## Pull Requests

- By submitting a pull request, you agree that your contribution may be distributed under this project's dual-license model: GPL-3.0-or-later for open source use and a separate commercial license from the project owner.
- Explain the user-facing change.
- Mention any behavior that still needs manual testing.
- Include screenshots or short recordings for UI changes when useful.
- Keep unrelated cleanup out of feature PRs when possible.

## Issues

Useful issue reports include:

- Operating system and version.
- App version or commit.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- A sample Markdown file if rendering or scrolling is involved.
