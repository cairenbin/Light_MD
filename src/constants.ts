import type { Locale } from "./types";

export const DRAFT_KEY = "light-md-editor:draft";
export const TITLE_KEY = "light-md-editor:title";
export const DRAFT_SESSION_KEY = "light-md-editor:draft-session";
export const DRAFT_SESSION_VERSION = 1;
export const THEME_KEY = "light-md-editor:theme";
export const SIDEBAR_KEY = "light-md-editor:sidebar-open";
export const DRAWER_TAB_KEY = "light-md-editor:drawer-tab";
export const ZOOM_KEY = "light-md-editor:zoom-percent";
export const EDITOR_FONT_FAMILY_KEY = "light-md-editor:editor-font-family";
export const EDITOR_FONT_SIZE_KEY = "light-md-editor:editor-font-size";
export const AUTOCOMPLETE_SHORTCUT_KEY = "light-md-editor:autocomplete-shortcut";
export const LOCALE_KEY = "light-md-editor:locale";
export const RECENT_FILES_KEY = "light-md-editor:recent-files";

export const DEFAULT_AUTOCOMPLETE_SHORTCUT_ID = "shift-space";
export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_ZOOM_PERCENT = 100;
export const MIN_ZOOM_PERCENT = 80;
export const MAX_ZOOM_PERCENT = 140;
export const ZOOM_STEP = 5;
export const DEFAULT_EDITOR_FONT_FAMILY = "";
export const DEFAULT_EDITOR_FONT_SIZE = 18;
export const MIN_EDITOR_FONT_SIZE = 12;
export const MAX_EDITOR_FONT_SIZE = 28;
export const EDITOR_FONT_SIZE_OPTIONS = [
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28
] as const;
export const MAX_RECENT_FILES = 10;

export const MAX_HISTORY_STACK = 500;
export const MAX_FIND_MATCHES = 10000;

export const starterMarkdown = `# Untitled

Start writing here. The preview updates as you type.

## Basic Markdown

- **Bold** and _italic_ text
- \`Inline code\`
- [A link](https://commonmark.org)

> A quiet editor should stay out of the way.

\`\`\`ts
const greeting = "hello markdown";
console.log(greeting);
\`\`\`
`;
