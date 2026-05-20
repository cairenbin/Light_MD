import type { AutocompleteShortcutOption, DraftSession, Locale, OpenFile } from "../types";
import {
  DEFAULT_AUTOCOMPLETE_SHORTCUT_ID,
  DEFAULT_LOCALE,
  DEFAULT_ZOOM_PERCENT,
  DRAFT_SESSION_VERSION,
  MAX_RECENT_FILES,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT
} from "../constants";
import { isSupportedLocale } from "../i18n/dictionaries";
import { normalizeFileName } from "./path";

export function clampZoom(zoomPercent: number): number {
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, Math.round(zoomPercent)));
}

export function parseSavedZoom(value: string | null): number {
  if (!value) {
    return DEFAULT_ZOOM_PERCENT;
  }

  const zoomPercent = Number(value);
  return Number.isFinite(zoomPercent) ? clampZoom(zoomPercent) : DEFAULT_ZOOM_PERCENT;
}

export function parseSavedLocale(value: string | null): Locale {
  if (isSupportedLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}

export function parseSavedAutocompleteShortcutId(
  value: string | null,
  availableOptions: AutocompleteShortcutOption[]
): string {
  const defaultOption =
    availableOptions.find((option) => option.id === DEFAULT_AUTOCOMPLETE_SHORTCUT_ID) ?? availableOptions[0];

  if (!value) {
    return defaultOption.id;
  }

  return availableOptions.some((option) => option.id === value) ? value : defaultOption.id;
}

export function parseSavedRecentFiles(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, MAX_RECENT_FILES);
  } catch (error) {
    console.error("Could not parse recent files.", error);
    return [];
  }
}

export function parseSavedOpenFile(rawFile: unknown): OpenFile | null {
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
  const nativePath =
    typeof file.nativePath === "string" && file.nativePath.length > 0 ? file.nativePath : null;
  const isDirty = typeof file.isDirty === "boolean" ? file.isDirty : content.length > 0;

  return {
    id,
    name,
    content,
    nativePath,
    isDirty
  };
}

export function parseSavedDraftSession(rawSession: string | null): DraftSession | null {
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

    const activeFileId =
      typeof parsed.activeFileId === "string" && parsed.activeFileId.length > 0
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
