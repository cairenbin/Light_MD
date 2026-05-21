import {
  buildLinkEdit,
  buildWrappedEdit
} from "../editor/snippets";
import { editorAutocompleteItems, insertMenuItems } from "../editor/items";
import { insertMenu, insertMenuButton } from "../dom";
import { escapeHtml } from "../utils/html";
import {
  isInsertMenuOpen,
  setIsInsertMenuOpen,
  state
} from "../state";
import type { EditorAutocompleteContext, EditorSelectionEdit, ViewMode } from "../types";

export interface InsertControllerDeps {
  applyEditorEdit: (edit: EditorSelectionEdit) => void;
  getEditorAutocompleteContext: () => EditorAutocompleteContext;
  closeSettingsMenu: (restoreFocus?: boolean) => void;
  closeAutocomplete: () => void;
  setMode: (mode: ViewMode) => void;
}

export interface InsertController {
  renderMenu: () => void;
  updateMenuPosition: () => void;
  toggleMenu: () => void;
  openMenu: (focusIndex?: number) => void;
  closeMenu: (restoreFocus?: boolean) => void;
  applyFormatting: (action: "bold" | "italic" | "link" | "code" | "quote") => void;
  applyMenuItem: (insertId: string) => void;
  handleAction: (action: string, target: HTMLElement) => boolean;
  bindListeners: () => void;
  isOpen: () => boolean;
}

