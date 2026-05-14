import DOMPurify from "dompurify";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { marked } from "marked";
import "./styles.css";

const DRAFT_KEY = "light-md-editor:draft";
const TITLE_KEY = "light-md-editor:title";
const DRAFT_SESSION_KEY = "light-md-editor:draft-session";
const DRAFT_SESSION_VERSION = 1;
const THEME_KEY = "light-md-editor:theme";
const SIDEBAR_KEY = "light-md-editor:sidebar-open";
const ZOOM_KEY = "light-md-editor:zoom-percent";
const AUTOCOMPLETE_SHORTCUT_KEY = "light-md-editor:autocomplete-shortcut";
const DEFAULT_AUTOCOMPLETE_SHORTCUT_ID = "shift-space";
const DEFAULT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 80;
const MAX_ZOOM_PERCENT = 140;
const ZOOM_STEP = 5;

type ViewMode = "write" | "split" | "preview";
type ThemeMode = "light" | "dark";

type OpenFile = {
  id: string;
  name: string;
  content: string;
  nativePath: string | null;
  isDirty: boolean;
};

type EditorState = {
  content: string;
  fileName: string;
  nativePath: string | null;
  isDirty: boolean;
  mode: ViewMode;
  theme: ThemeMode;
  isSidebarOpen: boolean;
  openFiles: OpenFile[];
  activeFileId: string;
  zoomPercent: number;
  autocompleteShortcutId: string;
};

type PendingCloseRequest = {
  fileId: string;
};

type TauriMarkdownFile = {
  path: string;
  name: string;
  content: string;
};

type TauriSavedMarkdownFile = {
  path: string;
  name: string;
};

type EditorSelectionEdit = {
  start: number;
  end: number;
  text: string;
  selectionStart?: number;
  selectionEnd?: number;
};

type EditorAutocompleteContext = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
  lineStart: number;
  lineEnd: number;
  currentLine: string;
  beforeLineCursor: string;
  afterLineCursor: string;
  trimmedLine: string;
  token: string;
  tokenStart: number;
  tokenEnd: number;
};

type EditorAutocompleteItem = {
  id: string;
  label: string;
  detail: string;
  keywords: string[];
  autoPrefixes: string[];
  buildEdit: (context: EditorAutocompleteContext) => EditorSelectionEdit;
};

type EditorAutocompleteState = {
  isOpen: boolean;
  items: EditorAutocompleteItem[];
  activeIndex: number;
  manual: boolean;
  interactionMode: "keyboard" | "pointer";
  anchorTop: number;
  anchorLeft: number;
};

type InsertMenuItem = {
  id: string;
  label: string;
  detail: string;
  buildEdit: (context: EditorAutocompleteContext) => EditorSelectionEdit;
};

type DraftSession = {
  version: number;
  activeFileId: string;
  openFiles: OpenFile[];
};

type AutocompleteShortcutOption = {
  id: string;
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  label: string;
  platforms?: Array<"mac" | "other">;
  macLabel?: string;
};

const starterMarkdown = `# Untitled

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

marked.use({
  gfm: true,
  breaks: false
});

const autocompleteShortcutOptions: AutocompleteShortcutOption[] = [
  {
    id: "shift-space",
    code: "Space",
    shift: true,
    ctrl: false,
    alt: false,
    meta: false,
    label: "Shift + Space"
  },
  {
    id: "ctrl-space",
    code: "Space",
    shift: false,
    ctrl: true,
    alt: false,
    meta: false,
    label: "Ctrl + Space",
    macLabel: "⌃ Control + Space",
    platforms: ["other"]
  },
  {
    id: "alt-space",
    code: "Space",
    shift: false,
    ctrl: false,
    alt: true,
    meta: false,
    label: "Alt + Space",
    platforms: ["other"]
  },
  {
    id: "ctrl-shift-space",
    code: "Space",
    shift: true,
    ctrl: true,
    alt: false,
    meta: false,
    label: "Ctrl + Shift + Space",
    macLabel: "⌃ Control + Shift + Space",
    platforms: ["other"]
  },
  {
    id: "cmd-space",
    code: "Space",
    shift: false,
    ctrl: false,
    alt: false,
    meta: true,
    label: "Meta + Space",
    macLabel: "⌘ Command + Space",
    platforms: ["mac"]
  },
  {
    id: "cmd-shift-space",
    code: "Space",
    shift: true,
    ctrl: false,
    alt: false,
    meta: true,
    label: "Meta + Shift + Space",
    macLabel: "⌘ Command + Shift + Space",
    platforms: ["mac"]
  }
];

const editorAutocompleteItems: EditorAutocompleteItem[] = [
  {
    id: "heading-1",
    label: "Heading 1",
    detail: "# Main heading",
    keywords: ["heading", "title", "h1", "#"],
    autoPrefixes: ["#"],
    buildEdit: (context) => buildHeadingEdit(context, 1)
  },
  {
    id: "heading-2",
    label: "Heading 2",
    detail: "## Section heading",
    keywords: ["heading", "section", "h2", "##"],
    autoPrefixes: ["##"],
    buildEdit: (context) => buildHeadingEdit(context, 2)
  },
  {
    id: "heading-3",
    label: "Heading 3",
    detail: "### Subsection heading",
    keywords: ["heading", "subsection", "h3", "###"],
    autoPrefixes: ["###"],
    buildEdit: (context) => buildHeadingEdit(context, 3)
  },
  {
    id: "bullet-list",
    label: "Bullet List",
    detail: "- List item",
    keywords: ["list", "bullet", "unordered", "-"],
    autoPrefixes: ["-", "*", "+"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- List item", /^[-*+]\s*$/)
  },
  {
    id: "task-list",
    label: "Task List",
    detail: "- [ ] Task",
    keywords: ["task", "checkbox", "todo", "- [ ]"],
    autoPrefixes: ["-", "- [", "- []"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- [ ] Task", /^-\s*(\[\]|\[ \])?\s*$/)
  },
  {
    id: "task-list-done",
    label: "Completed Task",
    detail: "- [x] Completed task",
    keywords: ["task", "checkbox", "done", "completed", "- [x]"],
    autoPrefixes: ["- [x]", "- [X]"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- [x] Completed task", /^-\s*\[(x|X)\]\s*$/)
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    detail: "1. List item",
    keywords: ["list", "ordered", "numbered", "1."],
    autoPrefixes: ["1", "1."],
    buildEdit: (context) => buildLineSnippetEdit(context, "1. List item", /^\d+\.?\s*$/)
  },
  {
    id: "blockquote",
    label: "Blockquote",
    detail: "> Quote",
    keywords: ["quote", "blockquote", ">"],
    autoPrefixes: [">"],
    buildEdit: (context) => buildLineSnippetEdit(context, "> Quote", /^>\s*$/)
  },
  {
    id: "horizontal-rule",
    label: "Horizontal Rule",
    detail: "---",
    keywords: ["rule", "separator", "divider", "---"],
    autoPrefixes: ["---", "***", "___"],
    buildEdit: (context) => buildLineSnippetEdit(context, "---", /^(-{3,}|\*{3,}|_{3,})\s*$/)
  },
  {
    id: "code-fence",
    label: "Code Fence",
    detail: "```md fenced code block",
    keywords: ["code", "fence", "snippet", "```"],
    autoPrefixes: ["```", "~~~"],
    buildEdit: (context) => buildCodeFenceEdit(context)
  },
  {
    id: "code-fence-ts",
    label: "Code Fence: TypeScript",
    detail: "```ts",
    keywords: ["code", "fence", "typescript", "ts"],
    autoPrefixes: ["```ts", "~~~ts"],
    buildEdit: (context) => buildCodeFenceEdit(context, "ts")
  },
  {
    id: "code-fence-js",
    label: "Code Fence: JavaScript",
    detail: "```js",
    keywords: ["code", "fence", "javascript", "js"],
    autoPrefixes: ["```js", "~~~js"],
    buildEdit: (context) => buildCodeFenceEdit(context, "js")
  },
  {
    id: "code-fence-bash",
    label: "Code Fence: Bash",
    detail: "```bash",
    keywords: ["code", "fence", "bash", "shell", "sh"],
    autoPrefixes: ["```bash", "~~~bash", "```sh", "~~~sh"],
    buildEdit: (context) => buildCodeFenceEdit(context, "bash")
  },
  {
    id: "code-fence-json",
    label: "Code Fence: JSON",
    detail: "```json",
    keywords: ["code", "fence", "json"],
    autoPrefixes: ["```json", "~~~json"],
    buildEdit: (context) => buildCodeFenceEdit(context, "json")
  },
  {
    id: "code-fence-rust",
    label: "Code Fence: Rust",
    detail: "```rust",
    keywords: ["code", "fence", "rust", "rs"],
    autoPrefixes: ["```rust", "~~~rust", "```rs", "~~~rs"],
    buildEdit: (context) => buildCodeFenceEdit(context, "rust")
  },
  {
    id: "code-fence-python",
    label: "Code Fence: Python",
    detail: "```python",
    keywords: ["code", "fence", "python", "py"],
    autoPrefixes: ["```python", "~~~python", "```py", "~~~py"],
    buildEdit: (context) => buildCodeFenceEdit(context, "python")
  },
  {
    id: "link",
    label: "Link",
    detail: "[label](https://example.com)",
    keywords: ["link", "url", "reference", "["],
    autoPrefixes: ["["],
    buildEdit: (context) => buildLinkEdit(context, false)
  },
  {
    id: "image",
    label: "Image",
    detail: "![alt text](https://example.com/image.png)",
    keywords: ["image", "media", "alt", "!["],
    autoPrefixes: ["!["],
    buildEdit: (context) => buildLinkEdit(context, true)
  },
  {
    id: "reference-link",
    label: "Reference Link",
    detail: "[label][ref] + [ref]: https://example.com",
    keywords: ["reference", "link", "ref", "citation"],
    autoPrefixes: ["[ref]", "[]"],
    buildEdit: (context) => buildReferenceLinkEdit(context)
  },
  {
    id: "footnote-ref",
    label: "Footnote Reference",
    detail: "[^1]",
    keywords: ["footnote", "reference", "[^1]"],
    autoPrefixes: ["[^"],
    buildEdit: (context) => buildFootnoteReferenceEdit(context)
  },
  {
    id: "footnote-def",
    label: "Footnote Definition",
    detail: "[^1]: Footnote text",
    keywords: ["footnote", "definition", "note"],
    autoPrefixes: ["[^1]:", "[^"],
    buildEdit: (context) => buildFootnoteDefinitionEdit(context)
  },
  {
    id: "table",
    label: "Table",
    detail: "| Column | Column |",
    keywords: ["table", "columns", "|"],
    autoPrefixes: ["|"],
    buildEdit: (context) => buildTableEdit(context)
  },
  {
    id: "table-alignment",
    label: "Aligned Table",
    detail: "| :--- | :---: | ---: |",
    keywords: ["table", "align", "columns"],
    autoPrefixes: ["|:"],
    buildEdit: (context) => buildAlignedTableEdit(context)
  },
  {
    id: "bold",
    label: "Bold",
    detail: "**strong text**",
    keywords: ["bold", "strong", "**"],
    autoPrefixes: ["**"],
    buildEdit: (context) => buildWrappedEdit(context, "**", "**", "bold text")
  },
  {
    id: "italic",
    label: "Italic",
    detail: "_emphasis_",
    keywords: ["italic", "emphasis", "_"],
    autoPrefixes: ["_"],
    buildEdit: (context) => buildWrappedEdit(context, "_", "_", "emphasis")
  },
  {
    id: "strikethrough",
    label: "Strikethrough",
    detail: "~~removed text~~",
    keywords: ["strikethrough", "delete", "removed", "~~"],
    autoPrefixes: ["~~"],
    buildEdit: (context) => buildWrappedEdit(context, "~~", "~~", "removed text")
  },
  {
    id: "highlight",
    label: "Highlight",
    detail: "==highlight==",
    keywords: ["highlight", "mark", "=="],
    autoPrefixes: ["=="],
    buildEdit: (context) => buildWrappedEdit(context, "==", "==", "highlight")
  },
  {
    id: "inline-code",
    label: "Inline Code",
    detail: "`inline code`",
    keywords: ["code", "inline", "`"],
    autoPrefixes: ["`"],
    buildEdit: (context) => buildWrappedEdit(context, "`", "`", "code")
  },
  {
    id: "math-inline",
    label: "Inline Math",
    detail: "$E = mc^2$",
    keywords: ["math", "latex", "inline", "$"],
    autoPrefixes: ["$"],
    buildEdit: (context) => buildWrappedEdit(context, "$", "$", "E = mc^2")
  },
  {
    id: "math-block",
    label: "Math Block",
    detail: "$$",
    keywords: ["math", "latex", "block", "$$"],
    autoPrefixes: ["$$"],
    buildEdit: (context) => buildMathBlockEdit(context)
  },
  {
    id: "details",
    label: "Details Block",
    detail: "<details><summary>Summary</summary></details>",
    keywords: ["details", "summary", "fold", "collapse", "html"],
    autoPrefixes: ["<det", "<sum"],
    buildEdit: (context) => buildDetailsEdit(context)
  },
  {
    id: "html-comment",
    label: "HTML Comment",
    detail: "<!-- comment -->",
    keywords: ["comment", "html", "<!--"],
    autoPrefixes: ["<!--"],
    buildEdit: (context) => buildHtmlCommentEdit(context)
  }
];

