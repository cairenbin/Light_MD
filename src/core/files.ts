import { invoke } from "@tauri-apps/api/core";
import { MAX_HISTORY_STACK } from "../constants";
import {
  confirmCloseSaveButton,
  confirmDialogMessage,
  dialogBackdrop,
  editor,
  titleInput
} from "../dom";
import { formatMessage, translate, type TranslationKey } from "../i18n/dictionaries";
import {
  persistDraft,
  pushRecentFile,
  removeRecentFile
} from "../storage/session";
import {
  currentHistorySnapshot,
  pendingCloseRequest,
  recentFiles,
  redoHistoryStack,
  setActiveScrollSource,
  setCurrentHistorySnapshot,
  setIsApplyingHistoryChange,
  setPendingCloseRequest,
  state,
  undoHistoryStack,
  isApplyingHistoryChange
} from "../state";
import type {
  EditorHistorySnapshot,
  EditorSelectionEdit,
  OpenFile,
  TauriMarkdownFile,
  TauriSavedMarkdownFile
} from "../types";
import { normalizeFileName } from "../utils/path";

export interface FilesControllerDeps {
  render: () => void;
  renderDocuments: () => void;
  renderSaveState: (message?: string) => void;
  closeAutocomplete: () => void;
}

export interface FilesController {
  applyEditorEdit: (edit: EditorSelectionEdit) => void;
  syncTextFieldState: (target: HTMLInputElement | HTMLTextAreaElement) => void;
  syncActiveFile: () => void;

  performEditorAction: (action: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll") => Promise<void>;

  resetEditorHistory: () => void;
  undoEditorHistory: () => boolean;
  redoEditorHistory: () => boolean;

  createNewDocument: () => void;
  openDocument: () => Promise<void>;
  openRecentDocument: (index: number) => Promise<void>;
  saveDocument: () => Promise<boolean | undefined>;
  saveDocumentAs: () => Promise<boolean | undefined>;
  saveCurrentDocument: (forceDialog?: boolean) => Promise<boolean | undefined>;
  loadNativeFile: (file: TauriMarkdownFile) => void;

  selectOpenFile: (fileId: string) => void;
  requestCloseFile: (fileId: string) => Promise<void>;
  requestCloseActiveFile: () => Promise<void>;
  closeOpenFile: (fileId: string) => void;
  discardPendingClose: () => void;
  saveAndClosePendingFile: () => Promise<void>;

  openConfirmDialog: (message: string) => void;
  closeConfirmDialog: () => void;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

export function createFilesController(deps: FilesControllerDeps): FilesController {
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

  function readEditorHistorySnapshot(): EditorHistorySnapshot {
    return {
      value: editor.value,
      selectionStart: editor.selectionStart ?? 0,
      selectionEnd: editor.selectionEnd ?? editor.selectionStart ?? 0
    };
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
      deps.render();
      return;
    }

    if (target === titleInput) {
      state.fileName = normalizeFileName(titleInput.value);
      state.isDirty = true;
      syncActiveFile();
      persistDraft();
      deps.render();
    }
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
    deps.closeAutocomplete();
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

  function markSaved(message = t("state.saved")) {
    state.isDirty = false;
    syncActiveFile();
    persistDraft();
    deps.renderDocuments();
    deps.renderSaveState(message);
  }

  function createNewDocument() {
    const file = createOpenFile("Untitled.md", "", false);

    state.openFiles.push(file);
    activateFile(file.id);
    deps.closeAutocomplete();
    deps.render();
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
      deps.renderSaveState(t("state.openFailed"));
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
        deps.renderSaveState(t("state.openFailed"));
        return;
      }

      loadNativeFile(file);
    } catch (error) {
      console.error(error);
      removeRecentFile(recentPath);
      deps.renderSaveState(t("state.openFailed"));
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
      deps.renderSaveState(t("state.saveFailed"));
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

    deps.closeAutocomplete();
    deps.render();
  }

  function selectOpenFile(fileId: string) {
    syncActiveFile();
    activateFile(fileId);
    deps.render();
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
    deps.render();
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
      deps.render();
    }

    const didSave = await saveCurrentDocument();

    if (!didSave) {
      if (activeFileBeforeSave !== state.activeFileId) {
        const previousFile = state.openFiles.find((item) => item.id === activeFileBeforeSave);
        if (previousFile) {
          activateFile(previousFile.id);
          deps.render();
        }
      }
      return;
    }

    const fileId = pendingCloseRequest.fileId;
    closeConfirmDialog();
    closeOpenFile(fileId);
  }

  return {
    applyEditorEdit,
    syncTextFieldState,
    syncActiveFile,
    performEditorAction,
    resetEditorHistory,
    undoEditorHistory,
    redoEditorHistory,
    createNewDocument,
    openDocument,
    openRecentDocument,
    saveDocument,
    saveDocumentAs,
    saveCurrentDocument,
    loadNativeFile,
    selectOpenFile,
    requestCloseFile,
    requestCloseActiveFile,
    closeOpenFile,
    discardPendingClose,
    saveAndClosePendingFile,
    openConfirmDialog,
    closeConfirmDialog
  };
}
