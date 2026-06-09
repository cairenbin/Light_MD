import {
  editorFontFamilySelect,
  editorFontSizeSelect,
  fontDecreaseButton,
  fontIncreaseButton,
  fontSizeLabel,
  languageSelect,
  settingsFieldLabels,
  settingsGroupTitles,
  settingsMenu,
  settingsMenuButton,
  shortcutSelect,
  themeOptionButtons
} from "../dom";
import {
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_ZOOM_PERCENT,
  EDITOR_FONT_SIZE_OPTIONS,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  ZOOM_STEP
} from "../constants";
import { isSupportedLocale, translate, type TranslationKey } from "../i18n/dictionaries";
import {
  persistAutocompleteShortcut,
  persistEditorFontFamily,
  persistEditorFontSize,
  persistLocale,
  persistTheme,
  persistZoom
} from "../storage/session";
import {
  setIsSettingsMenuOpen,
  isSettingsMenuOpen,
  state
} from "../state";
import type { AutocompleteShortcutOption, Locale, ThemeMode } from "../types";
import { parseSavedEditorFontSize, clampZoom } from "../utils/storage";
import { escapeAttribute, escapeHtml } from "../utils/html";
import { invoke } from "@tauri-apps/api/core";

export interface SettingsControllerDeps {
  render: () => void;
  renderShortcutsDrawer: () => void;
  closeInsertMenu: (restoreFocus?: boolean) => void;
  closeAutocomplete: () => void;
  syncActiveScroll: () => void;
  syncNativeMenuLocale: (locale: Locale) => void;
  getAvailableShortcutOptions: () => AutocompleteShortcutOption[];
  parseSavedShortcutId: (value: string | null) => string;
  getShortcutOptionLabel: (option: AutocompleteShortcutOption) => string;
}