export function createInsertController(deps: InsertControllerDeps): InsertController {
  function renderMenu() {
    insertMenuButton.setAttribute("aria-expanded", String(isInsertMenuOpen));
    insertMenu.classList.toggle("hidden", !isInsertMenuOpen);
    insertMenu.setAttribute("aria-hidden", String(!isInsertMenuOpen));
    insertMenu.setAttribute("tabindex", isInsertMenuOpen ? "0" : "-1");

    insertMenu.innerHTML = insertMenuItems
      .map(
        (item, index) => `
        <button class="insert-menu-item" type="button" tabindex="-1" data-index="${index}" data-action="insert-snippet" data-insert-id="${item.id}">
          <span class="insert-menu-copy">
            <span class="insert-menu-label">${escapeHtml(item.label)}</span>
            <span class="insert-menu-detail">${escapeHtml(item.detail)}</span>
          </span>
        </button>
      `
      )
      .join("");

    updateMenuPosition();
  }

  function updateMenuPosition() {
    if (!isInsertMenuOpen) {
      return;
    }

    const viewportPadding = 16;
    const verticalGap = 10;
    const buttonRect = insertMenuButton.getBoundingClientRect();
    const menuWidth = Math.min(340, Math.max(220, window.innerWidth - viewportPadding * 2));
    const maxLeft = window.innerWidth - viewportPadding - menuWidth;
    const left = Math.max(viewportPadding, Math.min(buttonRect.left, maxLeft));
    const preferredTop = buttonRect.bottom + verticalGap;
    const minUsableHeight = 180;
    const clampedTop = Math.min(
      preferredTop,
      Math.max(viewportPadding, window.innerHeight - viewportPadding - minUsableHeight)
    );
    const maxHeight = Math.max(140, Math.min(360, window.innerHeight - clampedTop - viewportPadding));

    insertMenu.style.left = `${Math.round(left)}px`;
    insertMenu.style.top = `${Math.round(clampedTop)}px`;
    insertMenu.style.width = `${Math.round(menuWidth)}px`;
    insertMenu.style.maxHeight = `${Math.round(maxHeight)}px`;
  }

  function getMenuButtons(): HTMLButtonElement[] {
    return Array.from(insertMenu.querySelectorAll<HTMLButtonElement>(".insert-menu-item"));
  }

  function focusMenuItem(index: number) {
    const buttons = getMenuButtons();
    const target = buttons[index];

    if (!target) {
      insertMenu.focus();
      return;
    }

    target.focus();
  }

  function openMenu(focusIndex = 0) {
    setIsInsertMenuOpen(true);
    deps.closeSettingsMenu();
    deps.closeAutocomplete();
    renderMenu();
    updateMenuPosition();
    window.setTimeout(() => {
      focusMenuItem(focusIndex);
    }, 0);
  }

  function closeMenu(restoreFocus = false) {
    if (!isInsertMenuOpen) {
      return;
    }

    setIsInsertMenuOpen(false);
    renderMenu();
    insertMenu.style.left = "";
    insertMenu.style.top = "";
    insertMenu.style.width = "";
    insertMenu.style.maxHeight = "";

    if (restoreFocus) {
      insertMenuButton.focus();
    }
  }

  function toggleMenu() {
    if (isInsertMenuOpen) {
      closeMenu(true);
      return;
    }

    openMenu(0);
  }

  function applyFormatting(action: "bold" | "italic" | "link" | "code" | "quote") {
    if (state.mode === "preview") {
      deps.setMode("write");
    }

    const context = deps.getEditorAutocompleteContext();

    if (action === "quote") {
      const quoteItem = editorAutocompleteItems.find((item) => item.id === "blockquote");
      if (!quoteItem) {
        return;
      }
      deps.applyEditorEdit(quoteItem.buildEdit(context));
      return;
    }

    if (action === "bold") {
      deps.applyEditorEdit(buildWrappedEdit(context, "**", "**", "bold text"));
      return;
    }

    if (action === "italic") {
      deps.applyEditorEdit(buildWrappedEdit(context, "_", "_", "emphasis"));
      return;
    }

    if (action === "link") {
      deps.applyEditorEdit(buildLinkEdit(context, false));
      return;
    }

    deps.applyEditorEdit(buildWrappedEdit(context, "`", "`", "code"));
  }

  function adjustInsertEditForBlock(
    context: EditorAutocompleteContext,
    edit: EditorSelectionEdit
  ): EditorSelectionEdit {
    if (context.currentLine.trim().length === 0) {
      return edit;
    }

    const insertionPoint = context.lineEnd;
    const beforeText = context.value.slice(0, insertionPoint);
    const afterText = context.value.slice(insertionPoint);
    const prefix = beforeText.endsWith("\n") ? "" : "\n";
    const suffix =
      afterText.length === 0 ? "" : afterText.startsWith("\n\n") ? "" : afterText.startsWith("\n") ? "\n" : "\n\n";
    const selectionStartOffset = (edit.selectionStart ?? edit.start + edit.text.length) - edit.start;
    const selectionEndOffset = (edit.selectionEnd ?? edit.start + edit.text.length) - edit.start;

    return {
      start: insertionPoint,
      end: insertionPoint,
      text: `${prefix}${edit.text}${suffix}`,
      selectionStart: insertionPoint + prefix.length + selectionStartOffset,
      selectionEnd: insertionPoint + prefix.length + selectionEndOffset
    };
  }

  function applyMenuItem(insertId: string) {
    const item = insertMenuItems.find((entry) => entry.id === insertId);

    if (!item) {
      return;
    }

    if (state.mode === "preview") {
      deps.setMode("write");
    }

    const context = deps.getEditorAutocompleteContext();
    const edit = item.buildEdit(context);
    deps.applyEditorEdit(adjustInsertEditForBlock(context, edit));
    closeMenu();
  }

  function handleAction(action: string, target: HTMLElement): boolean {
    switch (action) {
      case "toggle-insert-menu":
        toggleMenu();
        return true;
      case "format-bold":
        applyFormatting("bold");
        return true;
      case "format-italic":
        applyFormatting("italic");
        return true;
      case "format-link":
        applyFormatting("link");
        return true;
      case "format-code":
        applyFormatting("code");
        return true;
      case "format-quote":
        applyFormatting("quote");
        return true;
      case "insert-snippet":
        if (target.dataset.insertId) {
          applyMenuItem(target.dataset.insertId);
        }
        return true;
      default:
        return false;
    }
  }

  function bindListeners() {
    insertMenuButton.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu(0);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(insertMenuItems.length - 1);
      }
    });

    insertMenu.addEventListener("keydown", (event) => {
      if (!isInsertMenuOpen) {
        return;
      }

      const buttons = getMenuButtons();

      if (buttons.length === 0) {
        return;
      }

      const currentIndex = buttons.findIndex((button) => button === document.activeElement);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusMenuItem((currentIndex + 1 + buttons.length) % buttons.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusMenuItem((currentIndex - 1 + buttons.length) % buttons.length);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        focusMenuItem(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        focusMenuItem(buttons.length - 1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    });
  }

  function isOpen() {
    return isInsertMenuOpen;
  }

  return {
    renderMenu,
    updateMenuPosition,
    toggleMenu,
    openMenu,
    closeMenu,
    applyFormatting,
    applyMenuItem,
    handleAction,
    bindListeners,
    isOpen
  };
}
