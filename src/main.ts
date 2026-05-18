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
const LOCALE_KEY = "light-md-editor:locale";
const RECENT_FILES_KEY = "light-md-editor:recent-files";
const DEFAULT_AUTOCOMPLETE_SHORTCUT_ID = "shift-space";
const DEFAULT_LOCALE: Locale = "en";
const DEFAULT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 80;
const MAX_ZOOM_PERCENT = 140;
const ZOOM_STEP = 5;
const MAX_RECENT_FILES = 10;

type ViewMode = "write" | "split" | "preview";
type ThemeMode = "light" | "dark";
type Locale = "zh" | "ja" | "en";

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
  locale: Locale;
};

type PendingCloseRequest = {
  fileId: string;
};

type FindReplaceState = {
  isOpen: boolean;
  query: string;
  replaceText: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  showReplace: boolean;
  activeMatchIndex: number;
};

type EditorHistorySnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
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

type TranslationKey =
  | "app.title"
  | "toolbar.file.new"
  | "toolbar.file.open"
  | "toolbar.file.save"
  | "toolbar.insert"
  | "toolbar.format.bold"
  | "toolbar.format.italic"
  | "toolbar.format.link"
  | "toolbar.format.code"
  | "toolbar.format.quote"
  | "mode.write"
  | "mode.split"
  | "mode.read"
  | "settings.open"
  | "settings.theme"
  | "settings.theme.light"
  | "settings.theme.dark"
  | "settings.zoom"
  | "settings.zoom.out"
  | "settings.zoom.in"
  | "settings.autocomplete"
  | "settings.trigger"
  | "settings.language"
  | "sidebar.toggle"
  | "drawer.openDocuments"
  | "drawer.shortcuts"
  | "drawer.localDraft"
  | "autocomplete.title"
  | "dialog.close.title"
  | "dialog.close.message"
  | "dialog.cancel"
  | "dialog.discard"
  | "dialog.save"
  | "find.placeholder"
  | "find.replace.placeholder"
  | "find.matchCase"
  | "find.matchWholeWord"
  | "find.previous"
  | "find.next"
  | "find.replace"
  | "find.replaceAll"
  | "find.close"
  | "find.toggleReplace.open"
  | "find.toggleReplace.close"
  | "find.result"
  | "find.result.none"
  | "state.draftSaved"
  | "state.unsaved"
  | "state.saved"
  | "state.openFailed"
  | "state.saveFailed"
  | "stats.words"
  | "stats.chars"
  | "stats.lines";

type LocaleDictionary = Record<TranslationKey, string>;

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