const autocompleteItemIds = new Set([
  "heading-1",
  "heading-2",
  "heading-3",
  "bullet-list",
  "task-list",
  "task-list-done",
  "numbered-list",
  "blockquote",
  "link",
  "image",
  "bold",
  "italic",
  "strikethrough",
  "inline-code"
]);

const insertMenuItems: InsertMenuItem[] = [
  pickInsertMenuItem("horizontal-rule"),
  pickInsertMenuItem("code-fence"),
  pickInsertMenuItem("code-fence-ts"),
  pickInsertMenuItem("code-fence-js"),
  pickInsertMenuItem("code-fence-bash"),
  pickInsertMenuItem("code-fence-json"),
  pickInsertMenuItem("code-fence-rust"),
  pickInsertMenuItem("code-fence-python"),
  pickInsertMenuItem("table"),
  pickInsertMenuItem("table-alignment"),
  pickInsertMenuItem("reference-link"),
  pickInsertMenuItem("details")
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const savedSession = parseSavedDraftSession(localStorage.getItem(DRAFT_SESSION_KEY));
const savedDraft = localStorage.getItem(DRAFT_KEY);
const savedTitle = localStorage.getItem(TITLE_KEY);
const savedTheme = localStorage.getItem(THEME_KEY);
const savedZoom = localStorage.getItem(ZOOM_KEY);
const savedAutocompleteShortcut = localStorage.getItem(AUTOCOMPLETE_SHORTCUT_KEY);
const initialSession = buildInitialDraftSession(savedSession, savedTitle, savedDraft);
const initialActiveFile = initialSession.openFiles.find((file) => file.id === initialSession.activeFileId)
  ?? initialSession.openFiles[0];
const initialAutocompleteShortcutId = parseSavedAutocompleteShortcutId(savedAutocompleteShortcut);

const state: EditorState = {
  content: initialActiveFile.content,
  fileName: initialActiveFile.name,
  nativePath: initialActiveFile.nativePath,
  isDirty: initialActiveFile.isDirty,
  mode: "split",
  theme: savedTheme === "dark" ? "dark" : "light",
  isSidebarOpen: localStorage.getItem(SIDEBAR_KEY) !== "false",
  activeFileId: initialActiveFile.id,
  zoomPercent: parseSavedZoom(savedZoom),
  openFiles: initialSession.openFiles,
  autocompleteShortcutId: initialAutocompleteShortcutId
};

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="topbar-sidebar-zone">
        <button class="icon-button sidebar-toggle" data-action="toggle-sidebar" title="Toggle documents" aria-label="Toggle documents" aria-pressed="true">☰</button>
        <section class="document-meta" aria-label="Document details">
          <input class="title-input" value="${escapeAttribute(state.fileName)}" aria-label="File name" />
          <span class="save-state">Draft saved locally</span>
        </section>
      </div>

      <div class="topbar-editor-zone">
        <div class="file-actions" aria-label="File actions">
          <button class="text-button" data-action="new">New</button>
          <button class="text-button" data-action="open">Open</button>
          <button class="text-button" data-action="save">Save</button>
        </div>

        <nav class="toolbar" aria-label="Editor tools">
          <div class="toolbar-menu-shell">
            <button class="text-button menu-button" data-action="toggle-insert-menu" aria-haspopup="true" aria-expanded="false">
              Insert
            </button>
            <div class="insert-menu hidden" aria-hidden="true"></div>
          </div>
          <div class="segmented" role="group" aria-label="View mode">
            <button data-mode="write">Write</button>
            <button data-mode="split">Split</button>
            <button data-mode="preview">Read</button>
          </div>
          <div class="toolbar-menu-shell settings-shell">
            <button
              class="icon-button settings-button"
              data-action="toggle-settings-menu"
              aria-label="Open settings"
              title="Settings"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span class="settings-icon" aria-hidden="true">⚙</span>
            </button>
            <div class="settings-menu hidden" aria-hidden="true">
              <section class="settings-group" aria-label="Theme">
                <h3 class="settings-group-title">Theme</h3>
                <div class="settings-choice" role="group" aria-label="Theme mode">
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="light">Light</button>
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="dark">Dark</button>
                </div>
              </section>

              <section class="settings-group" aria-label="Document zoom">
                <h3 class="settings-group-title">Zoom</h3>
                <div class="font-controls settings-zoom-controls" role="group" aria-label="Document zoom">
                  <button class="font-button" data-action="font-decrease" aria-label="Zoom out document">A-</button>
                  <span class="font-size-label settings-zoom-label" aria-label="Current document zoom">100%</span>
                  <button class="font-button" data-action="font-increase" aria-label="Zoom in document">A+</button>
                </div>
              </section>

              <section class="settings-group" aria-label="Autocomplete shortcut">
                <h3 class="settings-group-title">Autocomplete</h3>
                <label class="settings-field">
                  <span class="settings-field-label">Trigger</span>
                  <select class="settings-shortcut-select" aria-label="Autocomplete shortcut"></select>
                </label>
              </section>
            </div>
          </div>
        </nav>
      </div>
    </header>

    <section class="main-area">
      <aside class="document-drawer" aria-label="Documents">
        <div class="drawer-panel">
          <section class="drawer-section">
            <div class="drawer-section-head">
              <span class="drawer-section-title">Open Documents</span>
              <span class="drawer-section-count">${state.openFiles.length}</span>
            </div>
            <ul class="document-list" aria-label="Open documents"></ul>
          </section>

          <section class="drawer-note" aria-label="Tips">
            <span class="drawer-note-title">Shortcuts</span>
            <p class="shortcut-copy"></p>
          </section>
        </div>
      </aside>

      <section class="workspace mode-split" aria-label="Markdown editor">
        <textarea class="editor" spellcheck="true" aria-label="Markdown source"></textarea>
        <article class="preview markdown-body" aria-label="Rendered preview"></article>
        <div class="autocomplete-panel hidden" aria-hidden="true">
          <div class="autocomplete-title">Markdown Syntax</div>
          <ul class="autocomplete-list" aria-label="Markdown suggestions"></ul>
        </div>
      </section>
    </section>

    <footer class="statusbar">
      <span class="stat words">0 words</span>
      <span class="stat characters">0 chars</span>
      <span class="stat lines">0 lines</span>
    </footer>

    <div class="dialog-backdrop hidden" aria-hidden="true">
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-close-title">
        <div class="confirm-dialog-copy">
          <h2 id="confirm-close-title" class="confirm-dialog-title">Save changes before closing?</h2>
          <p class="confirm-dialog-message"></p>
        </div>
        <div class="confirm-dialog-actions">
          <button class="text-button subtle-button" data-action="confirm-close-cancel">Cancel</button>
          <button class="text-button subtle-button" data-action="confirm-close-discard">Don't Save</button>
          <button class="text-button primary-button" data-action="confirm-close-save">Save</button>
        </div>
      </div>
    </div>
  </main>
`;

const appRoot = app;
const titleInput = requireElement<HTMLInputElement>(".title-input");
const saveState = requireElement<HTMLSpanElement>(".save-state");
const workspace = requireElement<HTMLElement>(".workspace");
const topbar = requireElement<HTMLElement>(".topbar");
const mainArea = requireElement<HTMLElement>(".main-area");
const sidebarToggle = requireElement<HTMLButtonElement>(".sidebar-toggle");
const documentList = requireElement<HTMLUListElement>(".document-list");
const editor = requireElement<HTMLTextAreaElement>(".editor");
const preview = requireElement<HTMLElement>(".preview");
const autocompletePanel = requireElement<HTMLDivElement>(".autocomplete-panel");
const autocompleteList = requireElement<HTMLUListElement>(".autocomplete-list");
const insertMenuButton = requireElement<HTMLButtonElement>(".menu-button");
const insertMenu = requireElement<HTMLDivElement>(".insert-menu");
const settingsMenuButton = requireElement<HTMLButtonElement>(".settings-button");
const settingsMenu = requireElement<HTMLDivElement>(".settings-menu");
const wordStat = requireElement<HTMLSpanElement>(".words");
const charStat = requireElement<HTMLSpanElement>(".characters");
const lineStat = requireElement<HTMLSpanElement>(".lines");
const themeOptionButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-action='set-theme']"));
const fontDecreaseButton = requireElement<HTMLButtonElement>("[data-action='font-decrease']");
const fontIncreaseButton = requireElement<HTMLButtonElement>("[data-action='font-increase']");
const fontSizeLabel = requireElement<HTMLSpanElement>(".font-size-label");
const shortcutSelect = requireElement<HTMLSelectElement>(".settings-shortcut-select");
const documentCount = requireElement<HTMLSpanElement>(".drawer-section-count");
const shortcutCopy = requireElement<HTMLParagraphElement>(".shortcut-copy");
const dialogBackdrop = requireElement<HTMLDivElement>(".dialog-backdrop");
const confirmDialogMessage = requireElement<HTMLParagraphElement>(".confirm-dialog-message");
const confirmCloseSaveButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-save']");
const modeButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-mode]"));

let activeScrollSource: "editor" | "preview" = "editor";
let programmaticScrollSource: "editor" | "preview" | null = null;
let pendingCloseRequest: PendingCloseRequest | null = null;
let isInsertMenuOpen = false;
let isSettingsMenuOpen = false;
const autocompleteState: EditorAutocompleteState = {
  isOpen: false,
  items: [],
  activeIndex: 0,
  manual: false,
  interactionMode: "keyboard",
  anchorTop: 0,
  anchorLeft: 0
};

editor.value = state.content;
void setupMenuListener();
render();
persistDraft();

window.addEventListener("resize", () => {
  updateInsertMenuPosition();
  updateAutocompletePosition();
});

insertMenuButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openInsertMenu(0);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    openInsertMenu(insertMenuItems.length - 1);
  }
});

insertMenu.addEventListener("keydown", (event) => {
  if (!isInsertMenuOpen) {
    return;
  }

  const buttons = getInsertMenuButtons();

  if (buttons.length === 0) {
    return;
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement);

  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusInsertMenuItem((currentIndex + 1 + buttons.length) % buttons.length);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusInsertMenuItem((currentIndex - 1 + buttons.length) % buttons.length);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    focusInsertMenuItem(0);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    focusInsertMenuItem(buttons.length - 1);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeInsertMenu(true);
  }
});

settingsMenuButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openSettingsMenu();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    openSettingsMenu(true);
  }
});

settingsMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSettingsMenu(true);
  }
});

shortcutSelect.addEventListener("change", () => {
  setAutocompleteShortcut(shortcutSelect.value);
});

editor.addEventListener("input", () => {
  state.content = editor.value;
  state.isDirty = true;
  activeScrollSource = "editor";
  persistDraft();
  syncActiveFile();
  render();
  refreshAutocomplete(false);
});

editor.addEventListener("scroll", () => {
  if (programmaticScrollSource === "editor" || state.mode !== "split") {
    return;
  }

  syncScroll(editor, preview, "editor");
  updateAutocompletePosition();
});

preview.addEventListener("scroll", () => {
  if (programmaticScrollSource === "preview" || state.mode !== "split") {
    return;
  }

  syncScroll(preview, editor, "preview");
});

editor.addEventListener("keydown", (event) => {
  if (handleAutocompleteKeyboard(event)) {
    return;
  }

  handleMarkdownContinuation(event);
});

editor.addEventListener("click", () => {
  refreshAutocomplete(false);
});

editor.addEventListener("keyup", (event) => {
  if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
    refreshAutocomplete(autocompleteState.manual);
  }
});

editor.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (document.activeElement !== editor) {
      closeAutocomplete();
    }
  }, 120);
});

autocompletePanel.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

autocompleteList.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>("[data-index]")
    : null;

  if (!target) {
    return;
  }

  const nextIndex = Number(target.dataset.index);

  if (!Number.isInteger(nextIndex)) {
    return;
  }

  applyAutocompleteItem(nextIndex);
});

autocompleteList.addEventListener("mousemove", (event) => {
  const target = event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>("[data-index]")
    : null;

  if (!target) {
    return;
  }

  const nextIndex = Number(target.dataset.index);

  if (!Number.isInteger(nextIndex) || nextIndex === autocompleteState.activeIndex) {
    return;
  }

  autocompleteState.interactionMode = "pointer";
  autocompleteState.activeIndex = nextIndex;
  renderAutocomplete();
});

autocompleteList.addEventListener("mouseleave", () => {
  if (!autocompleteState.isOpen) {
    return;
  }

  autocompleteState.interactionMode = "keyboard";
  renderAutocomplete();
});

titleInput.addEventListener("input", () => {
  state.fileName = normalizeFileName(titleInput.value);
  state.isDirty = true;
  syncActiveFile();
  persistDraft();
  render();
});

app.addEventListener("click", async (event) => {
  const target = event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>("[data-action], [data-mode]")
    : null;

  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const mode = target.dataset.mode as ViewMode | undefined;

  if (mode) {
    setMode(mode);
    return;
  }

  if (action === "new") {
    createNewDocument();
    return;
  }

  if (action === "open") {
    await openDocument();
    return;
  }

  if (action === "save") {
    await saveDocument();
    return;
  }

  if (action === "toggle-insert-menu") {
    toggleInsertMenu();
    return;
  }

  if (action === "insert-snippet" && target.dataset.insertId) {
    applyInsertMenuItem(target.dataset.insertId);
    return;
  }

  if (action === "toggle-settings-menu") {
    toggleSettingsMenu();
    return;
  }

  if (action === "set-theme" && target.dataset.themeValue) {
    setTheme(target.dataset.themeValue as ThemeMode);
    return;
  }

  if (action === "font-decrease") {
    changeZoom(-1);
    return;
  }

  if (action === "font-increase") {
    changeZoom(1);
    return;
  }

  if (action === "toggle-sidebar") {
    toggleSidebar();
    return;
  }

  if (action === "select-file" && target.dataset.fileId) {
    selectOpenFile(target.dataset.fileId);
    return;
  }

  if (action === "close-file" && target.dataset.fileId) {
    await requestCloseFile(target.dataset.fileId);
    return;
  }

  if (action === "confirm-close-cancel") {
    closeConfirmDialog();
    return;
  }

  if (action === "confirm-close-discard") {
    discardPendingClose();
    return;
  }

  if (action === "confirm-close-save") {
    await saveAndClosePendingFile();
  }
});

document.addEventListener("keydown", async (event) => {
  if (event.key === "Escape" && isSettingsMenuOpen) {
    event.preventDefault();
    closeSettingsMenu(true);
    return;
  }

  if (event.key === "Escape" && isInsertMenuOpen) {
    event.preventDefault();
    closeInsertMenu(true);
    return;
  }

  if (event.key === "Escape" && pendingCloseRequest) {
    event.preventDefault();
    closeConfirmDialog();
    return;
  }

  const isCommand = event.metaKey || event.ctrlKey;

  if (!isCommand) {
    return;
  }

  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    await (event.shiftKey ? saveDocumentAs() : saveDocument());
  }

  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    await openDocument();
  }

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNewDocument();
  }
});

dialogBackdrop.addEventListener("click", (event) => {
  if (event.target === dialogBackdrop) {
    closeConfirmDialog();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement ? event.target : null;

  if (isInsertMenuOpen && !target?.closest(".toolbar-menu-shell")) {
    closeInsertMenu();
  }

  if (isSettingsMenuOpen && !target?.closest(".settings-shell")) {
    closeSettingsMenu();
  }
});

function render() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(state.content, { async: false }));
  renderStats();
  renderMode();
  renderTheme();
  renderZoom();
  renderDocuments();
  renderInsertMenu();
  renderSettingsMenu();
  renderShortcuts();
  renderSaveState();
  renderAutocomplete();
  requestAnimationFrame(() => {
    syncActiveScroll();
    updateAutocompletePosition();
  });
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

function renderStats() {
  const words = state.content.trim().match(/[\p{L}\p{N}_'-]+/gu)?.length ?? 0;
  const characters = state.content.length;
  const lines = state.content.length === 0 ? 0 : state.content.split(/\r\n|\r|\n/).length;

  wordStat.textContent = `${words} words`;
  charStat.textContent = `${characters} chars`;
  lineStat.textContent = `${lines} lines`;
}

function renderMode() {
  workspace.className = `workspace mode-${state.mode}`;

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  }

  if (state.mode === "preview") {
    closeAutocomplete();
  }
}

function renderSaveState(message?: string) {
  const pathLabel = state.nativePath ? formatPathForDisplay(state.nativePath) : "Local draft";

  if (message) {
    saveState.textContent = `${message} · ${pathLabel}`;
    return;
  }

  saveState.textContent = `${state.isDirty ? "Unsaved changes" : "Saved"} · ${pathLabel}`;
}

function renderDocuments() {
  topbar.classList.toggle("sidebar-closed", !state.isSidebarOpen);
  mainArea.classList.toggle("sidebar-closed", !state.isSidebarOpen);
  sidebarToggle.setAttribute("aria-pressed", String(state.isSidebarOpen));
  sidebarToggle.classList.toggle("active", state.isSidebarOpen);
  documentCount.textContent = String(state.openFiles.length);

  documentList.innerHTML = state.openFiles
    .map((file) => {
      const isActive = file.id === state.activeFileId;
      const activeClass = isActive ? " active" : "";
      const dirtyMark = file.isDirty ? "<span class=\"dirty-mark\" aria-hidden=\"true\" title=\"Unsaved changes\"></span>" : "";
      const subtitle = file.nativePath ? escapeHtml(formatPathForDisplay(file.nativePath)) : "Local draft";
      const icon = escapeHtml(documentInitial(file.name));

      return `
        <li class="document-row${activeClass}">
          <button class="document-item${activeClass}" data-action="select-file" data-file-id="${file.id}" title="${escapeAttribute(file.name)}" aria-label="${escapeAttribute(file.name)}">
            <span class="document-icon" aria-hidden="true">${icon}</span>
            <span class="document-copy">
              <span class="document-name">${escapeHtml(file.name)}</span>
              <span class="document-path">${subtitle}</span>
            </span>
            ${dirtyMark}
          </button>
          <button class="file-close" data-action="close-file" data-file-id="${file.id}" aria-label="Close ${escapeAttribute(file.name)}">×</button>
        </li>
      `;
    })
    .join("");
}

function renderShortcuts() {
  shortcutCopy.innerHTML = buildShortcutMarkup();
}

function renderInsertMenu() {
  insertMenuButton.setAttribute("aria-expanded", String(isInsertMenuOpen));
  insertMenu.classList.toggle("hidden", !isInsertMenuOpen);
  insertMenu.setAttribute("aria-hidden", String(!isInsertMenuOpen));
  insertMenu.setAttribute("tabindex", isInsertMenuOpen ? "0" : "-1");

  insertMenu.innerHTML = insertMenuItems
    .map((item, index) => `
      <button class="insert-menu-item" type="button" tabindex="-1" data-index="${index}" data-action="insert-snippet" data-insert-id="${item.id}">
        <span class="insert-menu-copy">
          <span class="insert-menu-label">${escapeHtml(item.label)}</span>
          <span class="insert-menu-detail">${escapeHtml(item.detail)}</span>
        </span>
      </button>
    `)
    .join("");

  updateInsertMenuPosition();
}

function renderSettingsMenu() {
  settingsMenuButton.setAttribute("aria-expanded", String(isSettingsMenuOpen));
  settingsMenu.classList.toggle("hidden", !isSettingsMenuOpen);
  settingsMenu.setAttribute("aria-hidden", String(!isSettingsMenuOpen));
  settingsMenu.setAttribute("tabindex", isSettingsMenuOpen ? "0" : "-1");
  renderThemeOptions();
  renderShortcutOptions();
}

function renderThemeOptions() {
  for (const button of themeOptionButtons) {
    const themeValue = button.dataset.themeValue;
    const isActive = themeValue === state.theme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderShortcutOptions() {
  const availableOptions = getAvailableAutocompleteShortcutOptions();

  if (!availableOptions.some((option) => option.id === state.autocompleteShortcutId)) {
    state.autocompleteShortcutId = parseSavedAutocompleteShortcutId(null);
    localStorage.setItem(AUTOCOMPLETE_SHORTCUT_KEY, state.autocompleteShortcutId);
  }

  const shortcutOptionsMarkup = availableOptions
    .map((option) => {
      const label = escapeHtml(getShortcutOptionLabel(option));
      const selected = option.id === state.autocompleteShortcutId ? " selected" : "";
      return `<option value="${escapeAttribute(option.id)}"${selected}>${label}</option>`;
    })
    .join("");

  shortcutSelect.innerHTML = shortcutOptionsMarkup;
  shortcutSelect.value = state.autocompleteShortcutId;
}

function renderAutocomplete() {
  const canShow = autocompleteState.isOpen
    && autocompleteState.items.length > 0
    && state.mode !== "preview";

  autocompletePanel.classList.toggle("hidden", !canShow);
  autocompletePanel.setAttribute("aria-hidden", String(!canShow));

  if (!canShow) {
    autocompleteList.innerHTML = "";
    return;
  }

  autocompleteList.innerHTML = autocompleteState.items
    .map((item, index) => {
      const activeClass = index === autocompleteState.activeIndex ? " active" : "";
      const pointerSelected = autocompleteState.interactionMode === "pointer" && index === autocompleteState.activeIndex
        ? " data-pointer-selected=\"true\""
        : "";

      return `
        <li>
          <button class="autocomplete-item${activeClass}" data-index="${index}" type="button"${pointerSelected}>
            <span class="autocomplete-copy">
              <span class="autocomplete-label">${escapeHtml(item.label)}</span>
              <span class="autocomplete-detail">${escapeHtml(item.detail)}</span>
            </span>
          </button>
        </li>
      `;
    })
    .join("");

  autocompletePanel.style.top = `${autocompleteState.anchorTop}px`;
  autocompletePanel.style.left = `${autocompleteState.anchorLeft}px`;
  ensureAutocompleteItemVisible();
}

function ensureAutocompleteItemVisible() {
  if (!autocompleteState.isOpen) {
    return;
  }

  const activeItem = autocompleteList.querySelector<HTMLElement>(".autocomplete-item.active");

  if (!activeItem) {
    return;
  }

  activeItem.scrollIntoView({
    block: "nearest"
  });
}

function openConfirmDialog(message: string) {
  confirmDialogMessage.textContent = message;
  dialogBackdrop.classList.remove("hidden");
  dialogBackdrop.setAttribute("aria-hidden", "false");
  confirmCloseSaveButton.focus();
}

function closeConfirmDialog() {
  pendingCloseRequest = null;
  dialogBackdrop.classList.add("hidden");
  dialogBackdrop.setAttribute("aria-hidden", "true");
}

function setMode(mode: ViewMode) {
  state.mode = mode;
  renderMode();
}

function renderTheme() {
  document.documentElement.dataset.theme = state.theme;
  renderThemeOptions();
}

function setTheme(theme: ThemeMode) {
  if (theme !== "light" && theme !== "dark") {
    return;
  }

  state.theme = theme;
  localStorage.setItem(THEME_KEY, state.theme);
  renderTheme();
}

function renderZoom() {
  document.documentElement.style.setProperty("--content-scale", `${state.zoomPercent / 100}`);
  fontSizeLabel.textContent = `${state.zoomPercent}%`;
  fontDecreaseButton.disabled = state.zoomPercent <= MIN_ZOOM_PERCENT;
  fontIncreaseButton.disabled = state.zoomPercent >= MAX_ZOOM_PERCENT;
}

function changeZoom(delta: number) {
  state.zoomPercent = clampZoom(state.zoomPercent + delta * ZOOM_STEP);
  localStorage.setItem(ZOOM_KEY, String(state.zoomPercent));
  renderZoom();
  requestAnimationFrame(() => {
    syncActiveScroll();
  });
}

function resetZoom() {
  state.zoomPercent = DEFAULT_ZOOM_PERCENT;
  localStorage.setItem(ZOOM_KEY, String(state.zoomPercent));
  renderZoom();
  requestAnimationFrame(() => {
    syncActiveScroll();
  });
}

function createNewDocument() {
  const file = createOpenFile("Untitled.md", "", false);

  state.openFiles.push(file);
  activateFile(file.id);
  closeAutocomplete();
  render();
  editor.focus();
}

async function openDocument() {
  try {
    const file = await invoke<TauriMarkdownFile | null>("open_markdown_file");

    if (!file) {
      return;
    }

    loadNativeFile(file);
  } catch (error) {
    console.error(error);
    renderSaveState("Could not open file");
  }
}

async function saveDocument() {
  return saveCurrentDocument();
}

async function saveDocumentAs() {
  return saveCurrentDocument(true);
}

async function saveCurrentDocument(forceDialog = false) {
  try {
    const savedFile = await invoke<TauriSavedMarkdownFile | null>("save_markdown_file", {
      path: forceDialog ? null : state.nativePath,
      suggestedName: state.fileName,
      content: state.content
    });

    if (!savedFile) {
      return;
    }

    state.fileName = savedFile.name;
    state.nativePath = savedFile.path;
    titleInput.value = state.fileName;
    markSaved();
    return true;
  } catch (error) {
    console.error(error);
    renderSaveState("Could not save file");
    return false;
  }
}

function loadNativeFile(file: TauriMarkdownFile) {
  const existingIndex = state.openFiles.findIndex((item) => item.nativePath === file.path);

  if (existingIndex >= 0) {
    state.openFiles[existingIndex] = {
      ...state.openFiles[existingIndex],
      name: file.name,
      content: file.content,
      nativePath: file.path,
      isDirty: false
    };
    activateFile(state.openFiles[existingIndex].id);
  } else {
    const openFile = createOpenFile(file.name, file.content, false, file.path);
    state.openFiles.push(openFile);
    activateFile(openFile.id);
  }

  closeAutocomplete();
  render();
}

function persistDraft() {
  const openFiles = state.openFiles.map((file) => {
    if (file.id !== state.activeFileId) {
      return {
        ...file
      };
    }

    return {
      ...file,
      name: state.fileName,
      content: state.content,
      nativePath: state.nativePath,
      isDirty: state.isDirty
    };
  });

  const session: DraftSession = {
    version: DRAFT_SESSION_VERSION,
    activeFileId: state.activeFileId,
    openFiles
  };

  localStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(DRAFT_KEY, state.content);
  localStorage.setItem(TITLE_KEY, state.fileName);
}

function markSaved(message = "Saved") {
  state.isDirty = false;
  syncActiveFile();
  persistDraft();
  renderDocuments();
  renderSaveState(message);
}

function createOpenFile(
  name: string,
  content: string,
  isDirty: boolean,
  nativePath: string | null = null
): OpenFile {
  return {
    id: crypto.randomUUID(),
    name,
    content,
    nativePath,
    isDirty
  };
}

function activateFile(fileId: string) {
  const file = state.openFiles.find((item) => item.id === fileId);

  if (!file) {
    return;
  }

  state.activeFileId = file.id;
  state.content = file.content;
  state.fileName = file.name;
  state.nativePath = file.nativePath;
  state.isDirty = file.isDirty;
  activeScrollSource = "editor";
  editor.value = file.content;
  titleInput.value = file.name;
  closeAutocomplete();
  persistDraft();
}

function syncActiveFile() {
  const file = state.openFiles.find((item) => item.id === state.activeFileId);

  if (!file) {
    return;
  }

  file.content = state.content;
  file.name = state.fileName;
  file.nativePath = state.nativePath;
  file.isDirty = state.isDirty;
}

function selectOpenFile(fileId: string) {
  syncActiveFile();
  activateFile(fileId);
  render();
  editor.focus();
}

async function requestCloseFile(fileId: string) {
  const file = state.openFiles.find((item) => item.id === fileId);

  if (!file) {
    return;
  }

  if (!file.isDirty) {
    closeOpenFile(fileId);
    return;
  }

  pendingCloseRequest = { fileId };
  openConfirmDialog(`"${file.name}" has unsaved changes. Save before closing?`);
}

async function requestCloseActiveFile() {
  await requestCloseFile(state.activeFileId);
}

function closeOpenFile(fileId: string) {
  const index = state.openFiles.findIndex((item) => item.id === fileId);

  if (index < 0) {
    return;
  }

  state.openFiles.splice(index, 1);

  if (state.openFiles.length === 0) {
    const file = createOpenFile("Untitled.md", "", false);
    state.openFiles.push(file);
    activateFile(file.id);
  } else if (state.activeFileId === fileId) {
    const nextFile = state.openFiles[Math.max(0, index - 1)];
    activateFile(nextFile.id);
  }

  persistDraft();
  render();
}

function discardPendingClose() {
  if (!pendingCloseRequest) {
    return;
  }

  const { fileId } = pendingCloseRequest;
  closeConfirmDialog();
  closeOpenFile(fileId);
}

async function saveAndClosePendingFile() {
  if (!pendingCloseRequest) {
    return;
  }

  const targetFile = state.openFiles.find((item) => item.id === pendingCloseRequest?.fileId);

  if (!targetFile) {
    closeConfirmDialog();
    return;
  }

  const activeFileBeforeSave = state.activeFileId;

  if (targetFile.id !== state.activeFileId) {
    syncActiveFile();
    activateFile(targetFile.id);
    render();
  }

  const didSave = await saveCurrentDocument();

  if (!didSave) {
    if (activeFileBeforeSave !== state.activeFileId) {
      const previousFile = state.openFiles.find((item) => item.id === activeFileBeforeSave);
      if (previousFile) {
        activateFile(previousFile.id);
        render();
      }
    }
    return;
  }

  const fileId = pendingCloseRequest.fileId;
  closeConfirmDialog();
  closeOpenFile(fileId);
}

function toggleSidebar() {
  state.isSidebarOpen = !state.isSidebarOpen;
  localStorage.setItem(SIDEBAR_KEY, String(state.isSidebarOpen));
  renderDocuments();
}

function toggleInsertMenu() {
  if (isInsertMenuOpen) {
    closeInsertMenu(true);
    return;
  }

  openInsertMenu(0);
}

function openInsertMenu(focusIndex = 0) {
  isInsertMenuOpen = true;
  closeSettingsMenu();
  closeAutocomplete();
  renderInsertMenu();
  updateInsertMenuPosition();
  window.setTimeout(() => {
    focusInsertMenuItem(focusIndex);
  }, 0);
}

function closeInsertMenu(restoreFocus = false) {
  if (!isInsertMenuOpen) {
    return;
  }

  isInsertMenuOpen = false;
  renderInsertMenu();
  insertMenu.style.left = "";
  insertMenu.style.top = "";
  insertMenu.style.width = "";
  insertMenu.style.maxHeight = "";

  if (restoreFocus) {
    insertMenuButton.focus();
  }
}

function updateInsertMenuPosition() {
  if (!isInsertMenuOpen) {
    return;
  }

  const viewportPadding = 16;
  const verticalGap = 10;
  const buttonRect = insertMenuButton.getBoundingClientRect();
  const menuWidth = Math.min(340, Math.max(220, window.innerWidth - viewportPadding * 2));
  const maxLeft = window.innerWidth - viewportPadding - menuWidth;
  const left = Math.max(viewportPadding, Math.min(buttonRect.left, maxLeft));
  const preferredTop = buttonRect.bottom + verticalGap;
  const minUsableHeight = 180;
  const clampedTop = Math.min(
    preferredTop,
    Math.max(viewportPadding, window.innerHeight - viewportPadding - minUsableHeight)
  );
  const maxHeight = Math.max(
    140,
    Math.min(360, window.innerHeight - clampedTop - viewportPadding)
  );

  insertMenu.style.left = `${Math.round(left)}px`;
  insertMenu.style.top = `${Math.round(clampedTop)}px`;
  insertMenu.style.width = `${Math.round(menuWidth)}px`;
  insertMenu.style.maxHeight = `${Math.round(maxHeight)}px`;
}

function applyInsertMenuItem(insertId: string) {
  const item = insertMenuItems.find((entry) => entry.id === insertId);

  if (!item) {
    return;
  }

  if (state.mode === "preview") {
    setMode("write");
  }

  const context = getEditorAutocompleteContext();
  const edit = item.buildEdit(context);
  applyEditorEdit(adjustInsertEditForBlock(context, edit));
  closeInsertMenu();
}

function adjustInsertEditForBlock(
  context: EditorAutocompleteContext,
  edit: EditorSelectionEdit
): EditorSelectionEdit {
  if (context.currentLine.trim().length === 0) {
    return edit;
  }

  const insertionPoint = context.lineEnd;
  const beforeText = context.value.slice(0, insertionPoint);
  const afterText = context.value.slice(insertionPoint);
  const prefix = beforeText.endsWith("\n") ? "" : "\n";
  const suffix = afterText.length === 0
    ? ""
    : afterText.startsWith("\n\n")
      ? ""
      : afterText.startsWith("\n")
        ? "\n"
        : "\n\n";
  const selectionStartOffset = (edit.selectionStart ?? (edit.start + edit.text.length)) - edit.start;
  const selectionEndOffset = (edit.selectionEnd ?? (edit.start + edit.text.length)) - edit.start;

  return {
    start: insertionPoint,
    end: insertionPoint,
    text: `${prefix}${edit.text}${suffix}`,
    selectionStart: insertionPoint + prefix.length + selectionStartOffset,
    selectionEnd: insertionPoint + prefix.length + selectionEndOffset
  };
}

function getInsertMenuButtons() {
  return Array.from(insertMenu.querySelectorAll<HTMLButtonElement>(".insert-menu-item"));
}

function focusInsertMenuItem(index: number) {
  const buttons = getInsertMenuButtons();
  const target = buttons[index];

  if (!target) {
    insertMenu.focus();
    return;
  }

  target.focus();
}

function handleAutocompleteKeyboard(event: KeyboardEvent) {
  const isManualTrigger = isAutocompleteTriggerEvent(event);

  if (isManualTrigger) {
    event.preventDefault();
    refreshAutocomplete(true);
    return true;
  }

  if (!autocompleteState.isOpen) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    autocompleteState.interactionMode = "keyboard";
    autocompleteState.activeIndex = (autocompleteState.activeIndex + 1) % autocompleteState.items.length;
    renderAutocomplete();
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    autocompleteState.interactionMode = "keyboard";
    autocompleteState.activeIndex =
      (autocompleteState.activeIndex - 1 + autocompleteState.items.length) % autocompleteState.items.length;
    renderAutocomplete();
    return true;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyAutocompleteItem(autocompleteState.activeIndex);
    return true;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeAutocomplete();
    return true;
  }

  return false;
}

function isAutocompleteTriggerEvent(event: KeyboardEvent) {
  const shortcut = getAvailableAutocompleteShortcutOptions().find((option) => option.id === state.autocompleteShortcutId)
    ?? getAvailableAutocompleteShortcutOptions()[0];

  return event.code === shortcut.code
    && event.shiftKey === shortcut.shift
    && event.ctrlKey === shortcut.ctrl
    && event.altKey === shortcut.alt
    && event.metaKey === shortcut.meta;
}

function handleMarkdownContinuation(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  const context = getEditorAutocompleteContext();
  const nextText = buildMarkdownContinuation(context.currentLine);

  if (nextText === null) {
    return false;
  }

  event.preventDefault();
  applyEditorEdit({
    start: context.selectionStart,
    end: context.selectionEnd,
    text: `\n${nextText}`
  });
  closeAutocomplete();
  return true;
}

function refreshAutocomplete(manual: boolean) {
  if (state.mode === "preview") {
    closeAutocomplete();
    return;
  }

  const context = getEditorAutocompleteContext();
  const items = getAutocompleteItems(context, manual);

  if (items.length === 0) {
    closeAutocomplete();
    return;
  }

  if (!manual && !hasAutocompleteTrigger(context)) {
    closeAutocomplete();
    return;
  }

  autocompleteState.isOpen = true;
  autocompleteState.items = items;
  autocompleteState.manual = manual;
  autocompleteState.interactionMode = "keyboard";
  autocompleteState.activeIndex = Math.min(autocompleteState.activeIndex, items.length - 1);
  updateAutocompletePosition();
  renderAutocomplete();
}

function closeAutocomplete() {
  autocompleteState.isOpen = false;
  autocompleteState.items = [];
  autocompleteState.activeIndex = 0;
  autocompleteState.manual = false;
  autocompleteState.interactionMode = "keyboard";
  renderAutocomplete();
}

function getAutocompleteItems(context: EditorAutocompleteContext, manual: boolean) {
  const query = normalizeAutocompleteQuery(context.token);
  const sourceItems = editorAutocompleteItems.filter((item) => autocompleteItemIds.has(item.id));

  if (manual) {
    return sourceItems.filter((item) => matchesAutocompleteQuery(item, query));
  }

  return sourceItems.filter((item) => item.autoPrefixes.some((prefix) => matchesAutoPrefix(context, prefix)));
}

function hasAutocompleteTrigger(context: EditorAutocompleteContext) {
  return editorAutocompleteItems
    .filter((item) => autocompleteItemIds.has(item.id))
    .some((item) => item.autoPrefixes.some((prefix) => matchesAutoPrefix(context, prefix)));
}

function matchesAutocompleteQuery(item: EditorAutocompleteItem, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [item.label, item.detail, ...item.keywords].join(" ").toLowerCase();
  return haystack.includes(query);
}

function normalizeAutocompleteQuery(query: string) {
  return query.replace(/^[^\p{L}\p{N}]+/u, "").toLowerCase();
}

function matchesAutoPrefix(context: EditorAutocompleteContext, prefix: string) {
  if (prefix.length === 0) {
    return false;
  }

  if (context.trimmedLine === prefix || context.token === prefix) {
    return true;
  }

  if (!prefix.includes(" ")) {
    return false;
  }

  return context.beforeLineCursor.trimEnd().endsWith(prefix);
}

function applyAutocompleteItem(index: number) {
  const item = autocompleteState.items[index];

  if (!item) {
    return;
  }

  const edit = item.buildEdit(getEditorAutocompleteContext());
  applyEditorEdit(edit);
  closeAutocomplete();
}

function applyEditorEdit(edit: EditorSelectionEdit) {
  const nextValue = editor.value.slice(0, edit.start) + edit.text + editor.value.slice(edit.end);

  editor.value = nextValue;
  const nextSelectionStart = edit.selectionStart ?? edit.start + edit.text.length;
  const nextSelectionEnd = edit.selectionEnd ?? nextSelectionStart;

  syncTextFieldState(editor);
  editor.focus();
  editor.setSelectionRange(nextSelectionStart, nextSelectionEnd);
}

function getEditorAutocompleteContext(): EditorAutocompleteContext {
  const value = editor.value;
  const selectionStart = editor.selectionStart ?? 0;
  const selectionEnd = editor.selectionEnd ?? selectionStart;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextLineBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const currentLine = value.slice(lineStart, lineEnd);
  const beforeLineCursor = value.slice(lineStart, selectionStart);
  const afterLineCursor = value.slice(selectionEnd, lineEnd);
  const trimmedLine = beforeLineCursor.trim();
  const tokenMatch = beforeLineCursor.match(/([^\s]+)$/);
  const token = tokenMatch?.[1] ?? "";
  const tokenStart = tokenMatch ? selectionStart - token.length : selectionStart;

  return {
    value,
    selectionStart,
    selectionEnd,
    selectedText,
    lineStart,
    lineEnd,
    currentLine,
    beforeLineCursor,
    afterLineCursor,
    trimmedLine,
    token,
    tokenStart,
    tokenEnd: selectionStart
  };
}

function updateAutocompletePosition() {
  if (!autocompleteState.isOpen) {
    return;
  }

  const { top, left } = getEditorCaretPosition();
  const editorRect = editor.getBoundingClientRect();
  const panelWidth = 320;
  const panelHeight = 260;
  const viewportPadding = 16;

  autocompleteState.anchorTop = Math.min(top + 18, window.innerHeight - panelHeight - viewportPadding);
  autocompleteState.anchorLeft = Math.min(
    left,
    Math.max(viewportPadding, editorRect.right - panelWidth - 12)
  );

  renderAutocomplete();
}

function getEditorCaretPosition() {
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const editorStyle = window.getComputedStyle(editor);
  const editorRect = editor.getBoundingClientRect();
  const propertiesToCopy = [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "textAlign"
  ] as const;

  mirror.style.position = "fixed";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";

  for (const property of propertiesToCopy) {
    mirror.style[property] = editorStyle[property];
  }

  mirror.textContent = editor.value.slice(0, editor.selectionStart ?? 0);
  marker.textContent = editor.value.slice(editor.selectionStart ?? 0, (editor.selectionStart ?? 0) + 1) || " ";
  mirror.append(marker);
  document.body.append(mirror);

  const top = editorRect.top + marker.offsetTop - editor.scrollTop;
  const left = editorRect.left + marker.offsetLeft - editor.scrollLeft;

  mirror.remove();

  return { top, left };
}

function buildMarkdownContinuation(currentLine: string) {
  const taskMatch = currentLine.match(/^(\s*)[-*+]\s\[( |x|X)\]\s?(.*)$/);

  if (taskMatch) {
    if (taskMatch[3].trim().length === 0) {
      return "";
    }

    return `${taskMatch[1]}- [ ] `;
  }

  const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);

  if (bulletMatch) {
    if (bulletMatch[3].trim().length === 0) {
      return "";
    }

    return `${bulletMatch[1]}${bulletMatch[2]} `;
  }

  const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

  if (orderedMatch) {
    if (orderedMatch[3].trim().length === 0) {
      return "";
    }

    return `${orderedMatch[1]}${Number(orderedMatch[2]) + 1}. `;
  }

  const quoteMatch = currentLine.match(/^(\s*)>\s?(.*)$/);

  if (quoteMatch) {
    if (quoteMatch[2].trim().length === 0) {
      return "";
    }

    return `${quoteMatch[1]}> `;
  }

  return null;
}

async function setupMenuListener() {
  await listen<string>("app-menu-action", async (event) => {
    switch (event.payload) {
      case "file.new":
        createNewDocument();
        break;
      case "file.open":
        await openDocument();
        break;
      case "file.save":
        await saveDocument();
        break;
      case "file.save_as":
        await saveDocumentAs();
        break;
      case "file.close":
        await requestCloseActiveFile();
        break;
      case "view.write":
        setMode("write");
        break;
      case "view.split":
        setMode("split");
        break;
      case "view.preview":
        setMode("preview");
        break;
      case "view.zoom_in":
        changeZoom(1);
        break;
      case "view.zoom_out":
        changeZoom(-1);
        break;
      case "view.actual_size":
        resetZoom();
        break;
      case "view.toggle_sidebar":
        toggleSidebar();
        break;
      case "view.toggle_theme":
        setTheme(state.theme === "light" ? "dark" : "light");
        break;
      case "edit.undo":
        await performEditorAction("undo");
        break;
      case "edit.redo":
        await performEditorAction("redo");
        break;
      case "edit.cut":
        await performEditorAction("cut");
        break;
      case "edit.copy":
        await performEditorAction("copy");
        break;
      case "edit.paste":
        await performEditorAction("paste");
        break;
      case "edit.select_all":
        await performEditorAction("selectAll");
        break;
      default:
        break;
    }
  });
}

function toggleSettingsMenu() {
  if (isSettingsMenuOpen) {
    closeSettingsMenu(true);
    return;
  }

  openSettingsMenu();
}

function openSettingsMenu(focusLast = false) {
  isSettingsMenuOpen = true;
  closeInsertMenu();
  closeAutocomplete();
  renderSettingsMenu();
  window.setTimeout(() => {
    focusSettingsControl(focusLast);
  }, 0);
}

function closeSettingsMenu(restoreFocus = false) {
  if (!isSettingsMenuOpen) {
    return;
  }

  isSettingsMenuOpen = false;
  renderSettingsMenu();

  if (restoreFocus) {
    settingsMenuButton.focus();
  }
}

function focusSettingsControl(focusLast = false) {
  const controls = getSettingsControls();

  if (controls.length === 0) {
    settingsMenu.focus();
    return;
  }

  const target = focusLast ? controls[controls.length - 1] : controls[0];
  target.focus();
}

function getSettingsControls() {
  return Array.from(settingsMenu.querySelectorAll<HTMLElement>(
    "button.settings-option-button, button.font-button, select.settings-shortcut-select"
  ));
}

function setAutocompleteShortcut(nextId: string) {
  const option = getAvailableAutocompleteShortcutOptions().find((entry) => entry.id === nextId);

  if (!option) {
    return;
  }

  state.autocompleteShortcutId = option.id;
  localStorage.setItem(AUTOCOMPLETE_SHORTCUT_KEY, option.id);
  renderSettingsMenu();
  renderShortcuts();
}

async function performEditorAction(
  action: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"
) {
  const activeElement = document.activeElement;
  const target = isTextField(activeElement) ? activeElement : editor;

  target.focus();

  if (action === "selectAll") {
    target.select();
    return;
  }

  if (action === "copy" || action === "cut") {
    await copySelection(target);

    if (action === "cut") {
      replaceSelection(target, "");
      syncTextFieldState(target);
    }

    return;
  }

  if (action === "paste") {
    const pastedText = await navigator.clipboard.readText();
    replaceSelection(target, pastedText);
    syncTextFieldState(target);
    return;
  }

  document.execCommand(action);
  syncTextFieldState(target);
}

function isTextField(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

async function copySelection(target: HTMLInputElement | HTMLTextAreaElement) {
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? 0;
  const selectedText = target.value.slice(start, end);

  await navigator.clipboard.writeText(selectedText);
}

function replaceSelection(target: HTMLInputElement | HTMLTextAreaElement, nextText: string) {
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? 0;
  const value = target.value;

  target.value = `${value.slice(0, start)}${nextText}${value.slice(end)}`;

  const cursor = start + nextText.length;
  target.setSelectionRange(cursor, cursor);
}

function syncTextFieldState(target: HTMLInputElement | HTMLTextAreaElement) {
  if (target === editor) {
    state.content = editor.value;
    state.isDirty = true;
    activeScrollSource = "editor";
    persistDraft();
    syncActiveFile();
    render();
    return;
  }

  if (target === titleInput) {
    state.fileName = normalizeFileName(titleInput.value);
    state.isDirty = true;
    syncActiveFile();
    persistDraft();
    render();
  }
}

function buildInitialDraftSession(
  savedSession: DraftSession | null,
  savedTitle: string | null,
  savedDraft: string | null
): DraftSession {
  if (savedSession && savedSession.openFiles.length > 0) {
    return savedSession;
  }

  const file = createOpenFile(
    normalizeFileName(savedTitle ?? "Untitled.md"),
    savedDraft ?? starterMarkdown,
    Boolean(savedDraft)
  );

  return {
    version: DRAFT_SESSION_VERSION,
    activeFileId: file.id,
    openFiles: [file]
  };
}

function parseSavedDraftSession(rawSession: string | null): DraftSession | null {
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as {
      activeFileId?: unknown;
      openFiles?: unknown;
      version?: unknown;
    };
    const openFilesSource = Array.isArray(parsed.openFiles) ? parsed.openFiles : [];
    const openFiles = openFilesSource
      .map((file) => parseSavedOpenFile(file))
      .filter((file): file is OpenFile => file !== null);

    if (openFiles.length === 0) {
      return null;
    }

    const activeFileId = typeof parsed.activeFileId === "string" && parsed.activeFileId.length > 0
      ? parsed.activeFileId
      : openFiles[0].id;
    const hasActiveFile = openFiles.some((file) => file.id === activeFileId);

    return {
      version: typeof parsed.version === "number" ? parsed.version : DRAFT_SESSION_VERSION,
      activeFileId: hasActiveFile ? activeFileId : openFiles[0].id,
      openFiles
    };
  } catch (error) {
    console.error("Could not parse saved draft session.", error);
    return null;
  }
}

function parseSavedOpenFile(rawFile: unknown): OpenFile | null {
  if (!rawFile || typeof rawFile !== "object") {
    return null;
  }

  const file = rawFile as {
    id?: unknown;
    name?: unknown;
    content?: unknown;
    nativePath?: unknown;
    isDirty?: unknown;
  };
  const id = typeof file.id === "string" && file.id.length > 0 ? file.id : crypto.randomUUID();
  const name = normalizeFileName(typeof file.name === "string" ? file.name : "Untitled.md");
  const content = typeof file.content === "string" ? file.content : "";
  const nativePath = typeof file.nativePath === "string" && file.nativePath.length > 0
    ? file.nativePath
    : null;
  const isDirty = typeof file.isDirty === "boolean" ? file.isDirty : content.length > 0;

  return {
    id,
    name,
    content,
    nativePath,
    isDirty
  };
}

function syncScroll(source: HTMLElement, target: HTMLElement, sourceName: "editor" | "preview") {
  if (state.mode !== "split" || programmaticScrollSource === sourceName) {
    return;
  }

  const sourceScrollable = source.scrollHeight - source.clientHeight;
  const targetScrollable = target.scrollHeight - target.clientHeight;

  if (sourceScrollable <= 0 || targetScrollable <= 0) {
    return;
  }

  activeScrollSource = sourceName;
  const ratio = source.scrollTop / sourceScrollable;
  const nextTop = targetScrollable * ratio;

  if (Math.abs(target.scrollTop - nextTop) < 1) {
    return;
  }

  programmaticScrollSource = sourceName === "editor" ? "preview" : "editor";
  target.scrollTop = nextTop;

  requestAnimationFrame(() => {
    programmaticScrollSource = null;
  });
}

function syncActiveScroll() {
  if (state.mode !== "split") {
    return;
  }

  if (activeScrollSource === "preview") {
    syncScroll(preview, editor, "preview");
    return;
  }

  syncScroll(editor, preview, "editor");
}

function normalizeFileName(fileName: string) {
  const trimmed = fileName.trim();

  if (!trimmed) {
    return "Untitled.md";
  }

  return /\.(md|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function clampZoom(zoomPercent: number) {
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, Math.round(zoomPercent)));
}

function parseSavedZoom(value: string | null) {
  if (!value) {
    return DEFAULT_ZOOM_PERCENT;
  }

  const zoomPercent = Number(value);
  return Number.isFinite(zoomPercent) ? clampZoom(zoomPercent) : DEFAULT_ZOOM_PERCENT;
}

function parseSavedAutocompleteShortcutId(value: string | null) {
  const availableOptions = getAvailableAutocompleteShortcutOptions();
  const defaultOption = availableOptions.find((option) => option.id === DEFAULT_AUTOCOMPLETE_SHORTCUT_ID)
    ?? availableOptions[0];

  if (!value) {
    return defaultOption.id;
  }

  return availableOptions.some((option) => option.id === value)
    ? value
    : defaultOption.id;
}

function getAvailableAutocompleteShortcutOptions() {
  const platform: "mac" | "other" = isMacPlatform() ? "mac" : "other";
  return autocompleteShortcutOptions.filter((option) => !option.platforms || option.platforms.includes(platform));
}

function isMacPlatform() {
  return navigator.userAgent.toLowerCase().includes("mac");
}

function buildHeadingEdit(context: EditorAutocompleteContext, level: number) {
  const marker = "#".repeat(level);
  const label = context.selectedText || `Heading ${level}`;

  if (/^\s*#{1,6}\s*$/.test(context.currentLine)) {
    return buildLineReplacementEdit(context, `${marker} ${label}`, marker.length + 1, marker.length + 1 + label.length);
  }

  return buildInsertionEdit(context, `${marker} ${label}`, marker.length + 1, marker.length + 1 + label.length);
}

function buildLineSnippetEdit(
  context: EditorAutocompleteContext,
  text: string,
  triggerPattern: RegExp
) {
  const placeholderStart = text.indexOf(" ") + 1;

  if (triggerPattern.test(context.currentLine)) {
    return buildLineReplacementEdit(context, text, placeholderStart, text.length);
  }

  return buildInsertionEdit(context, text, placeholderStart, text.length);
}

function buildCodeFenceEdit(context: EditorAutocompleteContext, language = "md") {
  const body = context.selectedText || "code";
  const opener = `\`\`\`${language}`;
  const text = `${opener}\n${body}\n\`\`\``;
  const start = `${opener}\n`.length;

  if (/^\s*(```|~~~)\s*\w*\s*$/.test(context.currentLine)) {
    return buildLineReplacementEdit(context, text, start, start + body.length);
  }

  return buildInsertionEdit(context, text, start, start + body.length);
}

function buildLinkEdit(context: EditorAutocompleteContext, image: boolean) {
  const label = context.selectedText || (image ? "alt text" : "link text");
  const url = image ? "https://example.com/image.png" : "https://example.com";
  const text = `${image ? "!" : ""}[${label}](${url})`;
  const urlStart = `${image ? "!" : ""}[${label}](`.length;

  return buildInsertionEdit(context, text, urlStart, urlStart + url.length);
}

function buildReferenceLinkEdit(context: EditorAutocompleteContext) {
  const label = context.selectedText || "reference text";
  const refId = "ref-1";
  const text = `[${label}][${refId}]\n\n[${refId}]: https://example.com`;
  const urlStart = `[${label}][${refId}]\n\n[${refId}]: `.length;

  return buildInsertionEdit(context, text, urlStart, urlStart + "https://example.com".length);
}

function buildFootnoteReferenceEdit(context: EditorAutocompleteContext) {
  const text = "[^1]";
  return buildInsertionEdit(context, text, 2, 3);
}

function buildFootnoteDefinitionEdit(context: EditorAutocompleteContext) {
  const text = "[^1]: Footnote text";
  return buildInsertionEdit(context, text, 6, text.length);
}

function buildTableEdit(context: EditorAutocompleteContext) {
  const text = "| Column | Column |\n| --- | --- |\n| Value | Value |";
  return buildInsertionEdit(context, text, 2, 8);
}

function buildAlignedTableEdit(context: EditorAutocompleteContext) {
  const text = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| Value | Value | Value |";
  return buildInsertionEdit(context, text, 2, 6);
}

function buildWrappedEdit(
  context: EditorAutocompleteContext,
  prefix: string,
  suffix: string,
  placeholder: string
) {
  const content = context.selectedText || placeholder;
  const text = `${prefix}${content}${suffix}`;
  const contentStart = prefix.length;
  const contentEnd = prefix.length + content.length;

  return buildInsertionEdit(context, text, contentStart, contentEnd);
}

function buildMathBlockEdit(context: EditorAutocompleteContext) {
  const body = context.selectedText || "E = mc^2";
  const text = `$$\n${body}\n$$`;
  return buildInsertionEdit(context, text, 3, 3 + body.length);
}

function buildDetailsEdit(context: EditorAutocompleteContext) {
  const body = context.selectedText || "Hidden details";
  const text = `<details>\n<summary>Summary</summary>\n\n${body}\n</details>`;
  const summaryStart = "<details>\n<summary>".length;
  const summaryEnd = summaryStart + "Summary".length;

  return buildInsertionEdit(context, text, summaryStart, summaryEnd);
}

function buildHtmlCommentEdit(context: EditorAutocompleteContext) {
  const text = "<!-- comment -->";
  return buildInsertionEdit(context, text, 5, 12);
}

function buildInsertionEdit(
  context: EditorAutocompleteContext,
  text: string,
  selectionOffsetStart = text.length,
  selectionOffsetEnd = selectionOffsetStart
): EditorSelectionEdit {
  return {
    start: context.selectionStart,
    end: context.selectionEnd,
    text,
    selectionStart: context.selectionStart + selectionOffsetStart,
    selectionEnd: context.selectionStart + selectionOffsetEnd
  };
}

function buildLineReplacementEdit(
  context: EditorAutocompleteContext,
  text: string,
  selectionOffsetStart = text.length,
  selectionOffsetEnd = selectionOffsetStart
): EditorSelectionEdit {
  return {
    start: context.lineStart,
    end: context.lineEnd,
    text,
    selectionStart: context.lineStart + selectionOffsetStart,
    selectionEnd: context.lineStart + selectionOffsetEnd
  };
}

function pickInsertMenuItem(id: string): InsertMenuItem {
  const item = editorAutocompleteItems.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`Insert menu item was not found: ${id}`);
  }

  return {
    id: item.id,
    label: item.label,
    detail: item.detail,
    buildEdit: item.buildEdit
  };
}

function documentInitial(name: string) {
  const trimmed = name.trim();
  const firstCharacter = trimmed.charAt(0).toUpperCase();

  return firstCharacter || "•";
}

function formatPathForDisplay(path: string) {
  const normalized = path.replaceAll("\\", "/");

  if (normalized.length <= 54) {
    return normalized;
  }

  const head = normalized.slice(0, 24);
  const tail = normalized.slice(-22);
  return `${head} ... ${tail}`;
}

function buildShortcutMarkup() {
  const isMac = isMacPlatform();
  const autocompleteShortcut = getAvailableAutocompleteShortcutOptions().find(
    (option) => option.id === state.autocompleteShortcutId
  ) ?? getAvailableAutocompleteShortcutOptions()[0];
  const autocompleteShortcutMarkup = toShortcutKbdMarkup(getShortcutOptionLabel(autocompleteShortcut));

  if (isMac) {
    return `Use <kbd>Cmd</kbd> + <kbd>O</kbd>, <kbd>N</kbd>, <kbd>S</kbd> for open, new, and save.<br>Use ${autocompleteShortcutMarkup} for Markdown hints.`;
  }

  return `Use <kbd>Ctrl</kbd> + <kbd>O</kbd>, <kbd>N</kbd>, <kbd>S</kbd> for open, new, and save.<br>Use ${autocompleteShortcutMarkup} for Markdown hints.`;
}

function getShortcutOptionLabel(option: AutocompleteShortcutOption) {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMac = userAgent.includes("mac");

  if (isMac && option.macLabel) {
    return option.macLabel;
  }

  return option.label;
}

function toShortcutKbdMarkup(label: string) {
  return label
    .split(" + ")
    .map((part) => `<kbd>${escapeHtml(part)}</kbd>`)
    .join(" + ");
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
