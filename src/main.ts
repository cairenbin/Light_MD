import DOMPurify from "dompurify";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { marked } from "marked";
import "./styles.css";

import type {
  AutocompleteShortcutOption,
  EditorHistorySnapshot,
  EditorSelectionEdit,
  EditorState,
  OpenFile,
  TauriMarkdownFile,
  TauriSavedMarkdownFile,
  ViewMode
} from "./types";
import {
  MAX_HISTORY_STACK
} from "./constants";
import { formatMessage, translate, type TranslationKey } from "./i18n/dictionaries";
import { escapeAttribute, escapeHtml } from "./utils/html";
import { documentInitial, formatPathForDisplay, normalizeFileName } from "./utils/path";
import { isMacPlatform } from "./utils/platform";
import {
  parseSavedAutocompleteShortcutId as parseSavedAutocompleteShortcutIdImpl
} from "./utils/storage";
import {
  loadInitialSession,
  persistDraft,
  persistSidebar,
  pushRecentFile,
  removeRecentFile,
  syncRecentMenu
} from "./storage/session";
import { createAutocompleteController } from "./ui/autocomplete";
import { createFindController } from "./ui/find";
import { createInsertController } from "./ui/insert-menu";
import { createSettingsController } from "./ui/settings";
import {
  activeScrollSource,
  autocompleteState,
  currentHistorySnapshot,
  globalEventListeners,
  isApplyingHistoryChange,
  isInsertMenuOpen,
  isSettingsMenuOpen,
  pendingCloseRequest,
  pendingScrollSyncFrame,
  programmaticScrollSource,
  recentFiles,
  redoHistoryStack,
  setActiveScrollSource,
  setCurrentHistorySnapshot,
  setIsApplyingHistoryChange,
  setPendingCloseRequest,
  setPendingScrollSyncFrame,
  setProgrammaticScrollSource,
  state,
  undoHistoryStack
} from "./state";
import {
  charStat,
  confirmCloseCancelButton,
  confirmCloseDiscardButton,
  confirmCloseSaveButton,
  confirmDialogMessage,
  confirmDialogTitle,
  dialogBackdrop,
  documentCount,
  documentList,
  drawerNoteTitle,
  drawerSectionTitle,
  editor,
  fileActionButtons,
  formattingButtons,
  initDom,
  insertMenuButton,
  lineStat,
  mainArea,
  modeButtons,
  preview,
  saveState,
  shortcutCopy,
  sidebarToggle,
  titleInput,
  topbar,
  wordStat,
  workspace
} from "./dom";

marked.use({
  gfm: true,
  breaks: false
});

function t(key: TranslationKey) {
  return translate(state.locale, key);
}

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


const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const initial = loadInitialSession(getAvailableAutocompleteShortcutOptions());
Object.assign(state, initial.state satisfies EditorState);
recentFiles.push(...initial.recentFiles);

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
                <h3 class="settings-group-title" data-settings-group="theme"></h3>
                <div class="settings-choice" role="group" aria-label="Theme mode">
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="light"></button>
                  <button class="settings-option-button" data-action="set-theme" data-theme-value="dark"></button>
                </div>
              </section>

              <section class="settings-group" aria-label="Document zoom">
                <h3 class="settings-group-title" data-settings-group="zoom"></h3>
                <div class="font-controls settings-zoom-controls" role="group" aria-label="Document zoom">
                  <button class="font-button" data-action="font-decrease" aria-label="">A-</button>
                  <span class="font-size-label settings-zoom-label" aria-label="Current document zoom">100%</span>
                  <button class="font-button" data-action="font-increase" aria-label="">A+</button>
                </div>
              </section>

              <section class="settings-group" aria-label="Autocomplete shortcut">
                <h3 class="settings-group-title" data-settings-group="autocomplete"></h3>
                <label class="settings-field">
                  <span class="settings-field-label" data-settings-field="trigger"></span>
                  <select class="settings-shortcut-select" aria-label="Autocomplete shortcut"></select>
                </label>
              </section>

              <section class="settings-group" aria-label="Language">
                <h3 class="settings-group-title" data-settings-group="language"></h3>
                <label class="settings-field">
                  <span class="settings-field-label" data-settings-field="language"></span>
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

initDom(app);

const autocompleteController = createAutocompleteController({
  applyEditorEdit,
  getAvailableShortcutOptions: getAvailableAutocompleteShortcutOptions
});
autocompleteController.bindListeners();

