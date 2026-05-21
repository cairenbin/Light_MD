import { getFindMatches as getFindMatchesImpl } from "../editor/find";
import {
  editor,
  findCloseButton,
  findInput,
  findMatchCaseButton,
  findMatchWordButton,
  findNextButton,
  findPanel,
  findPrevButton,
  findReplaceAllButton,
  findReplaceButton,
  findStatus,
  findToggleReplaceButton,
  replaceInput,
  replaceRow
} from "../dom";
import { formatMessage, translate, type TranslationKey } from "../i18n/dictionaries";
import { findReplaceState, state } from "../state";
import type { EditorSelectionEdit } from "../types";

export interface FindControllerDeps {
  applyEditorEdit: (edit: EditorSelectionEdit) => void;
  syncTextFieldState: (target: HTMLInputElement | HTMLTextAreaElement) => void;
  closeInsertMenu: (restoreFocus?: boolean) => void;
  closeSettingsMenu: (restoreFocus?: boolean) => void;
  closeAutocomplete: () => void;
}

export interface FindController {
  renderPanel: () => void;
  openFind: (showReplace: boolean) => void;
  closeFind: (restoreFocus?: boolean) => void;
  toggleReplaceMode: () => void;
  findNext: (direction: 1 | -1) => Promise<void>;
  replaceCurrent: () => Promise<void>;
  replaceAll: () => Promise<void>;
  handleAction: (action: string) => Promise<boolean>;
  bindListeners: () => void;
  isOpen: () => boolean;
  showReplace: () => boolean;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

export function createFindController(deps: FindControllerDeps): FindController {
  function getFindMatches() {
    return getFindMatchesImpl(editor.value, {
      query: findReplaceState.query,
      matchCase: findReplaceState.matchCase,
      matchWholeWord: findReplaceState.matchWholeWord
    });
  }

  function getCurrentFindMatchIndex(matches: Array<{ start: number; end: number }>) {
    if (matches.length === 0) {
      return -1;
    }

    const selectionStart = editor.selectionStart ?? 0;
    const selectionEnd = editor.selectionEnd ?? selectionStart;
    const selectedIndex = matches.findIndex((match) => match.start === selectionStart && match.end === selectionEnd);

    if (selectedIndex >= 0) {
      return selectedIndex;
    }

    if (findReplaceState.activeMatchIndex >= 0 && findReplaceState.activeMatchIndex < matches.length) {
      return findReplaceState.activeMatchIndex;
    }

    const caret = selectionEnd;
    const containingIndex = matches.findIndex((match) => caret >= match.start && caret <= match.end);

    if (containingIndex >= 0) {
      return containingIndex;
    }

    const nextIndex = matches.findIndex((match) => match.start >= caret);

    if (nextIndex >= 0) {
      return nextIndex;
    }

    return 0;
  }

  function renderPanel() {
    findPanel.classList.toggle("hidden", !findReplaceState.isOpen);
    findPanel.setAttribute("aria-hidden", String(!findReplaceState.isOpen));
    replaceRow.classList.toggle("hidden", !findReplaceState.showReplace);

    findInput.placeholder = t("find.placeholder");
    replaceInput.placeholder = t("find.replace.placeholder");
    findPrevButton.textContent = t("find.previous");
    findNextButton.textContent = t("find.next");
    findCloseButton.textContent = t("find.close");
    findReplaceButton.textContent = t("find.replace");
    findReplaceAllButton.textContent = t("find.replaceAll");

    findToggleReplaceButton.textContent = findReplaceState.showReplace
      ? t("find.toggleReplace.close")
      : t("find.toggleReplace.open");
    findToggleReplaceButton.setAttribute("aria-pressed", String(findReplaceState.showReplace));
    findToggleReplaceButton.classList.toggle("active", findReplaceState.showReplace);
    findInput.value = findReplaceState.query;
    replaceInput.value = findReplaceState.replaceText;
    findMatchCaseButton.classList.toggle("active", findReplaceState.matchCase);
    findMatchWordButton.classList.toggle("active", findReplaceState.matchWholeWord);
    findMatchCaseButton.setAttribute("aria-pressed", String(findReplaceState.matchCase));
    findMatchWordButton.setAttribute("aria-pressed", String(findReplaceState.matchWholeWord));
    findMatchCaseButton.title = `${t("find.matchCase")} (${findReplaceState.matchCase ? "on" : "off"})`;
    findMatchWordButton.title = `${t("find.matchWholeWord")} (${findReplaceState.matchWholeWord ? "on" : "off"})`;

    const matches = getFindMatches();
    const hasQuery = findReplaceState.query.length > 0;
    const hasMatches = matches.length > 0;
    const currentMatchIndex = hasMatches ? getCurrentFindMatchIndex(matches) : -1;
    findReplaceState.activeMatchIndex = currentMatchIndex;
    const current = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
    findStatus.textContent = hasQuery
      ? hasMatches
        ? formatMessage(t("find.result"), { current: String(current), total: String(matches.length) })
        : t("find.result.none")
      : "";

    findPrevButton.disabled = !hasMatches;
    findNextButton.disabled = !hasMatches;
    findReplaceButton.disabled = !hasMatches;
    findReplaceAllButton.disabled = !hasMatches;
  }

  function openFind(showReplace: boolean) {
    findReplaceState.isOpen = true;
    findReplaceState.showReplace = showReplace;
    const selectedText = editor.value.slice(editor.selectionStart ?? 0, editor.selectionEnd ?? 0).trim();

    if (selectedText) {
      findReplaceState.query = selectedText;
      findReplaceState.activeMatchIndex = -1;
    }

    deps.closeInsertMenu();
    deps.closeSettingsMenu();
    deps.closeAutocomplete();
    renderPanel();
    window.requestAnimationFrame(() => {
      findInput.focus();
      findInput.select();
    });
  }

  function toggleReplaceMode() {
    findReplaceState.showReplace = !findReplaceState.showReplace;
    renderPanel();
    window.requestAnimationFrame(() => {
      if (findReplaceState.showReplace) {
        replaceInput.focus();
        return;
      }

      findInput.focus();
    });
  }

  function closeFind(restoreFocus = false) {
    if (!findReplaceState.isOpen) {
      return;
    }

    findReplaceState.isOpen = false;
    findReplaceState.activeMatchIndex = -1;
    renderPanel();

    if (restoreFocus) {
      editor.focus();
    }
  }

  async function findNext(direction: 1 | -1) {
    const matches = getFindMatches();

    if (matches.length === 0) {
      findReplaceState.activeMatchIndex = -1;
      renderPanel();
      return;
    }

    const selectionStart = editor.selectionStart ?? 0;
    const selectionEnd = editor.selectionEnd ?? selectionStart;
    let nextIndex: number;

    if (direction > 0) {
      nextIndex = matches.findIndex((match) => match.start > selectionEnd);

      if (nextIndex < 0) {
        nextIndex = 0;
      }
    } else {
      nextIndex = matches.length - 1;

      for (let index = matches.length - 1; index >= 0; index -= 1) {
        if (matches[index].end < selectionStart) {
          nextIndex = index;
          break;
        }
      }
    }

    findReplaceState.activeMatchIndex = nextIndex;
    const match = matches[nextIndex];
    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    renderPanel();
  }

  async function replaceCurrent() {
    const matches = getFindMatches();

    if (matches.length === 0) {
      return;
    }

    const selectedStart = editor.selectionStart ?? 0;
    const selectedEnd = editor.selectionEnd ?? 0;
    let targetIndex = matches.findIndex((match) => match.start === selectedStart && match.end === selectedEnd);

    if (targetIndex < 0) {
      await findNext(1);
      return;
    }

    const match = matches[targetIndex];
    deps.applyEditorEdit({
      start: match.start,
      end: match.end,
      text: findReplaceState.replaceText
    });

    const delta = findReplaceState.replaceText.length;
    editor.setSelectionRange(match.start, match.start + delta);

    const nextMatches = getFindMatches();
    if (nextMatches.length === 0) {
      findReplaceState.activeMatchIndex = -1;
      renderPanel();
      return;
    }

    targetIndex = Math.min(targetIndex, nextMatches.length - 1);
    findReplaceState.activeMatchIndex = targetIndex;
    renderPanel();
    await findNext(1);
  }

  async function replaceAll() {
    const matches = getFindMatches();

    if (matches.length === 0) {
      return;
    }

    const source = editor.value;
    const replacement = findReplaceState.replaceText;
    let cursor = 0;
    const chunks: string[] = [];
    let lastReplacementEnd = 0;

    for (const match of matches) {
      chunks.push(source.slice(cursor, match.start));
      chunks.push(replacement);
      lastReplacementEnd = chunks.join("").length;
      cursor = match.end;
    }

    chunks.push(source.slice(cursor));
    const nextValue = chunks.join("");

    editor.focus();
    editor.value = nextValue;
    const caret = Math.min(lastReplacementEnd, nextValue.length);
    editor.setSelectionRange(caret, caret);
    deps.syncTextFieldState(editor);
    findReplaceState.activeMatchIndex = -1;
    renderPanel();
  }

  async function handleAction(action: string): Promise<boolean> {
    switch (action) {
      case "find-prev":
        await findNext(-1);
        return true;
      case "find-next":
        await findNext(1);
        return true;
      case "find-close":
        closeFind(true);
        return true;
      case "find-toggle-replace":
        toggleReplaceMode();
        return true;
      case "find-replace":
        await replaceCurrent();
        return true;
      case "find-replace-all":
        await replaceAll();
        return true;
      default:
        return false;
    }
  }

  function bindListeners() {
    findInput.addEventListener("input", () => {
      findReplaceState.query = findInput.value;
      findReplaceState.activeMatchIndex = -1;
      renderPanel();
    });

    replaceInput.addEventListener("input", () => {
      findReplaceState.replaceText = replaceInput.value;
    });

    findMatchCaseButton.addEventListener("click", () => {
      findReplaceState.matchCase = !findReplaceState.matchCase;
      findReplaceState.activeMatchIndex = -1;
      renderPanel();
    });

    findMatchWordButton.addEventListener("click", () => {
      findReplaceState.matchWholeWord = !findReplaceState.matchWholeWord;
      findReplaceState.activeMatchIndex = -1;
      renderPanel();
    });

    findInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void findNext(event.shiftKey ? -1 : 1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeFind(true);
      }
    });

    replaceInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void replaceCurrent();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeFind(true);
      }
    });
  }

  function isOpen() {
    return findReplaceState.isOpen;
  }

  function showReplace() {
    return findReplaceState.showReplace;
  }

  return {
    renderPanel,
    openFind,
    closeFind,
    toggleReplaceMode,
    findNext,
    replaceCurrent,
    replaceAll,
    handleAction,
    bindListeners,
    isOpen,
    showReplace
  };
}