const translations: Record<Locale, LocaleDictionary> = {
  en: {
    "app.title": "Light Markdown Editor",
    "toolbar.file.new": "New",
    "toolbar.file.open": "Open",
    "toolbar.file.save": "Save",
    "toolbar.insert": "Insert",
    "toolbar.format.bold": "Bold",
    "toolbar.format.italic": "Italic",
    "toolbar.format.link": "Link",
    "toolbar.format.code": "Code",
    "toolbar.format.quote": "Quote",
    "mode.write": "Write",
    "mode.split": "Split",
    "mode.read": "Read",
    "settings.open": "Settings",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.zoom": "Zoom",
    "settings.zoom.out": "Zoom out document",
    "settings.zoom.in": "Zoom in document",
    "settings.autocomplete": "Autocomplete",
    "settings.trigger": "Trigger",
    "settings.language": "Language",
    "sidebar.toggle": "Toggle documents",
    "drawer.openDocuments": "Open Documents",
    "drawer.shortcuts": "Shortcuts",
    "drawer.localDraft": "Local draft",
    "autocomplete.title": "Markdown Syntax",
    "dialog.close.title": "Save changes before closing?",
    "dialog.close.message": "\"{name}\" has unsaved changes. Save before closing?",
    "dialog.cancel": "Cancel",
    "dialog.discard": "Don't Save",
    "dialog.save": "Save",
    "find.placeholder": "Find",
    "find.replace.placeholder": "Replace with",
    "find.matchCase": "Match case",
    "find.matchWholeWord": "Match whole word",
    "find.previous": "Previous",
    "find.next": "Next",
    "find.replace": "Replace",
    "find.replaceAll": "Replace All",
    "find.close": "Close",
    "find.toggleReplace.open": "Replace",
    "find.toggleReplace.close": "Hide Replace",
    "find.result": "{current}/{total}",
    "find.result.none": "No matches",
    "state.draftSaved": "Draft saved locally",
    "state.unsaved": "Unsaved changes",
    "state.saved": "Saved",
    "state.openFailed": "Could not open file",
    "state.saveFailed": "Could not save file",
    "stats.words": "words",
    "stats.chars": "chars",
    "stats.lines": "lines"
  },
  zh: {
    "app.title": "轻量 Markdown 编辑器",
    "toolbar.file.new": "新建",
    "toolbar.file.open": "打开",
    "toolbar.file.save": "保存",
    "toolbar.insert": "插入",
    "toolbar.format.bold": "加粗",
    "toolbar.format.italic": "斜体",
    "toolbar.format.link": "链接",
    "toolbar.format.code": "代码",
    "toolbar.format.quote": "引用",
    "mode.write": "编辑",
    "mode.split": "分栏",
    "mode.read": "阅读",
    "settings.open": "设置",
    "settings.theme": "主题",
    "settings.theme.light": "明亮",
    "settings.theme.dark": "暗黑",
    "settings.zoom": "缩放",
    "settings.zoom.out": "缩小文档",
    "settings.zoom.in": "放大文档",
    "settings.autocomplete": "自动完成",
    "settings.trigger": "触发键",
    "settings.language": "语言",
    "sidebar.toggle": "切换文档列表",
    "drawer.openDocuments": "已打开文档",
    "drawer.shortcuts": "快捷键",
    "drawer.localDraft": "本地草稿",
    "autocomplete.title": "Markdown 语法",
    "dialog.close.title": "关闭前保存更改？",
    "dialog.close.message": "“{name}” 有未保存更改，是否先保存？",
    "dialog.cancel": "取消",
    "dialog.discard": "不保存",
    "dialog.save": "保存",
    "find.placeholder": "查找",
    "find.replace.placeholder": "替换为",
    "find.matchCase": "区分大小写",
    "find.matchWholeWord": "全词匹配",
    "find.previous": "上一个",
    "find.next": "下一个",
    "find.replace": "替换",
    "find.replaceAll": "全部替换",
    "find.close": "关闭",
    "find.toggleReplace.open": "替换",
    "find.toggleReplace.close": "收起",
    "find.result": "{current}/{total}",
    "find.result.none": "无匹配",
    "state.draftSaved": "草稿已保存到本地",
    "state.unsaved": "有未保存更改",
    "state.saved": "已保存",
    "state.openFailed": "打开文件失败",
    "state.saveFailed": "保存文件失败",
    "stats.words": "词",
    "stats.chars": "字符",
    "stats.lines": "行"
  },
  ja: {
    "app.title": "ライト Markdown エディタ",
    "toolbar.file.new": "新規",
    "toolbar.file.open": "開く",
    "toolbar.file.save": "保存",
    "toolbar.insert": "挿入",
    "toolbar.format.bold": "太字",
    "toolbar.format.italic": "斜体",
    "toolbar.format.link": "リンク",
    "toolbar.format.code": "コード",
    "toolbar.format.quote": "引用",
    "mode.write": "編集",
    "mode.split": "分割",
    "mode.read": "閲覧",
    "settings.open": "設定",
    "settings.theme": "テーマ",
    "settings.theme.light": "ライト",
    "settings.theme.dark": "ダーク",
    "settings.zoom": "ズーム",
    "settings.zoom.out": "ズームアウト",
    "settings.zoom.in": "ズームイン",
    "settings.autocomplete": "自動補完",
    "settings.trigger": "トリガー",
    "settings.language": "言語",
    "sidebar.toggle": "ドキュメント一覧の切替",
    "drawer.openDocuments": "開いているドキュメント",
    "drawer.shortcuts": "ショートカット",
    "drawer.localDraft": "ローカル下書き",
    "autocomplete.title": "Markdown 構文",
    "dialog.close.title": "閉じる前に保存しますか？",
    "dialog.close.message": "「{name}」に未保存の変更があります。保存して閉じますか？",
    "dialog.cancel": "キャンセル",
    "dialog.discard": "保存しない",
    "dialog.save": "保存",
    "find.placeholder": "検索",
    "find.replace.placeholder": "置換",
    "find.matchCase": "大文字/小文字を区別",
    "find.matchWholeWord": "単語単位で一致",
    "find.previous": "前へ",
    "find.next": "次へ",
    "find.replace": "置換",
    "find.replaceAll": "すべて置換",
    "find.close": "閉じる",
    "find.toggleReplace.open": "置換",
    "find.toggleReplace.close": "折りたたむ",
    "find.result": "{current}/{total}",
    "find.result.none": "一致なし",
    "state.draftSaved": "下書きをローカルに保存しました",
    "state.unsaved": "未保存の変更",
    "state.saved": "保存済み",
    "state.openFailed": "ファイルを開けませんでした",
    "state.saveFailed": "ファイルを保存できませんでした",
    "stats.words": "語",
    "stats.chars": "文字",
    "stats.lines": "行"
  }
};

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
const savedLocale = localStorage.getItem(LOCALE_KEY);
const recentFiles = parseSavedRecentFiles(localStorage.getItem(RECENT_FILES_KEY));
const initialSession = buildInitialDraftSession(savedSession, savedTitle, savedDraft);
const initialActiveFile = initialSession.openFiles.find((file) => file.id === initialSession.activeFileId)
  ?? initialSession.openFiles[0];