const findController = createFindController({
  applyEditorEdit,
  syncTextFieldState,
  closeInsertMenu: (restoreFocus?: boolean) => insertController.closeMenu(restoreFocus),
  closeSettingsMenu: (restoreFocus?: boolean) => settingsController.closeMenu(restoreFocus),
  closeAutocomplete: () => autocompleteController.close()
});
findController.bindListeners();

const settingsController = createSettingsController({
  render,
  renderShortcutsDrawer: renderShortcuts,
  closeInsertMenu: (restoreFocus?: boolean) => insertController.closeMenu(restoreFocus),
  closeAutocomplete: () => autocompleteController.close(),
  syncActiveScroll,
  getAvailableShortcutOptions: getAvailableAutocompleteShortcutOptions,
  parseSavedShortcutId: parseSavedAutocompleteShortcutId,
  getShortcutOptionLabel
});
settingsController.bindListeners();

const insertController = createInsertController({
  applyEditorEdit,
  getEditorAutocompleteContext: () => autocompleteController.getEditorContext(),
  closeSettingsMenu: (restoreFocus?: boolean) => settingsController.closeMenu(restoreFocus),
  closeAutocomplete: () => autocompleteController.close(),
  setMode
});
insertController.bindListeners();

editor.value = state.content;
resetEditorHistory();
void setupMenuListener();
void syncRecentMenu();
render();
persistDraft();

const resizeListener = () => {
  insertController.updateMenuPosition();
  autocompleteController.updatePosition();
};
window.addEventListener("resize", resizeListener);
globalEventListeners.push({ target: window, type: "resize", listener: resizeListener });

editor.addEventListener("input", () => {
  state.content = editor.value;
  state.isDirty = true;
  setActiveScrollSource("editor");
  persistDraft();
  syncActiveFile();
  render();
  autocompleteController.refresh(false);
});

editor.addEventListener("scroll", () => {
  if (programmaticScrollSource === "editor" || state.mode !== "split") {
    autocompleteController.updatePosition();
    return;
  }

  scheduleScrollSync(editor, preview, "editor");
  autocompleteController.updatePosition();
});

preview.addEventListener("scroll", () => {
  if (programmaticScrollSource === "preview" || state.mode !== "split") {
    return;
  }

  scheduleScrollSync(preview, editor, "preview");
});

editor.addEventListener("keydown", (event) => {
  if (autocompleteController.handleKeydown(event)) {
    return;
  }

  autocompleteController.handleContinuation(event);
});

editor.addEventListener("click", () => {
  autocompleteController.refresh(false);
});

editor.addEventListener("keyup", (event) => {
  if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
    autocompleteController.refresh(autocompleteState.manual);
  }
});

editor.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (document.activeElement !== editor) {
      autocompleteController.close();
    }
  }, 120);
});

titleInput.addEventListener("input", () => {
  state.fileName = normalizeFileName(titleInput.value);
  state.isDirty = true;
  syncActiveFile();
  persistDraft();
  render();
});

app.addEventListener("click", async (event) => {
  const target =
    event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-action], [data-mode]") : null;

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

  if (action && insertController.handleAction(action, target)) {
    return;
  }

  if (action && settingsController.handleAction(action, target)) {
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

  if (action && (await findController.handleAction(action))) {
    return;
  }
});

const documentKeydownListener: EventListener = async (event) => {
  if (!(event instanceof KeyboardEvent)) {
    return;
  }
  if (event.key === "Escape" && isSettingsMenuOpen) {
    event.preventDefault();
    settingsController.closeMenu(true);
    return;
  }

  if (event.key === "Escape" && isInsertMenuOpen) {
    event.preventDefault();
    insertController.closeMenu(true);
    return;
  }

  if (event.key === "Escape" && pendingCloseRequest) {
    event.preventDefault();
    closeConfirmDialog();
    return;
  }

  if (event.key === "Escape" && findController.isOpen()) {
    event.preventDefault();
    findController.closeFind(true);
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
    if (findController.isOpen() && !findController.showReplace()) {
      findController.closeFind(true);
    } else {
      findController.openFind(false);
    }
    return;
  }

  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    if (findController.isOpen() && findController.showReplace()) {
      findController.closeFind(true);
    } else {
      findController.openFind(true);
    }
    return;
  }

  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    if (findController.isOpen() && findController.showReplace()) {
      findController.closeFind(true);
    } else {
      findController.openFind(true);
    }
    return;
  }
};
document.addEventListener("keydown", documentKeydownListener);
globalEventListeners.push({ target: document, type: "keydown", listener: documentKeydownListener });

