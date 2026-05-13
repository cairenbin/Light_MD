import DOMPurify from "dompurify";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import "./styles.css";

const DRAFT_KEY = "light-md-editor:draft";
const TITLE_KEY = "light-md-editor:title";
const THEME_KEY = "light-md-editor:theme";
const EXPLORER_KEY = "light-md-editor:explorer-open";
const FONT_SIZE_KEY = "light-md-editor:font-size";
const DEFAULT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 80;
const MAX_ZOOM_PERCENT = 140;
const ZOOM_STEP = 5;
type ViewMode = "write" | "split" | "preview";

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

type EditorState = {
  content: string;
  fileName: string;
  nativePath: string | null;
  isDirty: boolean;
  mode: ViewMode;
  theme: ThemeMode;
  isExplorerOpen: boolean;
  openFiles: OpenFile[];
  activeFileId: string;
  zoomPercent: number;
};

type ThemeMode = "light" | "dark";

type OpenFile = {
  id: string;
  name: string;
  content: string;
  nativePath: string | null;
  isDirty: boolean;
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

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const appRoot = app;
const savedDraft = localStorage.getItem(DRAFT_KEY);
const savedTitle = localStorage.getItem(TITLE_KEY);
const savedTheme = localStorage.getItem(THEME_KEY);
const savedFontSize = localStorage.getItem(FONT_SIZE_KEY);
const initialFileName = savedTitle ?? "Untitled.md";
const initialContent = savedDraft ?? starterMarkdown;
const initialFileId = crypto.randomUUID();

const state: EditorState = {
  content: initialContent,
  fileName: initialFileName,
  nativePath: null,
  isDirty: Boolean(savedDraft),
  mode: "split",
  theme: savedTheme === "dark" ? "dark" : "light",
  isExplorerOpen: localStorage.getItem(EXPLORER_KEY) !== "false",
  activeFileId: initialFileId,
  zoomPercent: parseSavedZoom(savedFontSize),
  openFiles: [
    {
      id: initialFileId,
      name: initialFileName,
      content: initialContent,
      nativePath: null,
      isDirty: Boolean(savedDraft)
    }
  ]
};

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <section class="document-meta" aria-label="Document details">
        <input class="title-input" value="${escapeAttribute(state.fileName)}" aria-label="File name" />
        <span class="save-state">Draft saved locally</span>
      </section>

      <nav class="toolbar" aria-label="Editor tools">
        <button class="icon-button explorer-toggle" data-action="toggle-explorer" title="Toggle file explorer" aria-label="Toggle file explorer" aria-pressed="true">☰</button>
        <button class="icon-button" data-action="new" title="New document" aria-label="New document">+</button>
        <button class="text-button" data-action="open">Open</button>
        <button class="text-button" data-action="save">Save</button>
        <div class="font-controls" role="group" aria-label="Document zoom">
          <button class="font-button" data-action="font-decrease" aria-label="Zoom out document">A-</button>
          <span class="font-size-label" aria-label="Current document zoom">100%</span>
          <button class="font-button" data-action="font-increase" aria-label="Zoom in document">A+</button>
        </div>
        <div class="segmented" role="group" aria-label="View mode">
          <button data-mode="write">Write</button>
          <button data-mode="split">Split</button>
          <button data-mode="preview">Read</button>
        </div>
        <button class="theme-button" data-action="theme" aria-label="Switch to dark theme" title="Switch theme">
          <span class="theme-dot" aria-hidden="true"></span>
          <span class="theme-label">Light</span>
        </button>
      </nav>
    </header>

    <section class="main-area">
      <aside class="file-explorer" aria-label="File explorer">
        <div class="explorer-header">
          <button class="explorer-disclosure" data-action="collapse-explorer-group" aria-label="Collapse open files" aria-expanded="true">⌄</button>
          <span>Explorer</span>
        </div>
        <div class="explorer-group">
          <div class="explorer-group-title">Open Editors</div>
          <ul class="file-tree" aria-label="Open files"></ul>
        </div>
      </aside>

      <section class="workspace mode-split" aria-label="Markdown editor">
        <textarea class="editor" spellcheck="true" aria-label="Markdown source"></textarea>
        <article class="preview markdown-body" aria-label="Rendered preview"></article>
      </section>
    </section>

    <footer class="statusbar">
      <span class="stat words">0 words</span>
      <span class="stat characters">0 chars</span>
      <span class="stat lines">0 lines</span>
    </footer>
  </main>
`;

const titleInput = requireElement<HTMLInputElement>(".title-input");
const saveState = requireElement<HTMLSpanElement>(".save-state");
const workspace = requireElement<HTMLElement>(".workspace");
const mainArea = requireElement<HTMLElement>(".main-area");
const explorerToggle = requireElement<HTMLButtonElement>(".explorer-toggle");
const explorerDisclosure = requireElement<HTMLButtonElement>(".explorer-disclosure");
const explorerGroup = requireElement<HTMLElement>(".explorer-group");
const fileTree = requireElement<HTMLUListElement>(".file-tree");
const editor = requireElement<HTMLTextAreaElement>(".editor");
const preview = requireElement<HTMLElement>(".preview");
const wordStat = requireElement<HTMLSpanElement>(".words");
const charStat = requireElement<HTMLSpanElement>(".characters");
const lineStat = requireElement<HTMLSpanElement>(".lines");
const themeButton = requireElement<HTMLButtonElement>(".theme-button");
const themeLabel = requireElement<HTMLSpanElement>(".theme-label");
const fontDecreaseButton = requireElement<HTMLButtonElement>("[data-action='font-decrease']");
const fontIncreaseButton = requireElement<HTMLButtonElement>("[data-action='font-increase']");
const fontSizeLabel = requireElement<HTMLSpanElement>(".font-size-label");
const modeButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-mode]"));
let activeScrollSource: "editor" | "preview" | null = null;

editor.value = state.content;
render();

editor.addEventListener("input", () => {
  state.content = editor.value;
  state.isDirty = true;
  persistDraft();
  syncActiveFile();
  render();
});

editor.addEventListener("scroll", () => {
  syncScroll(editor, preview, "editor");
});

preview.addEventListener("scroll", () => {
  syncScroll(preview, editor, "preview");
});

titleInput.addEventListener("input", () => {
  state.fileName = normalizeFileName(titleInput.value);
  state.isDirty = true;
  syncActiveFile();
  localStorage.setItem(TITLE_KEY, state.fileName);
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

  if (action === "theme") {
    toggleTheme();
    return;
  }

  if (action === "font-decrease") {
    changeFontSize(-1);
    return;
  }

  if (action === "font-increase") {
    changeFontSize(1);
    return;
  }

  if (action === "toggle-explorer") {
    toggleExplorer();
    return;
  }

  if (action === "collapse-explorer-group") {
    toggleExplorerGroup();
    return;
  }

  if (action === "select-file" && target.dataset.fileId) {
    selectOpenFile(target.dataset.fileId);
    return;
  }

  if (action === "close-file" && target.dataset.fileId) {
    closeOpenFile(target.dataset.fileId);
  }
});

document.addEventListener("keydown", async (event) => {
  const isCommand = event.metaKey || event.ctrlKey;

  if (!isCommand) {
    return;
  }

  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    await saveDocument();
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

function render() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(state.content, { async: false }));
  renderStats();
  renderMode();
  renderTheme();
  renderFontSize();
  renderExplorer();
  renderSaveState();
  requestAnimationFrame(() => {
    syncScroll(editor, preview, "editor");
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
}

function renderSaveState(message?: string) {
  if (message) {
    saveState.textContent = message;
    return;
  }

  saveState.textContent = state.isDirty ? "Unsaved changes" : "Saved";
}

function renderExplorer() {
  mainArea.classList.toggle("explorer-closed", !state.isExplorerOpen);
  explorerToggle.setAttribute("aria-pressed", String(state.isExplorerOpen));
  explorerToggle.classList.toggle("active", state.isExplorerOpen);

  fileTree.innerHTML = state.openFiles
    .map((file) => {
      const activeClass = file.id === state.activeFileId ? " active" : "";
      const dirtyMark = file.isDirty ? "<span class=\"dirty-mark\" aria-hidden=\"true\" title=\"Unsaved changes\"></span>" : "";

      return `
        <li>
          <button class="file-item${activeClass}" data-action="select-file" data-file-id="${file.id}" title="${escapeAttribute(file.name)}" aria-label="${escapeAttribute(file.name)}">
            <span class="file-chevron" aria-hidden="true">›</span>
            <span class="file-icon" aria-hidden="true">M</span>
            <span class="file-name">${escapeHtml(file.name)}</span>
            ${dirtyMark}
          </button>
          <button class="file-close" data-action="close-file" data-file-id="${file.id}" aria-label="Close ${escapeAttribute(file.name)}">×</button>
        </li>
      `;
    })
    .join("");
}

function setMode(mode: ViewMode) {
  state.mode = mode;
  renderMode();
}

function renderTheme() {
  document.documentElement.dataset.theme = state.theme;
  themeLabel.textContent = state.theme === "light" ? "Light" : "Dark";
  themeButton.setAttribute(
    "aria-label",
    state.theme === "light" ? "Switch to dark theme" : "Switch to light theme"
  );
  themeButton.setAttribute("aria-pressed", String(state.theme === "dark"));
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, state.theme);
  renderTheme();
}

function renderFontSize() {
  document.documentElement.style.setProperty("--content-scale", `${state.zoomPercent / 100}`);
  fontSizeLabel.textContent = `${state.zoomPercent}%`;
  fontDecreaseButton.disabled = state.zoomPercent <= MIN_ZOOM_PERCENT;
  fontIncreaseButton.disabled = state.zoomPercent >= MAX_ZOOM_PERCENT;
}

function changeFontSize(delta: number) {
  state.zoomPercent = clampZoom(state.zoomPercent + delta * ZOOM_STEP);
  localStorage.setItem(FONT_SIZE_KEY, String(state.zoomPercent));
  renderFontSize();
  requestAnimationFrame(() => {
    syncScroll(editor, preview, "editor");
  });
}

function createNewDocument() {
  const file = createOpenFile("Untitled.md", "", false);

  state.openFiles.push(file);
  activateFile(file.id);
  render();
  editor.focus();
}

async function openDocument() {
  try {
    await openTauriDocument();
  } catch (error) {
    console.error(error);
    renderSaveState("Could not open file");
  }
}

async function saveDocument() {
  try {
    await saveTauriDocument();
  } catch (error) {
    console.error(error);
    renderSaveState("Could not save file");
  }
}

async function openTauriDocument() {
  const file = await invoke<TauriMarkdownFile | null>("open_markdown_file");

  if (!file) {
    return;
  }

  loadNativeFile(file);
}

async function saveTauriDocument() {
  const savedFile = await invoke<TauriSavedMarkdownFile | null>("save_markdown_file", {
    path: state.nativePath,
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

  render();
}

function persistDraft() {
  localStorage.setItem(DRAFT_KEY, state.content);
  localStorage.setItem(TITLE_KEY, state.fileName);
}

function markSaved(message = "Saved") {
  state.isDirty = false;
  syncActiveFile();
  persistDraft();
  renderExplorer();
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
  editor.value = file.content;
  titleInput.value = file.name;
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

  render();
}

function toggleExplorer() {
  state.isExplorerOpen = !state.isExplorerOpen;
  localStorage.setItem(EXPLORER_KEY, String(state.isExplorerOpen));
  renderExplorer();
}

function toggleExplorerGroup() {
  const isExpanded = explorerDisclosure.getAttribute("aria-expanded") !== "false";

  explorerDisclosure.setAttribute("aria-expanded", String(!isExpanded));
  explorerDisclosure.textContent = isExpanded ? "›" : "⌄";
  explorerGroup.classList.toggle("collapsed", isExpanded);
}

function syncScroll(source: HTMLElement, target: HTMLElement, sourceName: "editor" | "preview") {
  if (activeScrollSource && activeScrollSource !== sourceName) {
    return;
  }

  const sourceScrollable = source.scrollHeight - source.clientHeight;
  const targetScrollable = target.scrollHeight - target.clientHeight;

  if (sourceScrollable <= 0 || targetScrollable <= 0) {
    return;
  }

  activeScrollSource = sourceName;
  const ratio = source.scrollTop / sourceScrollable;
  target.scrollTop = targetScrollable * ratio;

  requestAnimationFrame(() => {
    activeScrollSource = null;
  });
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

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
