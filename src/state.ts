import type {
  EditorAutocompleteState,
  EditorHistorySnapshot,
  EditorState,
  FindReplaceState,
  PendingCloseRequest
} from "./types";

export const state: EditorState = {
  content: "",
  fileName: "Untitled.md",
  nativePath: null,
  isDirty: false,
  mode: "split",
  theme: "light",
  isSidebarOpen: true,
  activeFileId: "",
  zoomPercent: 100,
  openFiles: [],
  autocompleteShortcutId: "",
  locale: "en"
};

export const findReplaceState: FindReplaceState = {
  isOpen: false,
  query: "",
  replaceText: "",
  matchCase: false,
  matchWholeWord: false,
  showReplace: false,
  activeMatchIndex: -1
};

export const autocompleteState: EditorAutocompleteState = {
  isOpen: false,
  items: [],
  activeIndex: 0,
  manual: false,
  interactionMode: "keyboard",
  anchorTop: 0,
  anchorLeft: 0
};

export const undoHistoryStack: EditorHistorySnapshot[] = [];
export const redoHistoryStack: EditorHistorySnapshot[] = [];

export const recentFiles: string[] = [];

export const globalEventListeners: Array<{
  target: Window | Document;
  type: string;
  listener: EventListener;
}> = [];

export let currentHistorySnapshot: EditorHistorySnapshot = {
  value: "",
  selectionStart: 0,
  selectionEnd: 0
};

export function setCurrentHistorySnapshot(snapshot: EditorHistorySnapshot): void {
  currentHistorySnapshot = snapshot;
}

export let isApplyingHistoryChange = false;

export function setIsApplyingHistoryChange(value: boolean): void {
  isApplyingHistoryChange = value;
}

export let pendingCloseRequest: PendingCloseRequest | null = null;

export function setPendingCloseRequest(value: PendingCloseRequest | null): void {
  pendingCloseRequest = value;
}

export let isInsertMenuOpen = false;

export function setIsInsertMenuOpen(value: boolean): void {
  isInsertMenuOpen = value;
}

export let isSettingsMenuOpen = false;

export function setIsSettingsMenuOpen(value: boolean): void {
  isSettingsMenuOpen = value;
}

export let activeScrollSource: "editor" | "preview" = "editor";

export function setActiveScrollSource(value: "editor" | "preview"): void {
  activeScrollSource = value;
}

export let programmaticScrollSource: "editor" | "preview" | null = null;

export function setProgrammaticScrollSource(value: "editor" | "preview" | null): void {
  programmaticScrollSource = value;
}

export let pendingScrollSyncFrame = 0;

export function setPendingScrollSyncFrame(value: number): void {
  pendingScrollSyncFrame = value;
}