dialogBackdrop.addEventListener("click", (event) => {
  if (event.target === dialogBackdrop) {
    closeConfirmDialog();
  }
});

const documentClickListener: EventListener = (event) => {
  if (!(event instanceof MouseEvent)) {
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;

  if (isInsertMenuOpen && !target?.closest(".toolbar-menu-shell")) {
    insertController.closeMenu();
  }

  if (isSettingsMenuOpen && !target?.closest(".settings-shell")) {
    settingsController.closeMenu();
  }
};

document.addEventListener("click", documentClickListener);
globalEventListeners.push({ target: document, type: "click", listener: documentClickListener });

function render() {
  renderLocale();
  preview.innerHTML = DOMPurify.sanitize(marked.parse(state.content, { async: false }));
  renderStats();
  renderMode();
  settingsController.renderTheme();
  settingsController.renderZoom();
  renderDocuments();
  findController.renderPanel();
  insertController.renderMenu();
  settingsController.renderMenu();
  renderShortcuts();
  renderSaveState();
  autocompleteController.renderPanel();
  requestAnimationFrame(() => {
    syncActiveScroll();
    autocompleteController.updatePosition();
  });
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

  drawerSectionTitle.textContent = t("drawer.openDocuments");
  drawerNoteTitle.textContent = t("drawer.shortcuts");
  autocompleteController.renderLabel();
  confirmDialogTitle.textContent = t("dialog.close.title");
  confirmCloseCancelButton.textContent = t("dialog.cancel");
  confirmCloseDiscardButton.textContent = t("dialog.discard");
  confirmCloseSaveButton.textContent = t("dialog.save");
}

function renderMode() {
  workspace.className = `workspace mode-${state.mode}`;

  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  }

  if (state.mode === "preview") {
    autocompleteController.close();
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

function openConfirmDialog(message: string) {
  confirmDialogMessage.textContent = message;
  dialogBackdrop.classList.remove("hidden");
  dialogBackdrop.setAttribute("aria-hidden", "false");
  confirmCloseSaveButton.focus();
}

function closeConfirmDialog() {
  setPendingCloseRequest(null);
  dialogBackdrop.classList.add("hidden");
  dialogBackdrop.setAttribute("aria-hidden", "true");
}

function setMode(mode: ViewMode) {
  state.mode = mode;
  renderMode();
}

function createNewDocument() {
  const file = createOpenFile("Untitled.md", "", false);

  state.openFiles.push(file);
  activateFile(file.id);
  autocompleteController.close();
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
    const existing = state.openFiles[existingIndex];
    if (!existing.isDirty) {
      state.openFiles[existingIndex] = {
        ...existing,
        name: file.name,
        content: file.content,
        nativePath: file.path,
        isDirty: false
      };
    }
    activateFile(state.openFiles[existingIndex].id);
  } else {
    const openFile = createOpenFile(file.name, file.content, false, file.path);
    state.openFiles.push(openFile);
    activateFile(openFile.id);
  }

  autocompleteController.close();
  render();
}

function markSaved(message = t("state.saved")) {
  state.isDirty = false;
  syncActiveFile();
  persistDraft();
  renderDocuments();
  renderSaveState(message);
}

function createOpenFile(name: string, content: string, isDirty: boolean, nativePath: string | null = null): OpenFile {
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
  setActiveScrollSource("editor");
  editor.value = file.content;
  titleInput.value = file.name;
  resetEditorHistory();
  autocompleteController.close();
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

  setPendingCloseRequest({ fileId });
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
  persistSidebar(state.isSidebarOpen);
  renderDocuments();
}

async function setupMenuListener() {
  const unlisten = await listen<string>("app-menu-action", async (event) => {
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
        settingsController.changeZoom(1);
        break;
      case "view.zoom_out":
        settingsController.changeZoom(-1);
        break;
      case "view.actual_size":
        settingsController.resetZoom();
        break;
      case "view.toggle_sidebar":
        toggleSidebar();
        break;
      case "view.toggle_theme":
        settingsController.setTheme(state.theme === "light" ? "dark" : "light");
        break;
      case "edit.find":
        findController.openFind(false);
        break;
      case "edit.replace":
        findController.openFind(true);
        break;
      case "format.bold":
        insertController.applyFormatting("bold");
        break;
      case "format.italic":
        insertController.applyFormatting("italic");
        break;
      case "format.link":
        insertController.applyFormatting("link");
        break;
      case "format.code":
        insertController.applyFormatting("code");
        break;
      case "format.quote":
        insertController.applyFormatting("quote");
        break;
      default:
        break;
    }
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unlisten();
    });
  }
}

