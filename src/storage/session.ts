import { invoke } from "@tauri-apps/api/core";

import {
  AUTOCOMPLETE_SHORTCUT_KEY,
  DRAFT_KEY,
  DRAFT_SESSION_KEY,
  DRAFT_SESSION_VERSION,
  LOCALE_KEY,
  MAX_RECENT_FILES,
  RECENT_FILES_KEY,
  SIDEBAR_KEY,
  THEME_KEY,
  TITLE_KEY,
  ZOOM_KEY,
  starterMarkdown
} from "../constants";
import { recentFiles, state } from "../state";
import type {
  AutocompleteShortcutOption,
  DraftSession,
  EditorState,
  Locale,
  OpenFile,
  ThemeMode
} from "../types";
import { normalizeFileName } from "../utils/path";
import { logError } from "../utils/logger";
import {
  parseSavedAutocompleteShortcutId,
  parseSavedDraftSession,
  parseSavedLocale,
  parseSavedRecentFiles,
  parseSavedZoom
} from "../utils/storage";

export interface InitialSession {
  state: EditorState;
  recentFiles: string[];
}

export function loadInitialSession(
  availableAutocompleteShortcutOptions: AutocompleteShortcutOption[]
): InitialSession {
  const savedSession = parseSavedDraftSession(localStorage.getItem(DRAFT_SESSION_KEY));
  const savedDraft = localStorage.getItem(DRAFT_KEY);
  const savedTitle = localStorage.getItem(TITLE_KEY);
  const savedTheme = localStorage.getItem(THEME_KEY);
  const savedZoom = localStorage.getItem(ZOOM_KEY);
  const savedAutocompleteShortcut = localStorage.getItem(AUTOCOMPLETE_SHORTCUT_KEY);
  const savedLocale = localStorage.getItem(LOCALE_KEY);
  const savedRecentFiles = parseSavedRecentFiles(localStorage.getItem(RECENT_FILES_KEY));
  const sidebarRaw = localStorage.getItem(SIDEBAR_KEY);

  const initialSession = buildInitialDraftSession(savedSession, savedTitle, savedDraft);
  const initialActiveFile =
    initialSession.openFiles.find((file) => file.id === initialSession.activeFileId) ?? initialSession.openFiles[0];

  const initialState: EditorState = {
    content: initialActiveFile.content,
    fileName: initialActiveFile.name,
    nativePath: initialActiveFile.nativePath,
    isDirty: initialActiveFile.isDirty,
    mode: "split",
    theme: savedTheme === "dark" ? "dark" : "light",
    isSidebarOpen: sidebarRaw !== "false",
    activeFileId: initialActiveFile.id,
    zoomPercent: parseSavedZoom(savedZoom),
    openFiles: initialSession.openFiles,
    autocompleteShortcutId: parseSavedAutocompleteShortcutId(
      savedAutocompleteShortcut,
      availableAutocompleteShortcutOptions
    ),
    locale: parseSavedLocale(savedLocale)
  };

  return { state: initialState, recentFiles: savedRecentFiles };
}

function buildInitialDraftSession(
  savedSession: DraftSession | null,
  savedTitle: string | null,
  savedDraft: string | null
): DraftSession {
  if (savedSession && savedSession.openFiles.length > 0) {
    return savedSession;
  }

  const file: OpenFile = {
    id: crypto.randomUUID(),
    name: normalizeFileName(savedTitle ?? "Untitled.md"),
    content: savedDraft ?? starterMarkdown,
    nativePath: null,
    isDirty: Boolean(savedDraft)
  };

  return {
    version: DRAFT_SESSION_VERSION,
    activeFileId: file.id,
    openFiles: [file]
  };
}

export function persistDraft(): void {
  const openFiles = state.openFiles.map((file) => {
    if (file.id !== state.activeFileId) {
      return { ...file };
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

export function persistTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function persistZoom(zoomPercent: number): void {
  localStorage.setItem(ZOOM_KEY, String(zoomPercent));
}

export function persistAutocompleteShortcut(id: string): void {
  localStorage.setItem(AUTOCOMPLETE_SHORTCUT_KEY, id);
}

export function persistLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function persistSidebar(isOpen: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, String(isOpen));
}

export function pushRecentFile(path: string): void {
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

export function removeRecentFile(path: string): void {
  const index = recentFiles.findIndex((entry) => entry === path);

  if (index < 0) {
    return;
  }

  recentFiles.splice(index, 1);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
  void syncRecentMenu();
}

export async function syncRecentMenu(): Promise<void> {
  try {
    await invoke("update_recent_menu", { paths: recentFiles });
  } catch (error) {
    logError("Could not update recent menu.", error);
  }
}
