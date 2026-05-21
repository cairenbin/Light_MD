import { buildMarkdownContinuation } from "../editor/continuation";
import { autocompleteItemIds, editorAutocompleteItems } from "../editor/items";
import { autocompleteList, autocompletePanel, autocompleteTitle, editor } from "../dom";
import { translate, type TranslationKey } from "../i18n/dictionaries";
import { autocompleteState, state } from "../state";
import type {
  AutocompleteShortcutOption,
  EditorAutocompleteContext,
  EditorAutocompleteItem,
  EditorSelectionEdit
} from "../types";
import { escapeHtml } from "../utils/html";

export interface AutocompleteControllerDeps {
  applyEditorEdit: (edit: EditorSelectionEdit) => void;
  getAvailableShortcutOptions: () => AutocompleteShortcutOption[];
}

export interface AutocompleteController {
  renderPanel: () => void;
  renderLabel: () => void;
  refresh: (manual: boolean) => void;
  close: () => void;
  updatePosition: () => void;
  getEditorContext: () => EditorAutocompleteContext;
  handleKeydown: (event: KeyboardEvent) => boolean;
  handleContinuation: (event: KeyboardEvent) => boolean;
  bindListeners: () => void;
  isOpen: () => boolean;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

export function createAutocompleteController(deps: AutocompleteControllerDeps): AutocompleteController {
  function renderPanel() {
    const canShow = autocompleteState.isOpen && autocompleteState.items.length > 0 && state.mode !== "preview";

    autocompletePanel.classList.toggle("hidden", !canShow);
    autocompletePanel.setAttribute("aria-hidden", String(!canShow));

    if (!canShow) {
      autocompleteList.innerHTML = "";
      return;
    }

    autocompleteList.innerHTML = autocompleteState.items
      .map((item, index) => {
        const activeClass = index === autocompleteState.activeIndex ? " active" : "";
        const pointerSelected =
          autocompleteState.interactionMode === "pointer" && index === autocompleteState.activeIndex
            ? ' data-pointer-selected="true"'
            : "";

        return `
        <li>
          <button class="autocomplete-item${activeClass}" data-index="${index}" type="button"${pointerSelected}>
            <span class="autocomplete-copy">
              <span class="autocomplete-label">${escapeHtml(item.label)}</span>
              <span class="autocomplete-detail">${escapeHtml(item.detail)}</span>
            </span>
          </button>
        </li>
      `;
      })
      .join("");

    autocompletePanel.style.top = `${autocompleteState.anchorTop}px`;
    autocompletePanel.style.left = `${autocompleteState.anchorLeft}px`;
    ensureItemVisible();
  }

  function ensureItemVisible() {
    if (!autocompleteState.isOpen) {
      return;
    }

    const activeItem = autocompleteList.querySelector<HTMLElement>(".autocomplete-item.active");

    if (!activeItem) {
      return;
    }

    activeItem.scrollIntoView({
      block: "nearest"
    });
  }

  function renderLabel() {
    autocompleteTitle.textContent = t("autocomplete.title");
  }

  function getEditorContext(): EditorAutocompleteContext {
    const value = editor.value;
    const selectionStart = editor.selectionStart ?? 0;
    const selectionEnd = editor.selectionEnd ?? selectionStart;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextLineBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const currentLine = value.slice(lineStart, lineEnd);
    const beforeLineCursor = value.slice(lineStart, selectionStart);
    const afterLineCursor = value.slice(selectionEnd, lineEnd);
    const trimmedLine = beforeLineCursor.trim();
    const tokenMatch = beforeLineCursor.match(/([^\s]+)$/);
    const token = tokenMatch?.[1] ?? "";
    const tokenStart = tokenMatch ? selectionStart - token.length : selectionStart;

    return {
      value,
      selectionStart,
      selectionEnd,
      selectedText,
      lineStart,
      lineEnd,
      currentLine,
      beforeLineCursor,
      afterLineCursor,
      trimmedLine,
      token,
      tokenStart,
      tokenEnd: selectionStart
    };
  }

  function normalizeQuery(query: string) {
    return query.replace(/^[^\p{L}\p{N}]+/u, "").toLowerCase();
  }

  function matchesQuery(item: EditorAutocompleteItem, query: string) {
    if (!query) {
      return true;
    }

    const haystack = [item.label, item.detail, ...item.keywords].join(" ").toLowerCase();
    return haystack.includes(query);
  }

  function matchesAutoPrefix(context: EditorAutocompleteContext, prefix: string) {
    if (prefix.length === 0) {
      return false;
    }

    if (context.trimmedLine === prefix || context.token === prefix) {
      return true;
    }

    if (!prefix.includes(" ")) {
      return false;
    }

    return context.beforeLineCursor.trimEnd().endsWith(prefix);
  }

  function getItems(context: EditorAutocompleteContext, manual: boolean) {
    const query = normalizeQuery(context.token);
    const sourceItems = editorAutocompleteItems.filter((item) => autocompleteItemIds.has(item.id));

    if (manual) {
      return sourceItems.filter((item) => matchesQuery(item, query));
    }

    return sourceItems.filter((item) => item.autoPrefixes.some((prefix) => matchesAutoPrefix(context, prefix)));
  }

  function hasTrigger(context: EditorAutocompleteContext) {
    return editorAutocompleteItems
      .filter((item) => autocompleteItemIds.has(item.id))
      .some((item) => item.autoPrefixes.some((prefix) => matchesAutoPrefix(context, prefix)));
  }

  function applyItem(index: number) {
    const item = autocompleteState.items[index];

    if (!item) {
      return;
    }

    const edit = item.buildEdit(getEditorContext());
    deps.applyEditorEdit(edit);
    close();
  }

  function refresh(manual: boolean) {
    if (state.mode === "preview") {
      close();
      return;
    }

    const context = getEditorContext();
    const items = getItems(context, manual);

    if (items.length === 0) {
      close();
      return;
    }

    if (!manual && !hasTrigger(context)) {
      close();
      return;
    }

    autocompleteState.isOpen = true;
    autocompleteState.items = items;
    autocompleteState.manual = manual;
    autocompleteState.interactionMode = "keyboard";
    autocompleteState.activeIndex = Math.min(autocompleteState.activeIndex, items.length - 1);
    updatePosition();
  }

  function close() {
    autocompleteState.isOpen = false;
    autocompleteState.items = [];
    autocompleteState.activeIndex = 0;
    autocompleteState.manual = false;
    autocompleteState.interactionMode = "keyboard";
    renderPanel();
  }

  function getCaretPosition() {
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    const editorStyle = window.getComputedStyle(editor);
    const editorRect = editor.getBoundingClientRect();
    const propertiesToCopy = [
      "boxSizing",
      "width",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "textTransform",
      "textAlign"
    ] as const;

    mirror.style.position = "fixed";
    mirror.style.top = "0";
    mirror.style.left = "-9999px";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";

    for (const property of propertiesToCopy) {
      mirror.style[property] = editorStyle[property];
    }

    mirror.textContent = editor.value.slice(0, editor.selectionStart ?? 0);
    marker.textContent = editor.value.slice(editor.selectionStart ?? 0, (editor.selectionStart ?? 0) + 1) || " ";
    mirror.append(marker);
    document.body.append(mirror);

    const top = editorRect.top + marker.offsetTop - editor.scrollTop;
    const left = editorRect.left + marker.offsetLeft - editor.scrollLeft;

    mirror.remove();

    return { top, left };
  }

  function updatePosition() {
    if (!autocompleteState.isOpen) {
      return;
    }

    const { top, left } = getCaretPosition();
    const editorRect = editor.getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 260;
    const viewportPadding = 16;

    autocompleteState.anchorTop = Math.min(top + 18, window.innerHeight - panelHeight - viewportPadding);
    autocompleteState.anchorLeft = Math.min(left, Math.max(viewportPadding, editorRect.right - panelWidth - 12));

    renderPanel();
  }

  function isTriggerEvent(event: KeyboardEvent) {
    const options = deps.getAvailableShortcutOptions();
    const shortcut = options.find((option) => option.id === state.autocompleteShortcutId) ?? options[0];

    return (
      event.code === shortcut.code &&
      event.shiftKey === shortcut.shift &&
      event.ctrlKey === shortcut.ctrl &&
      event.altKey === shortcut.alt &&
      event.metaKey === shortcut.meta
    );
  }

  function handleKeydown(event: KeyboardEvent) {
    const isManualTrigger = isTriggerEvent(event);

    if (isManualTrigger) {
      event.preventDefault();
      refresh(true);
      return true;
    }

    if (!autocompleteState.isOpen) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      autocompleteState.interactionMode = "keyboard";
      autocompleteState.activeIndex = (autocompleteState.activeIndex + 1) % autocompleteState.items.length;
      renderPanel();
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      autocompleteState.interactionMode = "keyboard";
      autocompleteState.activeIndex =
        (autocompleteState.activeIndex - 1 + autocompleteState.items.length) % autocompleteState.items.length;
      renderPanel();
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applyItem(autocompleteState.activeIndex);
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return true;
    }

    return false;
  }

