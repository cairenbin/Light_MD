export type ViewMode = "write" | "split" | "preview";
export type ThemeMode = "light" | "dark";
export type Locale = "zh" | "ja" | "en";
export type DrawerTab = "documents" | "outline";

export type OpenFile = {
  id: string;
  name: string;
  content: string;
  nativePath: string | null;
  isDirty: boolean;
};

export type EditorState = {
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
  drawerTab: DrawerTab;
};

export type PendingCloseRequest =
  | { kind: "close"; fileId: string }
  | { kind: "reload"; fileId: string; freshContent: string; freshName: string };

export type FindReplaceState = {
  isOpen: boolean;
  query: string;
  replaceText: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  matchRegex: boolean;
  showReplace: boolean;
  activeMatchIndex: number;
};

export type EditorHistorySnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export type TauriMarkdownFile = {
  path: string;
  name: string;
  content: string;
};

export type TauriSavedMarkdownFile = {
  path: string;
  name: string;
};

export type EditorSelectionEdit = {
  start: number;
  end: number;
  text: string;
  selectionStart?: number;
  selectionEnd?: number;
};

export type EditorAutocompleteContext = {
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

export type EditorAutocompleteItem = {
  id: string;
  label: string;
  detail: string;
  keywords: string[];
  autoPrefixes: string[];
  buildEdit: (context: EditorAutocompleteContext) => EditorSelectionEdit;
};

export type EditorAutocompleteState = {
  isOpen: boolean;
  items: EditorAutocompleteItem[];
  activeIndex: number;
  manual: boolean;
  interactionMode: "keyboard" | "pointer";
  anchorTop: number;
  anchorLeft: number;
};

export type InsertMenuItem = {
  id: string;
  label: string;
  detail: string;
  buildEdit: (context: EditorAutocompleteContext) => EditorSelectionEdit;
};

export type DraftSession = {
  version: number;
  activeFileId: string;
  openFiles: OpenFile[];
};

export type AutocompleteShortcutOption = {
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
