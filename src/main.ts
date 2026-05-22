import DOMPurify from "dompurify";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { marked } from "marked";
import "./styles.css";

import type {
  AutocompleteShortcutOption,
  EditorState,
  ViewMode
} from "./types";
import { translate, type TranslationKey } from "./i18n/dictionaries";
import { escapeAttribute, escapeHtml } from "./utils/html";
import { documentInitial, formatPathForDisplay, normalizeFileName } from "./utils/path";
import { isMacPlatform } from "./utils/platform";
import {
  parseSavedAutocompleteShortcutId as parseSavedAutocompleteShortcutIdImpl
} from "./utils/storage";
import {
  loadInitialSession,
  persistDraft,
  persistDrawerTab,
  persistSidebar,
  syncRecentMenu
} from "./storage/session";
import { createFilesController } from "./core/files";
import { createAutocompleteController } from "./ui/autocomplete";
import { createFindController } from "./ui/find";
import { createInsertController } from "./ui/insert-menu";
import { createOutlineController } from "./ui/outline";
import { createSettingsController } from "./ui/settings";
import {
  activeScrollSource,
  autocompleteState,
  globalEventListeners,
  isInsertMenuOpen,
  isSettingsMenuOpen,
  pendingCloseRequest,
  pendingScrollSyncFrame,
  programmaticScrollSource,
  recentFiles,
  setActiveScrollSource,
  setPendingScrollSyncFrame,
  setProgrammaticScrollSource,
  state
} from "./state";
import {
  charStat,
  confirmCloseCancelButton,
  confirmCloseDiscardButton,
  confirmCloseSaveButton,
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
          <div class="drawer-tabs" role="tablist">
            <button class="drawer-tab active" data-action="drawer-tab" data-tab="documents" role="tab" aria-selected="true" type="button"></button>
            <button class="drawer-tab" data-action="drawer-tab" data-tab="outline" role="tab" aria-selected="false" type="button"></button>
          </div>
          <section class="drawer-section documents-section">
            <div class="drawer-section-head">
              <span class="drawer-section-title"></span>
              <span class="drawer-section-count">${state.openFiles.length}</span>
            </div>
            <ul class="document-list" aria-label="Open documents"></ul>
          </section>

          <section class="drawer-section outline-section hidden">
            <div class="drawer-section-head">
              <span class="drawer-section-title outline-section-title"></span>
              <span class="drawer-section-count outline-section-count">0</span>
            </div>
            <ul class="outline-list" aria-label="Outline"></ul>
            <p class="outline-empty hidden"></p>
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
              <button class="text-button subtle-button find-option-button" data-action="find-match-regex" type="button">.*</button>
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

const filesController = createFilesController({
  render,
  renderDocuments,
  renderSaveState,
  closeAutocomplete: () => autocompleteController.close()
});

const autocompleteController = createAutocompleteController({
  applyEditorEdit: (edit) => filesController.applyEditorEdit(edit),
  getAvailableShortcutOptions: getAvailableAutocompleteShortcutOptions
});
autocompleteController.bindListeners();

const findController = createFindController({
  applyEditorEdit: (edit) => filesController.applyEditorEdit(edit),
  syncTextFieldState: (target) => filesController.syncTextFieldState(target),
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
  applyEditorEdit: (edit) => filesController.applyEditorEdit(edit),
  getEditorAutocompleteContext: () => autocompleteController.getEditorContext(),
  closeSettingsMenu: (restoreFocus?: boolean) => settingsController.closeMenu(restoreFocus),
  closeAutocomplete: () => autocompleteController.close(),
  setMode
});
insertController.bindListeners();

const outlineController = createOutlineController();

editor.value = state.content;
filesController.resetEditorHistory();
void setupMenuListener();
void setupFileDropListener();
void setupExternalChangeListener();
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
  filesController.syncActiveFile();
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
  filesController.syncActiveFile();
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
    filesController.createNewDocument();
    return;
  }

  if (action === "open") {
    await filesController.openDocument();
    return;
  }

  if (action === "save") {
    await filesController.saveDocument();
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
    filesController.selectOpenFile(target.dataset.fileId);
    return;
  }

  if (action === "drawer-tab" && target.dataset.tab) {
    const nextTab = target.dataset.tab === "outline" ? "outline" : "documents";

    if (state.drawerTab !== nextTab) {
      state.drawerTab = nextTab;
      persistDrawerTab(state.drawerTab);
      outlineController.renderTabs();
      outlineController.renderOutline();
    }

    return;
  }

  if (action === "outline-jump" && target.dataset.line) {
    outlineController.jumpToHeading(Number(target.dataset.line));
    return;
  }

  if (action === "close-file" && target.dataset.fileId) {
    await filesController.requestCloseFile(target.dataset.fileId);
    return;
  }

  if (action === "confirm-close-cancel") {
    filesController.closeConfirmDialog();
    return;
  }

  if (action === "confirm-close-discard") {
    if (pendingCloseRequest?.kind === "reload") {
      filesController.closeConfirmDialog();
    } else {
      filesController.discardPendingClose();
    }
    return;
  }

  if (action === "confirm-close-save") {
    if (pendingCloseRequest?.kind === "reload") {
      filesController.applyPendingReload();
    } else {
      await filesController.saveAndClosePendingFile();
    }
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
    filesController.closeConfirmDialog();
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
    await filesController.performEditorAction(event.shiftKey ? "redo" : "undo");
    return;
  }

  if (event.key.toLowerCase() === "y" && !event.altKey) {
    event.preventDefault();
    await filesController.performEditorAction("redo");
    return;
  }

  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    await (event.shiftKey ? filesController.saveDocumentAs() : filesController.saveDocument());
  }

  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    await filesController.openDocument();
  }

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    filesController.createNewDocument();
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
    filesController.closeConfirmDialog();
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
  outlineController.renderTabs();
  outlineController.renderOutline();
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
  const reloadDialog = pendingCloseRequest?.kind === "reload";
  confirmDialogTitle.textContent = t(reloadDialog ? "dialog.reload.title" : "dialog.close.title");
  confirmCloseCancelButton.textContent = t("dialog.cancel");
  confirmCloseDiscardButton.textContent = t(reloadDialog ? "dialog.reload.keep" : "dialog.discard");
  confirmCloseSaveButton.textContent = t(reloadDialog ? "dialog.reload.confirm" : "dialog.save");
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

function setMode(mode: ViewMode) {
  state.mode = mode;
  renderMode();
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
        filesController.createNewDocument();
        break;
      case "file.open":
        await filesController.openDocument();
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
          await filesController.openRecentDocument(index);
        }
        break;
      }
      case "file.save":
        await filesController.saveDocument();
        break;
      case "file.save_as":
        await filesController.saveDocumentAs();
        break;
      case "file.close":
        await filesController.requestCloseActiveFile();
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

const ACCEPTED_DROP_EXTENSIONS = new Set(["md", "markdown", "txt"]);

function hasAcceptedExtension(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  if (lastDot < 0) {
    return false;
  }
  return ACCEPTED_DROP_EXTENSIONS.has(path.slice(lastDot + 1).toLowerCase());
}

async function setupFileDropListener() {
  const unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== "drop") {
      return;
    }

    for (const path of event.payload.paths) {
      if (!hasAcceptedExtension(path)) {
        continue;
      }
      await filesController.openPath(path);
    }
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unlisten();
    });
  }
}

async function setupExternalChangeListener() {
  const unlisten = await listen<{ path: string }>("external-file-changed", async (event) => {
    await filesController.handleExternalChange(event.payload.path);
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unlisten();
    });
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
