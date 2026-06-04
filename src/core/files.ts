import { invoke } from "@tauri-apps/api/core";
import { MAX_HISTORY_STACK } from "../constants";
import DOMPurify from "dompurify";
import {
  confirmCloseSaveButton,
  confirmDialogMessage,
  dialogBackdrop,
  editor,
  titleInput
} from "../dom";
import { formatMessage, translate, type TranslationKey } from "../i18n/dictionaries";
import { renderMarkdownToHtml } from "../editor/markdown-renderer";
import { buildExportHtmlDocument, toHtmlExportFileName } from "../utils/export-html";
import { renderHtmlToPdfBytes, toPdfExportFileName } from "../utils/export-pdf";
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
  TauriCleanedAssetsResult,
  EditorHistorySnapshot,
  EditorSelectionEdit,
  OpenFile,
  TauriMarkdownFile,
  TauriSavedPdfFile,
  TauriSavedImageAsset,
  TauriSavedMarkdownFile
} from "../types";
import { buildImageSavePlan, buildMarkdownImageLink } from "../utils/image";
import {
  extractMarkdownImagePaths,
  extractMarkdownImageSources,
  replaceMarkdownImageSources
} from "../utils/markdown-assets";
import { normalizeFileName, resolveDocumentRelativePath } from "../utils/path";
import { logError } from "../utils/logger";

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
  openPath: (path: string) => Promise<void>;
  openRecentDocument: (index: number) => Promise<void>;
  saveDocument: () => Promise<boolean | undefined>;
  saveDocumentAs: () => Promise<boolean | undefined>;
  saveCurrentDocument: (forceDialog?: boolean) => Promise<boolean | undefined>;
  exportCurrentDocumentAsHtml: () => Promise<boolean | undefined>;
  exportCurrentDocumentAsPdf: () => Promise<boolean | undefined>;
  loadNativeFile: (file: TauriMarkdownFile) => void;
  insertImageFromPath: (path: string) => Promise<boolean>;
  insertImageFromClipboardFile: (file: File) => Promise<boolean>;
  cleanUnusedAssetsForCurrentDocument: () => Promise<boolean>;
  downloadRemoteImagesForCurrentDocument: () => Promise<boolean>;

  selectOpenFile: (fileId: string) => void;
  requestCloseFile: (fileId: string) => Promise<void>;
  requestCloseActiveFile: () => Promise<void>;
  closeOpenFile: (fileId: string) => void;
  discardPendingClose: () => void;
  saveAndClosePendingFile: () => Promise<void>;

  openConfirmDialog: (message: string) => void;
  closeConfirmDialog: () => void;

  handleExternalChange: (path: string) => Promise<void>;
  applyPendingReload: () => void;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

function isExternalImageSource(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  return (
    lowered.startsWith("http://") ||
    lowered.startsWith("https://") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("blob:") ||
    lowered.startsWith("mailto:")
  );
}

function isRemoteHttpSource(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  return lowered.startsWith("http://") || lowered.startsWith("https://");
}

function isAbsoluteNativePath(value: string): boolean {
  return value.startsWith("/") || /^[a-zA-Z]:[\\/]/u.test(value);
}

function pathFromFileUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("file://")) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "file:") {
      return null;
    }
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