export interface SettingsController {
  renderMenu: () => void;
  renderTheme: () => void;
  renderZoom: () => void;
  toggleMenu: () => void;
  openMenu: (focusLast?: boolean) => void;
  closeMenu: (restoreFocus?: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  changeZoom: (delta: number) => void;
  resetZoom: () => void;
  renderEditorTypography: () => void;
  loadSystemFonts: () => Promise<void>;
  setShortcut: (id: string) => void;
  setEditorFontFamily: (fontFamily: string) => void;
  setEditorFontSize: (fontSize: string) => void;
  setLocale: (locale: string) => void;
  handleAction: (action: string, target: HTMLElement) => boolean;
  bindListeners: () => void;
  isOpen: () => boolean;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

const DEFAULT_FONT_STACK = '"Iowan Old Style", "Georgia", serif';
const FALLBACK_EDITOR_FONTS = ["Avenir Next", "Georgia", "Menlo", "Monaco", "Courier New"];

function setTextByDataAttr<E extends HTMLElement>(
  elements: E[],
  datasetKey: string,
  datasetValue: string,
  text: string
): void {
  const target = elements.find((el) => el.dataset[datasetKey] === datasetValue);
  if (target) {
    target.textContent = text;
  }
}

export function createSettingsController(deps: SettingsControllerDeps): SettingsController {
  let systemFonts: string[] = [];
  let hasLoadedSystemFonts = false;
  let pendingSystemFontsLoad: Promise<void> | null = null;

  function renderThemeOptions() {
    for (const button of themeOptionButtons) {
      const themeValue = button.dataset.themeValue;
      const isActive = themeValue === state.theme;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
  }

  function renderShortcutOptions() {
    const availableOptions = deps.getAvailableShortcutOptions();

    if (!availableOptions.some((option) => option.id === state.autocompleteShortcutId)) {
      state.autocompleteShortcutId = deps.parseSavedShortcutId(null);
      persistAutocompleteShortcut(state.autocompleteShortcutId);
    }

    shortcutSelect.innerHTML = availableOptions
      .map((option) => {
        const label = escapeHtml(deps.getShortcutOptionLabel(option));
        const selected = option.id === state.autocompleteShortcutId ? " selected" : "";
        return `<option value="${escapeAttribute(option.id)}"${selected}>${label}</option>`;
      })
      .join("");

    shortcutSelect.value = state.autocompleteShortcutId;
  }

  function renderLanguageOptions() {
    const options: Array<{ id: Locale; label: string }> = [
      { id: "zh", label: "中文" },
      { id: "ja", label: "日本語" },
      { id: "en", label: "English" }
    ];

    languageSelect.innerHTML = options
      .map((option) => {
        const selected = option.id === state.locale ? " selected" : "";
        return `<option value="${option.id}"${selected}>${option.label}</option>`;
      })
      .join("");

    languageSelect.value = state.locale;
  }

  function getEditorFontOptions(): string[] {
    const merged = new Set(
      [state.editorFontFamily, ...systemFonts, ...FALLBACK_EDITOR_FONTS]
        .map((font) => font.trim())
        .filter((font) => font.length > 0)
    );

    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }

  function renderEditorFontOptions() {
    const fontOptions = getEditorFontOptions();
    const defaultSelected = state.editorFontFamily === DEFAULT_EDITOR_FONT_FAMILY ? " selected" : "";

    editorFontFamilySelect.innerHTML = [
      `<option value=""${defaultSelected}>${escapeHtml(t("settings.editor.defaultFont"))}</option>`,
      ...fontOptions.map((font) => {
        const selected = font === state.editorFontFamily ? " selected" : "";
        const escapedFont = escapeAttribute(font);
        return `<option value="${escapedFont}"${selected}>${escapeHtml(font)}</option>`;
      })
    ].join("");

    editorFontFamilySelect.value = state.editorFontFamily;
  }

  function renderEditorFontSizeOptions() {
    editorFontSizeSelect.innerHTML = EDITOR_FONT_SIZE_OPTIONS.map((fontSize) => {
      const selected = fontSize === state.editorFontSize ? " selected" : "";
      return `<option value="${fontSize}"${selected}>${fontSize}px</option>`;
    }).join("");

    editorFontSizeSelect.value = String(state.editorFontSize);
  }

  function renderLabels() {
    settingsMenuButton.setAttribute("title", t("settings.open"));
    settingsMenuButton.setAttribute("aria-label", t("settings.open"));
    setTextByDataAttr(themeOptionButtons, "themeValue", "light", t("settings.theme.light"));
    setTextByDataAttr(themeOptionButtons, "themeValue", "dark", t("settings.theme.dark"));
    fontDecreaseButton.setAttribute("aria-label", t("settings.zoom.out"));
    fontIncreaseButton.setAttribute("aria-label", t("settings.zoom.in"));
    editorFontFamilySelect.setAttribute("aria-label", t("settings.editor.fontFamily"));
    editorFontSizeSelect.setAttribute("aria-label", t("settings.editor.fontSize"));

    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "theme", t("settings.theme"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "zoom", t("settings.zoom"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "editor", t("settings.editor"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "autocomplete", t("settings.autocomplete"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "language", t("settings.language"));
    setTextByDataAttr(settingsFieldLabels, "settingsField", "editor-font-family", t("settings.editor.fontFamily"));
    setTextByDataAttr(settingsFieldLabels, "settingsField", "editor-font-size", t("settings.editor.fontSize"));
    setTextByDataAttr(settingsFieldLabels, "settingsField", "trigger", t("settings.trigger"));
    setTextByDataAttr(settingsFieldLabels, "settingsField", "language", t("settings.language"));
  }

  function renderMenu() {
    settingsMenuButton.setAttribute("aria-expanded", String(isSettingsMenuOpen));
    settingsMenu.classList.toggle("hidden", !isSettingsMenuOpen);
    settingsMenu.setAttribute("aria-hidden", String(!isSettingsMenuOpen));
    settingsMenu.setAttribute("tabindex", isSettingsMenuOpen ? "0" : "-1");
    renderLabels();
    renderThemeOptions();
    renderShortcutOptions();
    renderLanguageOptions();
    renderEditorFontOptions();
    renderEditorFontSizeOptions();
  }

  function renderTheme() {
    document.documentElement.dataset.theme = state.theme;
    renderThemeOptions();
  }

  function renderZoom() {
    document.documentElement.style.setProperty("--content-scale", `${state.zoomPercent / 100}`);
    fontSizeLabel.textContent = `${state.zoomPercent}%`;
    fontDecreaseButton.disabled = state.zoomPercent <= MIN_ZOOM_PERCENT;
    fontIncreaseButton.disabled = state.zoomPercent >= MAX_ZOOM_PERCENT;
  }

  function renderEditorTypography() {
    const quotedFontFamily = state.editorFontFamily.replace(/["\\]/gu, "\\$&");
    const fontFamily = state.editorFontFamily ? `"${quotedFontFamily}", ${DEFAULT_FONT_STACK}` : DEFAULT_FONT_STACK;

    document.documentElement.style.setProperty("--editor-font-family", fontFamily);
    document.documentElement.style.setProperty("--editor-font-size", `${state.editorFontSize}px`);
    renderEditorFontOptions();
    renderEditorFontSizeOptions();
  }

  async function loadSystemFonts() {
    if (hasLoadedSystemFonts) {
      return;
    }

    if (pendingSystemFontsLoad) {
      await pendingSystemFontsLoad;
      return;
    }

    pendingSystemFontsLoad = invoke<string[]>("list_system_fonts")
      .then((fonts) => {
        systemFonts = fonts;
        hasLoadedSystemFonts = true;
        renderEditorFontOptions();
      })
      .catch(() => {
        systemFonts = [];
        hasLoadedSystemFonts = true;
        renderEditorFontOptions();
      })
      .finally(() => {
        pendingSystemFontsLoad = null;
      });

    await pendingSystemFontsLoad;
  }

  function getSettingsControls(): HTMLElement[] {
    return Array.from(
      settingsMenu.querySelectorAll<HTMLElement>(
        "button.settings-option-button, button.font-button, select.settings-shortcut-select, select.settings-language-select, select.settings-editor-font-family-select, select.settings-editor-font-size-select"
      )
    );
  }

  function focusSettingsControl(focusLast = false) {
    const controls = getSettingsControls();

    if (controls.length === 0) {
      settingsMenu.focus();
      return;
    }

    const target = focusLast ? controls[controls.length - 1] : controls[0];
    target.focus();
  }

  function openMenu(focusLast = false) {
    setIsSettingsMenuOpen(true);
    deps.closeInsertMenu();
    deps.closeAutocomplete();
    renderMenu();
    void loadSystemFonts();
    window.setTimeout(() => {
      focusSettingsControl(focusLast);
    }, 0);
  }

  function closeMenu(restoreFocus = false) {
    if (!isSettingsMenuOpen) {
      return;
    }

    setIsSettingsMenuOpen(false);
    renderMenu();

    if (restoreFocus) {
      settingsMenuButton.focus();
    }
  }

  function toggleMenu() {
    if (isSettingsMenuOpen) {
      closeMenu(true);
      return;
    }

    openMenu();
  }

  function setTheme(theme: ThemeMode) {
    if (theme !== "light" && theme !== "dark") {
      return;
    }

    state.theme = theme;
    persistTheme(state.theme);
    renderTheme();
  }

  function changeZoom(delta: number) {
    state.zoomPercent = clampZoom(state.zoomPercent + delta * ZOOM_STEP);
    persistZoom(state.zoomPercent);
    renderZoom();
    requestAnimationFrame(() => {
      deps.syncActiveScroll();
    });
  }

  function resetZoom() {
    state.zoomPercent = DEFAULT_ZOOM_PERCENT;
    persistZoom(state.zoomPercent);
    renderZoom();
    requestAnimationFrame(() => {
      deps.syncActiveScroll();
    });
  }

  function setEditorFontFamily(fontFamily: string) {
    state.editorFontFamily = fontFamily.trim();
    persistEditorFontFamily(state.editorFontFamily);
    renderEditorTypography();
  }

  function setEditorFontSize(fontSize: string) {
    state.editorFontSize = parseSavedEditorFontSize(fontSize || String(DEFAULT_EDITOR_FONT_SIZE));
    persistEditorFontSize(state.editorFontSize);
    renderEditorTypography();
    requestAnimationFrame(() => {
      deps.syncActiveScroll();
    });
  }

  function setShortcut(nextId: string) {
    const option = deps.getAvailableShortcutOptions().find((entry) => entry.id === nextId);

    if (!option) {
      return;
    }

    state.autocompleteShortcutId = option.id;
    persistAutocompleteShortcut(option.id);
    renderMenu();
    deps.renderShortcutsDrawer();
  }

  function setLocale(nextLocale: string) {
    if (!isSupportedLocale(nextLocale)) {
      return;
    }

    state.locale = nextLocale;
    persistLocale(state.locale);
    deps.syncNativeMenuLocale(state.locale);
    deps.render();
  }

  function handleAction(action: string, target: HTMLElement): boolean {
    switch (action) {
      case "toggle-settings-menu":
        toggleMenu();
        return true;
      case "set-theme":
        if (target.dataset.themeValue) {
          setTheme(target.dataset.themeValue as ThemeMode);
        }
        return true;
      case "font-decrease":
        changeZoom(-1);
        return true;
      case "font-increase":
        changeZoom(1);
        return true;
      default:
        return false;
    }
  }

  function bindListeners() {
    settingsMenuButton.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(true);
      }
    });

    settingsMenu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    });

    shortcutSelect.addEventListener("change", () => {
      setShortcut(shortcutSelect.value);
    });

    editorFontFamilySelect.addEventListener("change", () => {
      setEditorFontFamily(editorFontFamilySelect.value);
    });

    editorFontSizeSelect.addEventListener("change", () => {
      setEditorFontSize(editorFontSizeSelect.value);
    });

    languageSelect.addEventListener("change", () => {
      setLocale(languageSelect.value);
    });
  }

  function isOpen() {
    return isSettingsMenuOpen;
  }

  return {
    renderMenu,
    renderTheme,
    renderZoom,
    toggleMenu,
    openMenu,
    closeMenu,
    setTheme,
    changeZoom,
    resetZoom,
    renderEditorTypography,
    loadSystemFonts,
    setEditorFontFamily,
    setEditorFontSize,
    setShortcut,
    setLocale,
    handleAction,
    bindListeners,
    isOpen
  };
}
