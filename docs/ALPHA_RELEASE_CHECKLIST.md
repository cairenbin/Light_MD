# Alpha Release Checklist

Use this checklist before publishing the first GitHub alpha.

## Repository

- Decide the final repository name.
- Confirm `LICENSE` and `COMMERCIAL_LICENSE.md` reflect the intended dual-license model.
- Confirm `README.md` reflects the current app direction.
- Confirm generated files are ignored.
- Confirm no local-only files or secrets are present.
- Add screenshots or a short demo GIF after the UI stabilizes.
- Confirm release notes and changelog entries are updated before tagging.

## Product

- Verify Open can load `.md`, `.markdown`, and `.txt` files.
- Verify Save writes to the existing file path.
- Verify new unsaved files open a native save dialog.
- Verify Write, Split, and Read modes.
- Verify synchronized scrolling in Split mode.
- Verify light and dark theme switching.
- Verify proportional zoom controls.
- Verify document drawer open, close, select, and hide behavior.

## Quality

- Run `npm run check`.
- Test on macOS before the first alpha.
- Test Windows and Linux before claiming cross-platform support.
- Review large Markdown file performance.
- Review unsaved-change behavior before closing files or the app.

## Release

- Decide whether alpha builds will be attached to GitHub Releases.
- Use the existing macOS GitHub Actions workflow for arm64/x64 release assets.
- Keep regular `master` pushes out of packaging CI; use `release` branch pushes or `v*` tags for release builds.
- Verify release asset names follow the `LightMD-<version>-macos-<arch>` convention.
- Decide when to add Windows and Linux package workflows.
- Decide whether macOS builds will stay unsigned or move to Developer ID signing/notarization.
- Replace the placeholder app icon before a public alpha if possible.
- Confirm the commercial licensing contact path is still accurate before public release.
- Tag alpha releases consistently, for example `v0.1.0-alpha.1`.