async function performEditorAction(action: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll") {
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
    nextSnapshot.value === currentHistorySnapshot.value &&
    nextSnapshot.selectionStart === currentHistorySnapshot.selectionStart &&
    nextSnapshot.selectionEnd === currentHistorySnapshot.selectionEnd
  ) {
    return;
  }

  undoHistoryStack.push(currentHistorySnapshot);

  if (undoHistoryStack.length > MAX_HISTORY_STACK) {
    undoHistoryStack.shift();
  }

  redoHistoryStack.length = 0;
  setCurrentHistorySnapshot(nextSnapshot);
}

function readEditorHistorySnapshot(): EditorHistorySnapshot {
  return {
    value: editor.value,
    selectionStart: editor.selectionStart ?? 0,
    selectionEnd: editor.selectionEnd ?? editor.selectionStart ?? 0
  };
}

function applyEditorHistorySnapshot(snapshot: EditorHistorySnapshot) {
  setIsApplyingHistoryChange(true);
  editor.value = snapshot.value;
  editor.focus();
  editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  setCurrentHistorySnapshot(readEditorHistorySnapshot());
  syncTextFieldState(editor);
  setIsApplyingHistoryChange(false);
}

function resetEditorHistory() {
  undoHistoryStack.length = 0;
  redoHistoryStack.length = 0;
  setCurrentHistorySnapshot(readEditorHistorySnapshot());
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

  if (redoHistoryStack.length > MAX_HISTORY_STACK) {
    redoHistoryStack.shift();
  }

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

  if (undoHistoryStack.length > MAX_HISTORY_STACK) {
    undoHistoryStack.shift();
  }

  applyEditorHistorySnapshot(nextSnapshot);
  return true;
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

function syncTextFieldState(target: HTMLInputElement | HTMLTextAreaElement) {
  if (target === editor) {
    if (!isApplyingHistoryChange) {
      captureEditorHistorySnapshot();
    }

    state.content = editor.value;
    state.isDirty = true;
    setActiveScrollSource("editor");
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

function scheduleScrollSync(source: HTMLElement, target: HTMLElement, sourceName: "editor" | "preview") {
  if (pendingScrollSyncFrame !== 0) {
    cancelAnimationFrame(pendingScrollSyncFrame);
  }

  setPendingScrollSyncFrame(
    requestAnimationFrame(() => {
      setPendingScrollSyncFrame(0);
      syncScroll(source, target, sourceName);
    })
  );
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

  setActiveScrollSource(sourceName);
  const ratio = source.scrollTop / sourceScrollable;
  const nextTop = targetScrollable * ratio;

  if (Math.abs(target.scrollTop - nextTop) < 1) {
    return;
  }

  setProgrammaticScrollSource(sourceName === "editor" ? "preview" : "editor");
  target.scrollTop = nextTop;

  requestAnimationFrame(() => {
    setProgrammaticScrollSource(null);
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

function parseSavedAutocompleteShortcutId(value: string | null): string {
  return parseSavedAutocompleteShortcutIdImpl(value, getAvailableAutocompleteShortcutOptions());
}

function getAvailableAutocompleteShortcutOptions() {
  const platform: "mac" | "other" = isMacPlatform() ? "mac" : "other";
  return autocompleteShortcutOptions.filter((option) => !option.platforms || option.platforms.includes(platform));
}

function buildShortcutMarkup() {
  const isMac = isMacPlatform();
  const autocompleteShortcut =
    getAvailableAutocompleteShortcutOptions().find((option) => option.id === state.autocompleteShortcutId) ??
    getAvailableAutocompleteShortcutOptions()[0];
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    globalEventListeners.forEach(({ target, type, listener }) => {
      target.removeEventListener(type, listener as EventListener);
    });
  });
}
