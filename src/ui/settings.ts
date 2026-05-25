import {
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
  DEFAULT_ZOOM_PERCENT,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  ZOOM_STEP
} from "../constants";
import { isSupportedLocale, translate, type TranslationKey } from "../i18n/dictionaries";
import {
  persistAutocompleteShortcut,
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
import { clampZoom } from "../utils/storage";
import { escapeAttribute, escapeHtml } from "../utils/html";

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
  setShortcut: (id: string) => void;
  setLocale: (locale: string) => void;
  handleAction: (action: string, target: HTMLElement) => boolean;
  bindListeners: () => void;
  isOpen: () => boolean;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

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

  function renderLabels() {
    settingsMenuButton.setAttribute("title", t("settings.open"));
    settingsMenuButton.setAttribute("aria-label", t("settings.open"));
    setTextByDataAttr(themeOptionButtons, "themeValue", "light", t("settings.theme.light"));
    setTextByDataAttr(themeOptionButtons, "themeValue", "dark", t("settings.theme.dark"));
    fontDecreaseButton.setAttribute("aria-label", t("settings.zoom.out"));
    fontIncreaseButton.setAttribute("aria-label", t("settings.zoom.in"));

    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "theme", t("settings.theme"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "zoom", t("settings.zoom"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "autocomplete", t("settings.autocomplete"));
    setTextByDataAttr(settingsGroupTitles, "settingsGroup", "language", t("settings.language"));
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

  function getSettingsControls(): HTMLElement[] {
    return Array.from(
      settingsMenu.querySelectorAll<HTMLElement>(
        "button.settings-option-button, button.font-button, select.settings-shortcut-select"
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
    setShortcut,
    setLocale,
    handleAction,
    bindListeners,
    isOpen
  };
}
