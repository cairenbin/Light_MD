import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTOCOMPLETE_SHORTCUT_ID,
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_LOCALE,
  DEFAULT_ZOOM_PERCENT,
  MAX_EDITOR_FONT_SIZE,
  MAX_RECENT_FILES,
  MAX_ZOOM_PERCENT,
  MIN_EDITOR_FONT_SIZE,
  MIN_ZOOM_PERCENT
} from "../constants";
import type { AutocompleteShortcutOption } from "../types";
import {
  clampZoom,
  parseSavedAutocompleteShortcutId,
  parseSavedDraftSession,
  parseSavedEditorFontFamily,
  parseSavedEditorFontSize,
  parseSavedLocale,
  parseSavedRecentFiles,
  parseSavedZoom
} from "./storage";

const fakeOptions: AutocompleteShortcutOption[] = [
  { id: "shift-space", code: "Space", shift: true, ctrl: false, alt: false, meta: false, label: "Shift + Space" },
  {
    id: DEFAULT_AUTOCOMPLETE_SHORTCUT_ID,
    code: "Space",
    shift: false,
    ctrl: true,
    alt: false,
    meta: false,
    label: "Ctrl + Space"
  }
];

describe("clampZoom", () => {
  it("clamps to the supported range", () => {
    expect(clampZoom(MIN_ZOOM_PERCENT - 50)).toBe(MIN_ZOOM_PERCENT);
    expect(clampZoom(MAX_ZOOM_PERCENT + 200)).toBe(MAX_ZOOM_PERCENT);
  });

  it("rounds fractional zoom values", () => {
    expect(clampZoom(100.4)).toBe(100);
    expect(clampZoom(100.6)).toBe(101);
  });
});

describe("parseSavedZoom", () => {
  it("returns default zoom when value is missing or unparseable", () => {
    expect(parseSavedZoom(null)).toBe(DEFAULT_ZOOM_PERCENT);
    expect(parseSavedZoom("not a number")).toBe(DEFAULT_ZOOM_PERCENT);
  });

  it("clamps stored values into the valid range", () => {
    expect(parseSavedZoom(String(MAX_ZOOM_PERCENT + 1000))).toBe(MAX_ZOOM_PERCENT);
    expect(parseSavedZoom(String(MIN_ZOOM_PERCENT - 1000))).toBe(MIN_ZOOM_PERCENT);
  });
});

describe("parseSavedEditorFontFamily", () => {
  it("returns the default editor font when value is missing", () => {
    expect(parseSavedEditorFontFamily(null)).toBe(DEFAULT_EDITOR_FONT_FAMILY);
  });

  it("trims stored font family names", () => {
    expect(parseSavedEditorFontFamily("  Menlo  ")).toBe("Menlo");
  });
});

describe("parseSavedEditorFontSize", () => {
  it("returns the default editor font size when value is missing or unparseable", () => {
    expect(parseSavedEditorFontSize(null)).toBe(DEFAULT_EDITOR_FONT_SIZE);
    expect(parseSavedEditorFontSize("large")).toBe(DEFAULT_EDITOR_FONT_SIZE);
  });

  it("clamps stored font sizes into the supported range", () => {
    expect(parseSavedEditorFontSize(String(MAX_EDITOR_FONT_SIZE + 50))).toBe(MAX_EDITOR_FONT_SIZE);
    expect(parseSavedEditorFontSize(String(MIN_EDITOR_FONT_SIZE - 50))).toBe(MIN_EDITOR_FONT_SIZE);
  });
});

describe("parseSavedLocale", () => {
  it("returns the default locale for unknown values", () => {
    expect(parseSavedLocale(null)).toBe(DEFAULT_LOCALE);
    expect(parseSavedLocale("klingon")).toBe(DEFAULT_LOCALE);
  });

  it("accepts known locales", () => {
    expect(parseSavedLocale("zh")).toBe("zh");
    expect(parseSavedLocale("en")).toBe("en");
    expect(parseSavedLocale("ja")).toBe("ja");
  });
});

describe("parseSavedAutocompleteShortcutId", () => {
  it("falls back to the default option when value is null", () => {
    expect(parseSavedAutocompleteShortcutId(null, fakeOptions)).toBe(DEFAULT_AUTOCOMPLETE_SHORTCUT_ID);
  });

  it("returns the saved value when it matches an available option", () => {
    expect(parseSavedAutocompleteShortcutId("shift-space", fakeOptions)).toBe("shift-space");
  });

  it("falls back when the saved value is not available", () => {
    expect(parseSavedAutocompleteShortcutId("alt-space", fakeOptions)).toBe(DEFAULT_AUTOCOMPLETE_SHORTCUT_ID);
  });

  it("uses the first option when the default itself is unavailable", () => {
    const limited: AutocompleteShortcutOption[] = [fakeOptions[0]];
    expect(parseSavedAutocompleteShortcutId(null, limited)).toBe("shift-space");
  });
});

describe("parseSavedRecentFiles", () => {
  it("returns an empty list when input is null or malformed", () => {
    expect(parseSavedRecentFiles(null)).toEqual([]);
    expect(parseSavedRecentFiles("not json")).toEqual([]);
    expect(parseSavedRecentFiles(JSON.stringify({ not: "array" }))).toEqual([]);
  });

  it("keeps only non-empty strings", () => {
    const stored = JSON.stringify(["/a.md", "", "  ", 42, "/b.md"]);
    expect(parseSavedRecentFiles(stored)).toEqual(["/a.md", "/b.md"]);
  });

  it("truncates to MAX_RECENT_FILES", () => {
    const stored = JSON.stringify(Array.from({ length: MAX_RECENT_FILES + 5 }, (_, i) => `/${i}.md`));
    expect(parseSavedRecentFiles(stored)).toHaveLength(MAX_RECENT_FILES);
  });
});

describe("parseSavedDraftSession", () => {
  it("returns null when input is missing or malformed", () => {
    expect(parseSavedDraftSession(null)).toBeNull();
    expect(parseSavedDraftSession("garbage")).toBeNull();
  });

  it("returns null when there are no usable files", () => {
    expect(parseSavedDraftSession(JSON.stringify({ openFiles: [] }))).toBeNull();
    expect(parseSavedDraftSession(JSON.stringify({ openFiles: [null, "x", 42] }))).toBeNull();
  });

  it("recovers when the persisted active id no longer matches any file", () => {
    const stored = JSON.stringify({
      version: 1,
      activeFileId: "missing",
      openFiles: [{ id: "alpha", name: "a.md", content: "hello", isDirty: false }]
    });
    const session = parseSavedDraftSession(stored);
    expect(session).not.toBeNull();
    expect(session!.activeFileId).toBe("alpha");
    expect(session!.openFiles[0].name).toBe("a.md");
  });
});