  function handleContinuation(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }

    const context = getEditorContext();
    const nextText = buildMarkdownContinuation(context.currentLine);

    if (nextText === null) {
      return false;
    }

    event.preventDefault();
    deps.applyEditorEdit({
      start: context.selectionStart,
      end: context.selectionEnd,
      text: `\n${nextText}`
    });
    close();
    return true;
  }

  function bindListeners() {
    autocompletePanel.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    autocompleteList.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-index]") : null;

      if (!target) {
        return;
      }

      const nextIndex = Number(target.dataset.index);

      if (!Number.isInteger(nextIndex)) {
        return;
      }

      applyItem(nextIndex);
    });

    autocompleteList.addEventListener("mousemove", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-index]") : null;

      if (!target) {
        return;
      }

      const nextIndex = Number(target.dataset.index);

      if (!Number.isInteger(nextIndex) || nextIndex === autocompleteState.activeIndex) {
        return;
      }

      autocompleteState.interactionMode = "pointer";
      autocompleteState.activeIndex = nextIndex;
      renderPanel();
    });

    autocompleteList.addEventListener("mouseleave", () => {
      if (!autocompleteState.isOpen) {
        return;
      }

      autocompleteState.interactionMode = "keyboard";
      renderPanel();
    });
  }

  function isOpen() {
    return autocompleteState.isOpen;
  }

  return {
    renderPanel,
    renderLabel,
    refresh,
    close,
    updatePosition,
    getEditorContext,
    handleKeydown,
    handleContinuation,
    bindListeners,
    isOpen
  };
}