export function createFilesController(deps: FilesControllerDeps): FilesController {
  function watchPath(path: string) {
    invoke("watch_file", { path }).catch((error) => {
      logError("watch_file failed", error);
    });
  }

  function unwatchPath(path: string) {
    invoke("unwatch_file", { path }).catch((error) => {
      logError("unwatch_file failed", error);
    });
  }

  function isPathStillOpenElsewhere(path: string, exceptFileId: string) {
    return state.openFiles.some((item) => item.id !== exceptFileId && item.nativePath === path);
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

  function buildImageInsertEdit(relativePath: string, fileName: string): EditorSelectionEdit {
    const start = editor.selectionStart ?? 0;
    const end = editor.selectionEnd ?? start;
    const selectedText = editor.value.slice(start, end).trim();
    const fallbackAltText = fileName.replace(/\.[^.]+$/u, "") || "image";
    const altText = selectedText || fallbackAltText;
    const snippet = buildMarkdownImageLink(relativePath, altText);
    const cursor = start + snippet.length;

    return {
      start,
      end,
      text: snippet,
      selectionStart: cursor,
      selectionEnd: cursor
    };
  }

  function getImageTargetDocumentPath(): string | null {
    if (!state.nativePath) {
      deps.renderSaveState(t("state.imageNeedsSavedFile"));
      return null;
    }

    return state.nativePath;
  }

  function extractBase64Data(dataUrl: string): string | null {
    const marker = "base64,";
    const markerIndex = dataUrl.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const value = dataUrl.slice(markerIndex + marker.length).trim();
    return value || null;
  }

  async function fileToBase64Data(file: File): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          resolve(null);
          return;
        }
        resolve(extractBase64Data(reader.result));
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async function insertSavedImage(savedAsset: TauriSavedImageAsset): Promise<boolean> {
    deps.closeAutocomplete();
    applyEditorEdit(buildImageInsertEdit(savedAsset.relativePath, savedAsset.fileName));
    deps.renderSaveState(formatMessage(t("state.imageInserted"), { name: savedAsset.fileName }));
    return true;
  }

  async function insertImageFromPath(path: string): Promise<boolean> {
    const documentPath = getImageTargetDocumentPath();

    if (!documentPath) {
      return false;
    }

    try {
      const plan = buildImageSavePlan({
        markdownPath: documentPath,
        sourceName: path
      });
      const savedAsset = await invoke<TauriSavedImageAsset>("copy_image_to_assets", {
        sourcePath: path,
        documentPath,
        targetFileName: plan.fileName
      });
      return insertSavedImage(savedAsset);
    } catch (error) {
      logError("insertImageFromPath failed", error);
      deps.renderSaveState(t("state.imageInsertFailed"));
      return false;
    }
  }

  async function insertImageFromClipboardFile(file: File): Promise<boolean> {
    const documentPath = getImageTargetDocumentPath();

    if (!documentPath) {
      return false;
    }

    const base64Data = await fileToBase64Data(file);

    if (!base64Data) {
      deps.renderSaveState(t("state.imageInsertFailed"));
      return false;
    }

    try {
      const plan = buildImageSavePlan({
        markdownPath: documentPath,
        sourceName: file.name,
        mimeType: file.type
      });
      const savedAsset = await invoke<TauriSavedImageAsset>("save_image_to_assets", {
        documentPath,
        base64Data,
        mimeType: file.type,
        targetFileName: plan.fileName
      });
      return insertSavedImage(savedAsset);
    } catch (error) {
      logError("insertImageFromClipboardFile failed", error);
      deps.renderSaveState(t("state.imageInsertFailed"));
      return false;
    }
  }

  async function cleanUnusedAssetsForCurrentDocument(): Promise<boolean> {
    if (!state.nativePath) {
      deps.renderSaveState(t("state.imageNeedsSavedFile"));
      return false;
    }

    try {
      const referencedSources = extractMarkdownImageSources(state.content);
      const result = await invoke<TauriCleanedAssetsResult>("clean_unused_assets_for_document", {
        documentPath: state.nativePath,
        referencedSources
      });

      deps.renderSaveState(formatMessage(t("state.assetsCleaned"), { count: String(result.movedCount) }));
      return true;
    } catch (error) {
      logError("cleanUnusedAssetsForCurrentDocument failed", error);
      deps.renderSaveState(t("state.assetsCleanFailed"));
      return false;
    }
  }

  async function downloadRemoteImagesForCurrentDocument(): Promise<boolean> {
    const documentPath = getImageTargetDocumentPath();

    if (!documentPath) {
      return false;
    }

    const remoteUrls = extractMarkdownImagePaths(state.content).filter(isRemoteHttpSource);

    if (remoteUrls.length === 0) {
      deps.renderSaveState(t("state.imagesDownloadNone"));
      return false;
    }

    deps.renderSaveState(t("state.imagesDownloading"));

    // Downloads run in the Rust process, so they bypass the webview CSP that
    // blocks remote https images. Each saved asset maps its original URL to a
    // local relative path; failures are skipped so one bad URL never aborts the
    // rest.
    const mapping = new Map<string, string>();
    const downloadDate = new Date();

    for (let index = 0; index < remoteUrls.length; index += 1) {
      const url = remoteUrls[index];
      const plan = buildImageSavePlan({
        markdownPath: documentPath,
        sourceName: url,
        date: downloadDate
      });
      const fileStem = `${plan.fileName.replace(/\.[^.]+$/u, "")}-${index + 1}`;

      try {
        const savedAsset = await invoke<TauriSavedImageAsset>("download_remote_image", {
          documentPath,
          url,
          fileStem
        });
        mapping.set(url, savedAsset.relativePath);
      } catch (error) {
        logError("download_remote_image failed", error);
      }
    }

    if (mapping.size === 0) {
      deps.renderSaveState(t("state.imagesDownloadFailed"));
      return false;
    }

    const nextContent = replaceMarkdownImageSources(state.content, mapping);
    if (nextContent !== state.content) {
      applyEditorEdit({ start: 0, end: editor.value.length, text: nextContent });
    }

    deps.renderSaveState(
      formatMessage(t("state.imagesDownloaded"), {
        done: String(mapping.size),
        total: String(remoteUrls.length)
      })
    );
    return true;
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
      logError("openDocument failed", error);
      deps.renderSaveState(t("state.openFailed"));
    }
  }

  async function openPath(path: string) {
    try {
      const file = await invoke<TauriMarkdownFile | null>("open_markdown_file_from_path", {
        path
      });

      if (!file) {
        deps.renderSaveState(t("state.openFailed"));
        return;
      }

      loadNativeFile(file);
    } catch (error) {
      logError("openPath failed", error);
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
      logError("openRecentDocument failed", error);
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
    const previousPath = state.nativePath;
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

      if (previousPath !== savedFile.path) {
        if (previousPath && !isPathStillOpenElsewhere(previousPath, state.activeFileId)) {
          unwatchPath(previousPath);
        }
        watchPath(savedFile.path);
      }

      markSaved();
      return true;
    } catch (error) {
      logError("saveCurrentDocument failed", error);
      deps.renderSaveState(t("state.saveFailed"));
      return false;
    }
  }

  async function exportCurrentDocumentAsHtml() {
    try {
      const suggestedName = toHtmlExportFileName(state.fileName);
      const sanitizedHtmlBody = DOMPurify.sanitize(renderMarkdownToHtml(state.content));
      const htmlContainer = document.createElement("div");
      htmlContainer.innerHTML = sanitizedHtmlBody;
      const images = Array.from(htmlContainer.querySelectorAll<HTMLImageElement>("img[src]"));

      for (const image of images) {
        const source = (image.getAttribute("src") ?? "").trim();
        if (!source || isExternalImageSource(source)) {
          continue;
        }

        const decodedSource = (() => {
          try {
            return decodeURIComponent(source);
          } catch {
            return source;
          }
        })();

        let absolutePath: string | null = null;

        if (state.nativePath) {
          absolutePath = resolveDocumentRelativePath(state.nativePath, decodedSource);
        }

        if (!absolutePath) {
          absolutePath = pathFromFileUrl(decodedSource);
        }

        if (!absolutePath && isAbsoluteNativePath(decodedSource)) {
          absolutePath = decodedSource.replaceAll("\\", "/");
        }

        if (!absolutePath) {
          continue;
        }

        try {
          const dataUrl = await invoke<string>("read_image_as_data_url", { path: absolutePath });
          image.setAttribute("src", dataUrl);
        } catch {
          // Keep original source when inline conversion fails.
        }
      }

      const htmlDocument = buildExportHtmlDocument({
        title: state.fileName,
        bodyHtml: htmlContainer.innerHTML
      });

      const exportedFile = await invoke<TauriSavedMarkdownFile | null>("export_html_file", {
        path: null,
        suggestedName,
        content: htmlDocument
      });

      if (!exportedFile) {
        return;
      }

      deps.renderSaveState(formatMessage(t("state.exportHtmlSaved"), { name: exportedFile.name }));
      return true;
    } catch (error) {
      logError("exportCurrentDocumentAsHtml failed", error);
      deps.renderSaveState(t("state.exportHtmlFailed"));
      return false;
    }
  }

  async function exportCurrentDocumentAsPdf() {
    try {
      const suggestedName = toPdfExportFileName(state.fileName);
      const sanitizedHtmlBody = DOMPurify.sanitize(renderMarkdownToHtml(state.content));
      const htmlContainer = document.createElement("div");
      htmlContainer.innerHTML = sanitizedHtmlBody;
      const images = Array.from(htmlContainer.querySelectorAll<HTMLImageElement>("img[src]"));

      for (const image of images) {
        const source = (image.getAttribute("src") ?? "").trim();
        if (!source || isExternalImageSource(source)) {
          continue;
        }

        const decodedSource = (() => {
          try {
            return decodeURIComponent(source);
          } catch {
            return source;
          }
        })();

        let absolutePath: string | null = null;

        if (state.nativePath) {
          absolutePath = resolveDocumentRelativePath(state.nativePath, decodedSource);
        }

        if (!absolutePath) {
          absolutePath = pathFromFileUrl(decodedSource);
        }

        if (!absolutePath && isAbsoluteNativePath(decodedSource)) {
          absolutePath = decodedSource.replaceAll("\\", "/");
        }

        if (!absolutePath) {
          continue;
        }

        try {
          const dataUrl = await invoke<string>("read_image_as_data_url", { path: absolutePath });
          image.setAttribute("src", dataUrl);
        } catch {
          // Keep original source when inline conversion fails.
        }
      }

      const pdfBytes = await renderHtmlToPdfBytes({
        title: state.fileName,
        bodyHtml: htmlContainer.innerHTML
      });

      const exportedFile = await invoke<TauriSavedPdfFile | null>("export_pdf_file", {
        path: null,
        suggestedName,
        bytes: Array.from(pdfBytes)
      });

      if (!exportedFile) {
        return;
      }

      deps.renderSaveState(formatMessage(t("state.exportPdfSaved"), { name: exportedFile.name }));
      return true;
    } catch (error) {
      logError("exportCurrentDocumentAsPdf failed", error);
      deps.renderSaveState(t("state.exportPdfFailed"));
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

    watchPath(file.path);
    deps.closeAutocomplete();
    deps.render();
  }

  function applyReloadToFile(file: OpenFile, freshContent: string, freshName: string) {
    file.content = freshContent;
    file.name = freshName;
    file.isDirty = false;

    if (file.id === state.activeFileId) {
      state.content = freshContent;
      state.fileName = freshName;
      state.isDirty = false;
      editor.value = freshContent;
      titleInput.value = freshName;
      resetEditorHistory();
    }

    persistDraft();
    deps.render();
    deps.renderSaveState(t("state.reloaded"));
  }

  async function handleExternalChange(path: string) {
    const file = state.openFiles.find((item) => item.nativePath === path);

    if (!file) {
      return;
    }

    let freshFile: TauriMarkdownFile | null;
    try {
      freshFile = await invoke<TauriMarkdownFile | null>("open_markdown_file_from_path", { path });
    } catch (error) {
      logError("handleExternalChange failed", error);
      return;
    }

    if (!freshFile) {
      return;
    }

    if (!file.isDirty) {
      applyReloadToFile(file, freshFile.content, freshFile.name);
      return;
    }

    setPendingCloseRequest({
      kind: "reload",
      fileId: file.id,
      freshContent: freshFile.content,
      freshName: freshFile.name
    });
    openConfirmDialog(formatMessage(t("dialog.reload.message"), { name: file.name }));
  }

  function applyPendingReload() {
    if (pendingCloseRequest?.kind !== "reload") {
      return;
    }

    const { fileId, freshContent, freshName } = pendingCloseRequest;
    closeConfirmDialog();

    const file = state.openFiles.find((item) => item.id === fileId);
    if (!file) {
      return;
    }

    applyReloadToFile(file, freshContent, freshName);
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

    setPendingCloseRequest({ kind: "close", fileId });
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

    const closingFile = state.openFiles[index];
    if (closingFile.nativePath && !isPathStillOpenElsewhere(closingFile.nativePath, fileId)) {
      unwatchPath(closingFile.nativePath);
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
    if (pendingCloseRequest?.kind !== "close") {
      return;
    }

    const { fileId } = pendingCloseRequest;
    closeConfirmDialog();
    closeOpenFile(fileId);
  }

  async function saveAndClosePendingFile() {
    if (pendingCloseRequest?.kind !== "close") {
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
    openPath,
    openRecentDocument,
    saveDocument,
    saveDocumentAs,
    saveCurrentDocument,
    exportCurrentDocumentAsHtml,
    exportCurrentDocumentAsPdf,
    loadNativeFile,
    insertImageFromPath,
    insertImageFromClipboardFile,
    cleanUnusedAssetsForCurrentDocument,
    downloadRemoteImagesForCurrentDocument,
    selectOpenFile,
    requestCloseFile,
    requestCloseActiveFile,
    closeOpenFile,
    discardPendingClose,
    saveAndClosePendingFile,
    openConfirmDialog,
    closeConfirmDialog,
    handleExternalChange,
    applyPendingReload
  };
}
