import {
  documentsSection,
  drawerTabDocumentsButton,
  drawerTabOutlineButton,
  editor,
  outlineEmpty,
  outlineList,
  outlineSection,
  outlineSectionCount,
  outlineSectionTitle,
  preview
} from "../dom";
import { parseOutline, type OutlineHeading } from "../editor/outline";
import { translate, type TranslationKey } from "../i18n/dictionaries";
import { setActiveScrollSource, state } from "../state";
import { escapeAttribute, escapeHtml } from "../utils/html";

export interface OutlineController {
  renderTabs: () => void;
  renderOutline: () => void;
  jumpToHeading: (lineIndex: number) => void;
}

function t(key: TranslationKey): string {
  return translate(state.locale, key);
}

function getLineRange(value: string, lineIndex: number): { start: number; end: number } {
  let start = 0;

  for (let i = 0; i < lineIndex; i += 1) {
    const nextBreak = value.indexOf("\n", start);

    if (nextBreak < 0) {
      return { start: value.length, end: value.length };
    }

    start = nextBreak + 1;
  }

  const nextBreak = value.indexOf("\n", start);
  const end = nextBreak < 0 ? value.length : nextBreak;
  return { start, end };
}

export function createOutlineController(): OutlineController {
  function renderTabs(): void {
    const isOutline = state.drawerTab === "outline";

    drawerTabDocumentsButton.classList.toggle("active", !isOutline);
    drawerTabDocumentsButton.setAttribute("aria-selected", String(!isOutline));
    drawerTabDocumentsButton.textContent = t("drawer.documents");

    drawerTabOutlineButton.classList.toggle("active", isOutline);
    drawerTabOutlineButton.setAttribute("aria-selected", String(isOutline));
    drawerTabOutlineButton.textContent = t("drawer.outline");

    documentsSection.classList.toggle("hidden", isOutline);
    outlineSection.classList.toggle("hidden", !isOutline);
  }

  function renderOutline(): void {
    outlineSectionTitle.textContent = t("drawer.outline");
    outlineEmpty.textContent = t("outline.empty");

    const headings = parseOutline(state.content);
    outlineSectionCount.textContent = String(headings.length);

    if (headings.length === 0) {
      outlineList.innerHTML = "";
      outlineList.classList.add("hidden");
      outlineEmpty.classList.remove("hidden");
      return;
    }

    outlineList.classList.remove("hidden");
    outlineEmpty.classList.add("hidden");
    outlineList.innerHTML = headings.map(renderItem).join("");
  }

  function renderItem(heading: OutlineHeading): string {
    const label = heading.text || `H${heading.level}`;
    const prefix = "#".repeat(heading.level);
    return `
      <li class="outline-item level-${heading.level}">
        <button type="button" class="outline-button" data-action="outline-jump" data-line="${heading.line}" title="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}">
          <span class="outline-prefix" aria-hidden="true">${prefix}</span>
          <span class="outline-text">${escapeHtml(label)}</span>
        </button>
      </li>
    `;
  }

  function scrollPreviewToHeading(headingIndex: number): void {
    const headings = preview.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
    const target = headings[headingIndex];

    if (!target) {
      return;
    }

    const previewTop = preview.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    preview.scrollTop += targetTop - previewTop;
  }

  function jumpToHeading(lineIndex: number): void {
    const value = editor.value;
    const { start, end } = getLineRange(value, lineIndex);

    setActiveScrollSource("editor");
    editor.focus();
    editor.setSelectionRange(start, end);

    const computedLineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    const lineHeight = Number.isFinite(computedLineHeight) && computedLineHeight > 0 ? computedLineHeight : 0;

    if (lineHeight > 0) {
      editor.scrollTop = Math.max(0, lineIndex * lineHeight - lineHeight);
    }

    const headings = parseOutline(state.content);
    const headingIndex = headings.findIndex((heading) => heading.line === lineIndex);

    if (headingIndex >= 0) {
      scrollPreviewToHeading(headingIndex);
    }
  }

  return {
    renderTabs,
    renderOutline,
    jumpToHeading
  };
}
