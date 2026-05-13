import DOMPurify from "dompurify";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { marked } from "marked";
import "./styles.css";

const DRAFT_KEY = "light-md-editor:draft";
const TITLE_KEY = "light-md-editor:title";
const THEME_KEY = "light-md-editor:theme";
const SIDEBAR_KEY = "light-md-editor:sidebar-open";
const ZOOM_KEY = "light-md-editor:zoom-percent";
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

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const savedDraft = localStorage.getItem(DRAFT_KEY);
const savedTitle = localStorage.getItem(TITLE_KEY);
const savedTheme = localStorage.getItem(THEME_KEY);
const savedZoom = localStorage.getItem(ZOOM_KEY);
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
  isSidebarOpen: localStorage.getItem(SIDEBAR_KEY) !== "false",
  activeFileId: initialFileId,
  zoomPercent: parseSavedZoom(savedZoom),
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
      <div class="topbar-leading">
        <button class="icon-button sidebar-toggle" data-action="toggle-sidebar" title="Toggle documents" aria-label="Toggle documents" aria-pressed="true">☰</button>
        <section class="document-meta" aria-label="Document details">
          <input class="title-input" value="${escapeAttribute(state.fileName)}" aria-label="File name" />
          <span class="save-state">Draft saved locally</span>
        </section>
      </div>

      <nav class="toolbar" aria-label="Editor tools">
        <button class="text-button" data-action="save">Save</button>
        <div class="segmented" role="group" aria-label="View mode">
          <button data-mode="write">Write</button>
          <button data-mode="split">Split</button>
          <button data-mode="preview">Read</button>
        </div>
        <div class="font-controls" role="group" aria-label="Document zoom">
          <button class="font-button" data-action="font-decrease" aria-label="Zoom out document">A-</button>
          <span class="font-size-label" aria-label="Current document zoom">100%</span>
          <button class="font-button" data-action="font-increase" aria-label="Zoom in document">A+</button>
        </div>
        <button class="theme-button" data-action="theme" aria-label="Switch to dark theme" title="Switch theme">
          <span class="theme-dot" aria-hidden="true"></span>
          <span class="theme-label">Light</span>
        </button>
      </nav>
    </header>

    <section class="main-area">
      <aside class="document-drawer" aria-label="Documents">
        <div class="drawer-panel">
          <div class="drawer-actions">
            <button class="drawer-action primary" data-action="new">New</button>
            <button class="drawer-action" data-action="open">Open File</button>
          </div>

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
const mainArea = requireElement<HTMLElement>(".main-area");
const sidebarToggle = requireElement<HTMLButtonElement>(".sidebar-toggle");
const documentList = requireElement<HTMLUListElement>(".document-list");
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
const documentCount = requireElement<HTMLSpanElement>(".drawer-section-count");
const shortcutCopy = requireElement<HTMLParagraphElement>(".shortcut-copy");
const dialogBackdrop = requireElement<HTMLDivElement>(".dialog-backdrop");
const confirmDialogMessage = requireElement<HTMLParagraphElement>(".confirm-dialog-message");
const confirmCloseSaveButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-save']");
const modeButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-mode]"));

let activeScrollSource: "editor" | "preview" = "editor";
let programmaticScrollSource: "editor" | "preview" | null = null;
let pendingCloseRequest: PendingCloseRequest | null = null;

editor.value = state.content;
void setupMenuListener();
render();

editor.addEventListener("input", () => {
  state.content = editor.value;
  state.isDirty = true;
  activeScrollSource = "editor";
  persistDraft();
  syncActiveFile();
  render();
});

editor.addEventListener("scroll", () => {
  if (programmaticScrollSource === "editor" || state.mode !== "split") {
    return;
  }

  syncScroll(editor, preview, "editor");
});

preview.addEventListener("scroll", () => {
  if (programmaticScrollSource === "preview" || state.mode !== "split") {
    return;
  }

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

function render() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(state.content, { async: false }));
  renderStats();
  renderMode();
  renderTheme();
  renderZoom();
  renderDocuments();
  renderShortcuts();
  renderSaveState();
  requestAnimationFrame(() => {
    syncActiveScroll();
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

function renderDocuments() {
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
        toggleTheme();
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
    localStorage.setItem(TITLE_KEY, state.fileName);
    render();
  }
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
  const userAgent = navigator.userAgent.toLowerCase();
  const isMac = userAgent.includes("mac");

  if (isMac) {
    return "Use <kbd>Cmd</kbd> + <kbd>O</kbd>, <kbd>N</kbd>, <kbd>S</kbd> for open, new, and save.";
  }

  return "Use <kbd>Ctrl</kbd> + <kbd>O</kbd>, <kbd>N</kbd>, <kbd>S</kbd> for open, new, and save.";
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