const initialAutocompleteShortcutId = parseSavedAutocompleteShortcutId(savedAutocompleteShortcut);
const initialLocale = parseSavedLocale(savedLocale);

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
  autocompleteShortcutId: initialAutocompleteShortcutId,
  locale: initialLocale
};

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="topbar-sidebar-zone">
        <button class="icon-button sidebar-toggle" data-action="toggle-sidebar" title="" aria-label="" aria-pressed="true">☰</button>
        <section class="document-meta" aria-label="Document details">
          <input class="title-input" value="${escapeAttribute(state.fileName)}" aria-label="File name" />
          <span class="save-state"></span>
        </section>
      </div>

      <div class="topbar-editor-zone">
        <div class="file-actions" aria-label="File actions">
          <button class="text-button" data-action="new"></button>
          <button class="text-button" data-action="open"></button>
          <button class="text-button" data-action="save"></button>
        </div>

        <nav class="toolbar" aria-label="Editor tools">
          <div class="formatting-tools" role="group" aria-label="Formatting tools">
            <button class="icon-text-button" data-action="format-bold" title="Bold"><strong>B</strong></button>
            <button class="icon-text-button" data-action="format-italic" title="Italic"><em>I</em></button>
            <button class="icon-text-button" data-action="format-link" title="Link">🔗</button>
            <button class="icon-text-button" data-action="format-code" title="Code">\`</button>
            <button class="icon-text-button" data-action="format-quote" title="Quote">❝</button>
          </div>
          <div class="toolbar-menu-shell">
            <button class="text-button menu-button" data-action="toggle-insert-menu" aria-haspopup="true" aria-expanded="false">
            </button>
            <div class="insert-menu hidden" aria-hidden="true"></div>
          </div>
          <div class="segmented" role="group" aria-label="View mode">
            <button data-mode="write"></button>
            <button data-mode="split"></button>
            <button data-mode="preview"></button>
          </div>
          <div class="toolbar-menu-shell settings-shell">
            <button
              class="icon-button settings-button"
              data-action="toggle-settings-menu"
              aria-label=""
              title=""
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span class="settings-icon" aria-hidden="true">⚙</span>
            </button>
            <div class="settings-menu hidden" aria-hidden="true">
              <section class="settings-group" aria-label="Theme">
                <h3 class="settings-group-title"></h3>
                <div class="settings-choice" role="group" aria-label="Theme mode">
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="light"></button>
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="dark"></button>
                </div>
              </section>

              <section class="settings-group" aria-label="Document zoom">
                <h3 class="settings-group-title"></h3>
                <div class="font-controls settings-zoom-controls" role="group" aria-label="Document zoom">
                  <button class="font-button" data-action="font-decrease" aria-label="">A-</button>
                  <span class="font-size-label settings-zoom-label" aria-label="Current document zoom">100%</span>
                  <button class="font-button" data-action="font-increase" aria-label="">A+</button>
                </div>
              </section>

              <section class="settings-group" aria-label="Autocomplete shortcut">
                <h3 class="settings-group-title"></h3>
                <label class="settings-field">
                  <span class="settings-field-label"></span>
                  <select class="settings-shortcut-select" aria-label="Autocomplete shortcut"></select>
                </label>
              </section>

              <section class="settings-group" aria-label="Language">
                <h3 class="settings-group-title"></h3>
                <label class="settings-field">
                  <span class="settings-field-label"></span>
                  <select class="settings-language-select" aria-label="Language"></select>
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
              <span class="drawer-section-title"></span>
              <span class="drawer-section-count">${state.openFiles.length}</span>
            </div>
            <ul class="document-list" aria-label="Open documents"></ul>
          </section>

          <section class="drawer-note" aria-label="Tips">
            <span class="drawer-note-title"></span>
            <p class="shortcut-copy"></p>
          </section>
        </div>
      </aside>

      <section class="workspace mode-split" aria-label="Markdown editor">
        <textarea class="editor" spellcheck="true" aria-label="Markdown source"></textarea>
        <article class="preview markdown-body" aria-label="Rendered preview"></article>
        <div class="find-panel hidden" aria-hidden="true">
          <div class="find-row">
            <input class="find-input" type="text" />
            <div class="find-row-controls">
              <span class="find-status"></span>
              <button class="text-button subtle-button find-button" data-action="find-prev"></button>
              <button class="text-button subtle-button find-button" data-action="find-next"></button>
              <button class="text-button subtle-button find-option-button" data-action="find-match-case" type="button">Aa</button>
              <button class="text-button subtle-button find-option-button" data-action="find-match-word" type="button">""</button>
              <button class="text-button subtle-button find-button find-toggle-button" data-action="find-toggle-replace"></button>
              <button class="text-button subtle-button find-button" data-action="find-close"></button>
            </div>
          </div>
          <div class="find-row replace-row hidden">
            <input class="replace-input" type="text" />
            <div class="find-row-controls replace-controls">
              <button class="text-button subtle-button find-button" data-action="find-replace"></button>
              <button class="text-button subtle-button find-button" data-action="find-replace-all"></button>
            </div>
          </div>
        </div>
        <div class="autocomplete-panel hidden" aria-hidden="true">
          <div class="autocomplete-title"></div>
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
          <h2 id="confirm-close-title" class="confirm-dialog-title"></h2>
          <p class="confirm-dialog-message"></p>
        </div>
        <div class="confirm-dialog-actions">
          <button class="text-button subtle-button" data-action="confirm-close-cancel"></button>
          <button class="text-button subtle-button" data-action="confirm-close-discard"></button>
          <button class="text-button primary-button" data-action="confirm-close-save"></button>
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
const formattingButtons = {
  bold: requireElement<HTMLButtonElement>("[data-action='format-bold']"),
  italic: requireElement<HTMLButtonElement>("[data-action='format-italic']"),
  link: requireElement<HTMLButtonElement>("[data-action='format-link']"),
  code: requireElement<HTMLButtonElement>("[data-action='format-code']"),
  quote: requireElement<HTMLButtonElement>("[data-action='format-quote']")
};
const insertMenuButton = requireElement<HTMLButtonElement>(".menu-button");
const insertMenu = requireElement<HTMLDivElement>(".insert-menu");
const settingsMenuButton = requireElement<HTMLButtonElement>(".settings-button");
const settingsMenu = requireElement<HTMLDivElement>(".settings-menu");
const languageSelect = requireElement<HTMLSelectElement>(".settings-language-select");
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
const fileActionButtons = {
  new: requireElement<HTMLButtonElement>("[data-action='new']"),
  open: requireElement<HTMLButtonElement>("[data-action='open']"),
  save: requireElement<HTMLButtonElement>("[data-action='save']")
};
const settingsGroupTitles = Array.from(app.querySelectorAll<HTMLHeadingElement>(".settings-group-title"));
const settingsFieldLabels = Array.from(app.querySelectorAll<HTMLSpanElement>(".settings-field-label"));
const drawerSectionTitle = requireElement<HTMLSpanElement>(".drawer-section-title");
const drawerNoteTitle = requireElement<HTMLSpanElement>(".drawer-note-title");
const autocompleteTitle = requireElement<HTMLDivElement>(".autocomplete-title");
const confirmDialogTitle = requireElement<HTMLHeadingElement>(".confirm-dialog-title");
const confirmCloseCancelButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-cancel']");
const confirmCloseDiscardButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-discard']");
const findPanel = requireElement<HTMLDivElement>(".find-panel");
const findInput = requireElement<HTMLInputElement>(".find-input");
const replaceInput = requireElement<HTMLInputElement>(".replace-input");
const findStatus = requireElement<HTMLSpanElement>(".find-status");
const replaceRow = requireElement<HTMLDivElement>(".replace-row");
const findMatchCaseButton = requireElement<HTMLButtonElement>("[data-action='find-match-case']");
const findMatchWordButton = requireElement<HTMLButtonElement>("[data-action='find-match-word']");
const findPrevButton = requireElement<HTMLButtonElement>("[data-action='find-prev']");
const findNextButton = requireElement<HTMLButtonElement>("[data-action='find-next']");
const findCloseButton = requireElement<HTMLButtonElement>("[data-action='find-close']");
const findToggleReplaceButton = requireElement<HTMLButtonElement>("[data-action='find-toggle-replace']");
const findReplaceButton = requireElement<HTMLButtonElement>("[data-action='find-replace']");
const findReplaceAllButton = requireElement<HTMLButtonElement>("[data-action='find-replace-all']");

let activeScrollSource: "editor" | "preview" = "editor";
let programmaticScrollSource: "editor" | "preview" | null = null;
let pendingCloseRequest: PendingCloseRequest | null = null;
let isInsertMenuOpen = false;
let isSettingsMenuOpen = false;
const undoHistoryStack: EditorHistorySnapshot[] = [];
const redoHistoryStack: EditorHistorySnapshot[] = [];
let isApplyingHistoryChange = false;
let currentHistorySnapshot: EditorHistorySnapshot = {
  value: "",
  selectionStart: 0,
  selectionEnd: 0
};
const findReplaceState: FindReplaceState = {
  isOpen: false,
  query: "",
  replaceText: "",
  matchCase: false,
  matchWholeWord: false,
  showReplace: false,
  activeMatchIndex: -1
};
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
resetEditorHistory();
void setupMenuListener();
void syncRecentMenu();
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

languageSelect.addEventListener("change", () => {
  setLocale(languageSelect.value);
});

findInput.addEventListener("input", () => {
  findReplaceState.query = findInput.value;
  findReplaceState.activeMatchIndex = -1;
  renderFindPanel();
});

replaceInput.addEventListener("input", () => {
  findReplaceState.replaceText = replaceInput.value;
});

findMatchCaseButton.addEventListener("click", () => {
  findReplaceState.matchCase = !findReplaceState.matchCase;
  findReplaceState.activeMatchIndex = -1;
  renderFindPanel();
});

findMatchWordButton.addEventListener("click", () => {
  findReplaceState.matchWholeWord = !findReplaceState.matchWholeWord;
  findReplaceState.activeMatchIndex = -1;
  renderFindPanel();
});

findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void findNext(event.shiftKey ? -1 : 1);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeFindPanel(true);
  }
});

replaceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void replaceCurrentMatch();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeFindPanel(true);
  }
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

  if (action === "format-bold") {
    applyFormattingAction("bold");
    return;
  }

  if (action === "format-italic") {
    applyFormattingAction("italic");
    return;
  }

  if (action === "format-link") {
    applyFormattingAction("link");
    return;
  }

  if (action === "format-code") {
    applyFormattingAction("code");
    return;
  }

  if (action === "format-quote") {
    applyFormattingAction("quote");
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
    return;
  }

  if (action === "find-prev") {
    await findNext(-1);
    return;
  }

  if (action === "find-next") {
    await findNext(1);
    return;
  }

  if (action === "find-close") {
    closeFindPanel(true);
    return;
  }

  if (action === "find-toggle-replace") {
    toggleFindReplaceMode();
    return;
  }

  if (action === "find-replace") {
    await replaceCurrentMatch();
    return;
  }

  if (action === "find-replace-all") {
    await replaceAllMatches();
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

  if (event.key === "Escape" && findReplaceState.isOpen) {
    event.preventDefault();
    closeFindPanel(true);
    return;
  }

  const isCommand = event.metaKey || event.ctrlKey;

  if (!isCommand) {
    return;
  }

  if (event.key.toLowerCase() === "z" && !event.altKey) {
    event.preventDefault();
    await performEditorAction(event.shiftKey ? "redo" : "undo");
    return;
  }

  if (event.key.toLowerCase() === "y" && !event.altKey) {
    event.preventDefault();
    await performEditorAction("redo");
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

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    if (findReplaceState.isOpen && !findReplaceState.showReplace) {
      closeFindPanel(true);
    } else {
      openFindPanel(false);
    }
    return;
  }

  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    if (findReplaceState.isOpen && findReplaceState.showReplace) {
      closeFindPanel(true);
    } else {
      openFindPanel(true);
    }
    return;
  }

  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    if (findReplaceState.isOpen && findReplaceState.showReplace) {
      closeFindPanel(true);
    } else {
      openFindPanel(true);
    }
    return;
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
  renderLocale();
  preview.innerHTML = DOMPurify.sanitize(marked.parse(state.content, { async: false }));
  renderStats();
  renderMode();
  renderTheme();
  renderZoom();
  renderDocuments();
  renderFindPanel();
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

  wordStat.textContent = `${words} ${t("stats.words")}`;
  charStat.textContent = `${characters} ${t("stats.chars")}`;
  lineStat.textContent = `${lines} ${t("stats.lines")}`;
}

function renderLocale() {
  document.documentElement.dataset.locale = state.locale;
  document.title = t("app.title");
  sidebarToggle.setAttribute("title", t("sidebar.toggle"));
  sidebarToggle.setAttribute("aria-label", t("sidebar.toggle"));
  saveState.textContent = t("state.draftSaved");

  fileActionButtons.new.textContent = t("toolbar.file.new");
  fileActionButtons.open.textContent = t("toolbar.file.open");
  fileActionButtons.save.textContent = t("toolbar.file.save");

  insertMenuButton.textContent = t("toolbar.insert");
  formattingButtons.bold.setAttribute("title", t("toolbar.format.bold"));
  formattingButtons.bold.setAttribute("aria-label", t("toolbar.format.bold"));
  formattingButtons.italic.setAttribute("title", t("toolbar.format.italic"));
  formattingButtons.italic.setAttribute("aria-label", t("toolbar.format.italic"));
  formattingButtons.link.setAttribute("title", t("toolbar.format.link"));
  formattingButtons.link.setAttribute("aria-label", t("toolbar.format.link"));
  formattingButtons.code.setAttribute("title", t("toolbar.format.code"));
  formattingButtons.code.setAttribute("aria-label", t("toolbar.format.code"));
  formattingButtons.quote.setAttribute("title", t("toolbar.format.quote"));
  formattingButtons.quote.setAttribute("aria-label", t("toolbar.format.quote"));

  const writeButton = modeButtons.find((button) => button.dataset.mode === "write");
  const splitButton = modeButtons.find((button) => button.dataset.mode === "split");
  const previewButton = modeButtons.find((button) => button.dataset.mode === "preview");

  if (writeButton) {
    writeButton.textContent = t("mode.write");
  }

  if (splitButton) {
    splitButton.textContent = t("mode.split");
  }

  if (previewButton) {
    previewButton.textContent = t("mode.read");
  }

  settingsMenuButton.setAttribute("title", t("settings.open"));
  settingsMenuButton.setAttribute("aria-label", t("settings.open"));
  themeOptionButtons[0].textContent = t("settings.theme.light");
  themeOptionButtons[1].textContent = t("settings.theme.dark");
  fontDecreaseButton.setAttribute("aria-label", t("settings.zoom.out"));
  fontIncreaseButton.setAttribute("aria-label", t("settings.zoom.in"));

  settingsGroupTitles[0].textContent = t("settings.theme");
  settingsGroupTitles[1].textContent = t("settings.zoom");
  settingsGroupTitles[2].textContent = t("settings.autocomplete");
  settingsGroupTitles[3].textContent = t("settings.language");
  settingsFieldLabels[0].textContent = t("settings.trigger");
  settingsFieldLabels[1].textContent = t("settings.language");

  drawerSectionTitle.textContent = t("drawer.openDocuments");
  drawerNoteTitle.textContent = t("drawer.shortcuts");
  autocompleteTitle.textContent = t("autocomplete.title");
  confirmDialogTitle.textContent = t("dialog.close.title");
  confirmCloseCancelButton.textContent = t("dialog.cancel");
  confirmCloseDiscardButton.textContent = t("dialog.discard");
  confirmCloseSaveButton.textContent = t("dialog.save");

  findInput.placeholder = t("find.placeholder");
  replaceInput.placeholder = t("find.replace.placeholder");
  findPrevButton.textContent = t("find.previous");
  findNextButton.textContent = t("find.next");
  findCloseButton.textContent = t("find.close");
  findToggleReplaceButton.textContent = findReplaceState.showReplace
    ? t("find.toggleReplace.close")
    : t("find.toggleReplace.open");
  findReplaceButton.textContent = t("find.replace");
  findReplaceAllButton.textContent = t("find.replaceAll");
  findMatchCaseButton.title = t("find.matchCase");
  findMatchWordButton.title = t("find.matchWholeWord");
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
  const pathLabel = state.nativePath ? formatPathForDisplay(state.nativePath) : t("drawer.localDraft");

  if (message) {
    saveState.textContent = `${message} · ${pathLabel}`;
    return;
  }

  saveState.textContent = `${state.isDirty ? t("state.unsaved") : t("state.saved")} · ${pathLabel}`;
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
      const dirtyMark = file.isDirty
        ? `<span class="dirty-mark" aria-hidden="true" title="${escapeAttribute(t("state.unsaved"))}"></span>`
        : "";
      const subtitle = file.nativePath ? escapeHtml(formatPathForDisplay(file.nativePath)) : t("drawer.localDraft");
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
  renderLanguageOptions();
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

function renderLanguageOptions() {
  const options: Array<{ id: Locale; label: string }> = [
    { id: "zh", label: "中文" },
    { id: "ja", label: "日本語" },
    { id: "en", label: "English" }
  ];

  languageSelect.innerHTML = options
    .map((option) => {
      const selected = option.id === state.locale ? " selected" : "";
      return `<option value="${option.id}"${selected}>${option.label}</option>`;
    })
    .join("");

  languageSelect.value = state.locale;
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

function renderFindPanel() {
  findPanel.classList.toggle("hidden", !findReplaceState.isOpen);
  findPanel.setAttribute("aria-hidden", String(!findReplaceState.isOpen));
  replaceRow.classList.toggle("hidden", !findReplaceState.showReplace);
  findToggleReplaceButton.textContent = findReplaceState.showReplace
    ? t("find.toggleReplace.close")
    : t("find.toggleReplace.open");
  findToggleReplaceButton.setAttribute("aria-pressed", String(findReplaceState.showReplace));
  findToggleReplaceButton.classList.toggle("active", findReplaceState.showReplace);
  findInput.value = findReplaceState.query;
  replaceInput.value = findReplaceState.replaceText;
  findMatchCaseButton.classList.toggle("active", findReplaceState.matchCase);
  findMatchWordButton.classList.toggle("active", findReplaceState.matchWholeWord);
  findMatchCaseButton.setAttribute("aria-pressed", String(findReplaceState.matchCase));
  findMatchWordButton.setAttribute("aria-pressed", String(findReplaceState.matchWholeWord));
  findMatchCaseButton.title = `${t("find.matchCase")} (${findReplaceState.matchCase ? "on" : "off"})`;
  findMatchWordButton.title = `${t("find.matchWholeWord")} (${findReplaceState.matchWholeWord ? "on" : "off"})`;

  const matches = getFindMatches();
  const hasQuery = findReplaceState.query.length > 0;
  const hasMatches = matches.length > 0;
  const currentMatchIndex = hasMatches ? getCurrentFindMatchIndex(matches) : -1;
  findReplaceState.activeMatchIndex = currentMatchIndex;
  const current = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
  findStatus.textContent = hasQuery
    ? hasMatches
      ? formatMessage(t("find.result"), { current: String(current), total: String(matches.length) })
      : t("find.result.none")
    : "";

  findPrevButton.disabled = !hasMatches;
  findNextButton.disabled = !hasMatches;
  findReplaceButton.disabled = !hasMatches;
  findReplaceAllButton.disabled = !hasMatches;
}

function getCurrentFindMatchIndex(matches: Array<{ start: number; end: number }>) {
  if (matches.length === 0) {
    return -1;
  }

  const selectionStart = editor.selectionStart ?? 0;
  const selectionEnd = editor.selectionEnd ?? selectionStart;
  const selectedIndex = matches.findIndex((match) => match.start === selectionStart && match.end === selectionEnd);

  if (selectedIndex >= 0) {
    return selectedIndex;
  }

  if (findReplaceState.activeMatchIndex >= 0 && findReplaceState.activeMatchIndex < matches.length) {
    return findReplaceState.activeMatchIndex;
  }

  const caret = selectionEnd;
  const containingIndex = matches.findIndex((match) => caret >= match.start && caret <= match.end);

  if (containingIndex >= 0) {
    return containingIndex;
  }

  const nextIndex = matches.findIndex((match) => match.start >= caret);

  if (nextIndex >= 0) {
    return nextIndex;
  }

  return 0;
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
    renderSaveState(t("state.openFailed"));
  }
}

async function openRecentDocument(index: number) {
  const recentPath = recentFiles[index];

  if (!recentPath) {
    return;
  }

  try {
    const file = await invoke<TauriMarkdownFile | null>("open_markdown_file_from_path", {
      path: recentPath
    });

    if (!file) {
      removeRecentFile(recentPath);
      renderSaveState(t("state.openFailed"));
      return;
    }

    loadNativeFile(file);
  } catch (error) {
    console.error(error);
    removeRecentFile(recentPath);
    renderSaveState(t("state.openFailed"));
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
    pushRecentFile(savedFile.path);
    titleInput.value = state.fileName;
    markSaved();
    return true;
  } catch (error) {
    console.error(error);
    renderSaveState(t("state.saveFailed"));
    return false;
  }
}

function loadNativeFile(file: TauriMarkdownFile) {
  pushRecentFile(file.path);
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

function markSaved(message = t("state.saved")) {
  state.isDirty = false;
  syncActiveFile();
  persistDraft();
  renderDocuments();
  renderSaveState(message);
}

function pushRecentFile(path: string) {
  const trimmed = path.trim();

  if (!trimmed) {
    return;
  }

  const existingIndex = recentFiles.findIndex((entry) => entry === trimmed);

  if (existingIndex >= 0) {
    recentFiles.splice(existingIndex, 1);
  }

  recentFiles.unshift(trimmed);

  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles.splice(MAX_RECENT_FILES);
  }

  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
  void syncRecentMenu();
}

function removeRecentFile(path: string) {
  const index = recentFiles.findIndex((entry) => entry === path);

  if (index < 0) {
    return;
  }

  recentFiles.splice(index, 1);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
  void syncRecentMenu();
}

async function syncRecentMenu() {
  try {
    await invoke("update_recent_menu", { paths: recentFiles });
  } catch (error) {
    console.error("Could not update recent menu.", error);
  }
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
  resetEditorHistory();
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
  openConfirmDialog(formatMessage(t("dialog.close.message"), { name: file.name }));
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

function openFindPanel(showReplace: boolean) {
  findReplaceState.isOpen = true;
  findReplaceState.showReplace = showReplace;
  const selectedText = editor.value.slice(editor.selectionStart ?? 0, editor.selectionEnd ?? 0).trim();

  if (selectedText) {
    findReplaceState.query = selectedText;
    findReplaceState.activeMatchIndex = -1;
  }

  closeInsertMenu();
  closeSettingsMenu();
  closeAutocomplete();
  renderFindPanel();
  window.setTimeout(() => {
    findInput.focus();
    findInput.select();
  }, 0);
}

function toggleFindReplaceMode() {
  findReplaceState.showReplace = !findReplaceState.showReplace;
  renderFindPanel();
  window.setTimeout(() => {
    if (findReplaceState.showReplace) {
      replaceInput.focus();
      return;
    }

    findInput.focus();
  }, 0);
}

function closeFindPanel(restoreFocus = false) {
  if (!findReplaceState.isOpen) {
    return;
  }

  findReplaceState.isOpen = false;
  findReplaceState.activeMatchIndex = -1;
  renderFindPanel();

  if (restoreFocus) {
    editor.focus();
  }
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

function getFindMatches() {
  const query = findReplaceState.query;

  if (!query) {
    return [] as Array<{ start: number; end: number }>;
  }

  const source = findReplaceState.matchCase ? editor.value : editor.value.toLowerCase();
  const needle = findReplaceState.matchCase ? query : query.toLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let index = 0;

  while (index <= source.length - needle.length) {
    const nextIndex = source.indexOf(needle, index);

    if (nextIndex < 0) {
      break;
    }

    if (findReplaceState.matchWholeWord && !isWholeWordMatch(source, nextIndex, needle.length)) {
      index = nextIndex + Math.max(needle.length, 1);
      continue;
    }

    matches.push({ start: nextIndex, end: nextIndex + needle.length });
    index = nextIndex + Math.max(needle.length, 1);
  }

  return matches;
}

function isWholeWordMatch(source: string, start: number, length: number) {
  const before = start > 0 ? source[start - 1] : "";
  const after = start + length < source.length ? source[start + length] : "";
  const wordPattern = /[\p{L}\p{N}_]/u;

  if (before && wordPattern.test(before)) {
    return false;
  }

  if (after && wordPattern.test(after)) {
    return false;
  }

  return true;
}

async function findNext(direction: 1 | -1) {
  const matches = getFindMatches();

  if (matches.length === 0) {
    findReplaceState.activeMatchIndex = -1;
    renderFindPanel();
    return;
  }

  const selectionStart = editor.selectionStart ?? 0;
  const selectionEnd = editor.selectionEnd ?? selectionStart;
  let nextIndex = -1;

  if (direction > 0) {
    nextIndex = matches.findIndex((match) => match.start > selectionEnd);

    if (nextIndex < 0) {
      nextIndex = 0;
    }
  } else {
    nextIndex = matches.length - 1;

    for (let index = matches.length - 1; index >= 0; index -= 1) {
      if (matches[index].end < selectionStart) {
        nextIndex = index;
        break;
      }
    }
  }

  findReplaceState.activeMatchIndex = nextIndex;
  const match = matches[nextIndex];
  editor.focus();
  editor.setSelectionRange(match.start, match.end);
  renderFindPanel();
}

async function replaceCurrentMatch() {
  const matches = getFindMatches();

  if (matches.length === 0) {
    return;
  }

  const selectedStart = editor.selectionStart ?? 0;
  const selectedEnd = editor.selectionEnd ?? 0;
  let targetIndex = matches.findIndex((match) => match.start === selectedStart && match.end === selectedEnd);

  if (targetIndex < 0) {
    await findNext(1);
    return;
  }

  const match = matches[targetIndex];
  applyEditorEdit({
    start: match.start,
    end: match.end,
    text: findReplaceState.replaceText
  });

  const delta = findReplaceState.replaceText.length;
  editor.setSelectionRange(match.start, match.start + delta);

  const nextMatches = getFindMatches();
  if (nextMatches.length === 0) {
    findReplaceState.activeMatchIndex = -1;
    renderFindPanel();
    return;
  }

  targetIndex = Math.min(targetIndex, nextMatches.length - 1);
  findReplaceState.activeMatchIndex = targetIndex;
  renderFindPanel();
  await findNext(1);
}

async function replaceAllMatches() {
  const matches = getFindMatches();

  if (matches.length === 0) {
    return;
  }

  const source = editor.value;
  let cursor = 0;
  const chunks: string[] = [];

  for (const match of matches) {
    chunks.push(source.slice(cursor, match.start));
    chunks.push(findReplaceState.replaceText);
    cursor = match.end;
  }

  chunks.push(source.slice(cursor));
  editor.value = chunks.join("");
  syncTextFieldState(editor);
  findReplaceState.activeMatchIndex = -1;
  renderFindPanel();
}

function applyFormattingAction(action: "bold" | "italic" | "link" | "code" | "quote") {
  if (state.mode === "preview") {
    setMode("write");
  }

  const context = getEditorAutocompleteContext();

  if (action === "quote") {
    const quoteItem = editorAutocompleteItems.find((item) => item.id === "blockquote");
    if (!quoteItem) {
      return;
    }
    applyEditorEdit(quoteItem.buildEdit(context));
    return;
  }

  if (action === "bold") {
    applyEditorEdit(buildWrappedEdit(context, "**", "**", "bold text"));
    return;
  }

  if (action === "italic") {
    applyEditorEdit(buildWrappedEdit(context, "_", "_", "emphasis"));
    return;
  }

  if (action === "link") {
    applyEditorEdit(buildLinkEdit(context, false));
    return;
  }

  applyEditorEdit(buildWrappedEdit(context, "`", "`", "code"));
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
  const nextSelectionStart = edit.selectionStart ?? edit.start + edit.text.length;
  const nextSelectionEnd = edit.selectionEnd ?? nextSelectionStart;

  editor.focus();
  editor.setSelectionRange(edit.start, edit.end);
  editor.setRangeText(edit.text, edit.start, edit.end, "end");
  editor.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  syncTextFieldState(editor);
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
      case "file.open_recent.1":
      case "file.open_recent.2":
      case "file.open_recent.3":
      case "file.open_recent.4":
      case "file.open_recent.5":
      case "file.open_recent.6":
      case "file.open_recent.7":
      case "file.open_recent.8":
      case "file.open_recent.9":
      case "file.open_recent.10": {
        const index = Number(event.payload.split(".").at(-1)) - 1;
        if (Number.isInteger(index) && index >= 0) {
          await openRecentDocument(index);
        }
        break;
      }
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
      case "edit.find":
        openFindPanel(false);
        break;
      case "edit.replace":
        openFindPanel(true);
        break;
      case "format.bold":
        applyFormattingAction("bold");
        break;
      case "format.italic":
        applyFormattingAction("italic");
        break;
      case "format.link":
        applyFormattingAction("link");
        break;
      case "format.code":
        applyFormattingAction("code");
        break;
      case "format.quote":
        applyFormattingAction("quote");
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

function setLocale(nextLocale: string) {
  if (!isSupportedLocale(nextLocale)) {
    return;
  }

  state.locale = nextLocale;
  localStorage.setItem(LOCALE_KEY, state.locale);
  render();
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

  if (target === editor && action === "undo") {
    if (undoEditorHistory()) {
      return;
    }
  }

  if (target === editor && action === "redo") {
    if (redoEditorHistory()) {
      return;
    }
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

  target.setRangeText(nextText, start, end, "end");
  const cursor = start + nextText.length;
  target.setSelectionRange(cursor, cursor);
}

function captureEditorHistorySnapshot() {
  const nextSnapshot = readEditorHistorySnapshot();

  if (
    nextSnapshot.value === currentHistorySnapshot.value
    && nextSnapshot.selectionStart === currentHistorySnapshot.selectionStart
    && nextSnapshot.selectionEnd === currentHistorySnapshot.selectionEnd
  ) {
    return;
  }

  undoHistoryStack.push(currentHistorySnapshot);

  if (undoHistoryStack.length > 500) {
    undoHistoryStack.shift();
  }

  redoHistoryStack.length = 0;
  currentHistorySnapshot = nextSnapshot;
}

function readEditorHistorySnapshot(): EditorHistorySnapshot {
  return {
    value: editor.value,
    selectionStart: editor.selectionStart ?? 0,
    selectionEnd: editor.selectionEnd ?? (editor.selectionStart ?? 0)
  };
}

function applyEditorHistorySnapshot(snapshot: EditorHistorySnapshot) {
  isApplyingHistoryChange = true;
  editor.value = snapshot.value;
  editor.focus();
  editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  currentHistorySnapshot = readEditorHistorySnapshot();
  syncTextFieldState(editor);
  isApplyingHistoryChange = false;
}

function resetEditorHistory() {
  undoHistoryStack.length = 0;
  redoHistoryStack.length = 0;
  currentHistorySnapshot = readEditorHistorySnapshot();
}

function undoEditorHistory() {
  if (undoHistoryStack.length === 0) {
    return false;
  }

  const previousSnapshot = undoHistoryStack.pop();

  if (!previousSnapshot) {
    return false;
  }

  redoHistoryStack.push(readEditorHistorySnapshot());
  applyEditorHistorySnapshot(previousSnapshot);
  return true;
}

function redoEditorHistory() {
  if (redoHistoryStack.length === 0) {
    return false;
  }

  const nextSnapshot = redoHistoryStack.pop();

  if (!nextSnapshot) {
    return false;
  }

  undoHistoryStack.push(readEditorHistorySnapshot());
  applyEditorHistorySnapshot(nextSnapshot);
  return true;
}

function syncTextFieldState(target: HTMLInputElement | HTMLTextAreaElement) {
  if (target === editor) {
    if (!isApplyingHistoryChange) {
      captureEditorHistorySnapshot();
    }

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

function parseSavedRecentFiles(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, MAX_RECENT_FILES);
  } catch (error) {
    console.error("Could not parse recent files.", error);
    return [] as string[];
  }
}

function parseSavedLocale(value: string | null): Locale {
  if (isSupportedLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}

function isSupportedLocale(value: string | null): value is Locale {
  return value === "zh" || value === "ja" || value === "en";
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
    if (state.locale === "zh") {
      return `使用 <kbd>Cmd</kbd> + <kbd>O</kbd>、<kbd>N</kbd>、<kbd>S</kbd> 进行打开、新建和保存。<br>使用 ${autocompleteShortcutMarkup} 触发 Markdown 提示。`;
    }

    if (state.locale === "ja") {
      return `<kbd>Cmd</kbd> + <kbd>O</kbd>、<kbd>N</kbd>、<kbd>S</kbd> で開く・新規作成・保存。<br>${autocompleteShortcutMarkup} で Markdown ヒントを表示。`;
    }

    return `Use <kbd>Cmd</kbd> + <kbd>O</kbd>, <kbd>N</kbd>, <kbd>S</kbd> for open, new, and save.<br>Use ${autocompleteShortcutMarkup} for Markdown hints.`;
  }

  if (state.locale === "zh") {
    return `使用 <kbd>Ctrl</kbd> + <kbd>O</kbd>、<kbd>N</kbd>、<kbd>S</kbd> 进行打开、新建和保存。<br>使用 ${autocompleteShortcutMarkup} 触发 Markdown 提示。`;
  }

  if (state.locale === "ja") {
    return `<kbd>Ctrl</kbd> + <kbd>O</kbd>、<kbd>N</kbd>、<kbd>S</kbd> で開く・新規作成・保存。<br>${autocompleteShortcutMarkup} で Markdown ヒントを表示。`;
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

function t(key: TranslationKey) {
  const dictionary = translations[state.locale] ?? translations[DEFAULT_LOCALE];
  return dictionary[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
}

function formatMessage(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template);
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
