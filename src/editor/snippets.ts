import type { EditorAutocompleteContext, EditorSelectionEdit } from "../types";

export function buildInsertionEdit(
  context: EditorAutocompleteContext,
  text: string,
  selectionOffsetStart = text.length,
  selectionOffsetEnd = selectionOffsetStart
): EditorSelectionEdit {
  return {
    start: context.selectionStart,
    end: context.selectionEnd,
    text,
    selectionStart: context.selectionStart + selectionOffsetStart,
    selectionEnd: context.selectionStart + selectionOffsetEnd
  };
}

export function buildLineReplacementEdit(
  context: EditorAutocompleteContext,
  text: string,
  selectionOffsetStart = text.length,
  selectionOffsetEnd = selectionOffsetStart
): EditorSelectionEdit {
  return {
    start: context.lineStart,
    end: context.lineEnd,
    text,
    selectionStart: context.lineStart + selectionOffsetStart,
    selectionEnd: context.lineStart + selectionOffsetEnd
  };
}

export function buildHeadingEdit(context: EditorAutocompleteContext, level: number): EditorSelectionEdit {
  const marker = "#".repeat(level);
  const label = context.selectedText || `Heading ${level}`;

  if (/^\s*#{1,6}\s*$/.test(context.currentLine)) {
    return buildLineReplacementEdit(context, `${marker} ${label}`, marker.length + 1, marker.length + 1 + label.length);
  }

  return buildInsertionEdit(context, `${marker} ${label}`, marker.length + 1, marker.length + 1 + label.length);
}

export function buildLineSnippetEdit(
  context: EditorAutocompleteContext,
  text: string,
  triggerPattern: RegExp
): EditorSelectionEdit {
  const placeholderStart = text.indexOf(" ") + 1;

  if (triggerPattern.test(context.currentLine)) {
    return buildLineReplacementEdit(context, text, placeholderStart, text.length);
  }

  return buildInsertionEdit(context, text, placeholderStart, text.length);
}

export function buildCodeFenceEdit(context: EditorAutocompleteContext, language = "md"): EditorSelectionEdit {
  const body = context.selectedText || "code";
  const opener = `\`\`\`${language}`;
  const text = `${opener}\n${body}\n\`\`\``;
  const start = `${opener}\n`.length;

  if (/^\s*(```|~~~)\s*\w*\s*$/.test(context.currentLine)) {
    return buildLineReplacementEdit(context, text, start, start + body.length);
  }

  return buildInsertionEdit(context, text, start, start + body.length);
}

export function buildLinkEdit(context: EditorAutocompleteContext, image: boolean): EditorSelectionEdit {
  const label = context.selectedText || (image ? "alt text" : "link text");
  const url = image ? "https://example.com/image.png" : "https://example.com";
  const text = `${image ? "!" : ""}[${label}](${url})`;
  const urlStart = `${image ? "!" : ""}[${label}](`.length;

  return buildInsertionEdit(context, text, urlStart, urlStart + url.length);
}

export function buildReferenceLinkEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const label = context.selectedText || "reference text";
  const refId = "ref-1";
  const text = `[${label}][${refId}]\n\n[${refId}]: https://example.com`;
  const urlStart = `[${label}][${refId}]\n\n[${refId}]: `.length;

  return buildInsertionEdit(context, text, urlStart, urlStart + "https://example.com".length);
}

export function buildFootnoteReferenceEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const text = "[^1]";
  return buildInsertionEdit(context, text, 2, 3);
}

export function buildFootnoteDefinitionEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const text = "[^1]: Footnote text";
  return buildInsertionEdit(context, text, 6, text.length);
}

export function buildTableEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const text = "| Column | Column |\n| --- | --- |\n| Value | Value |";
  return buildInsertionEdit(context, text, 2, 8);
}

export function buildAlignedTableEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const text = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| Value | Value | Value |";
  return buildInsertionEdit(context, text, 2, 6);
}

export function buildWrappedEdit(
  context: EditorAutocompleteContext,
  prefix: string,
  suffix: string,
  placeholder: string
): EditorSelectionEdit {
  const content = context.selectedText || placeholder;
  const text = `${prefix}${content}${suffix}`;
  const contentStart = prefix.length;
  const contentEnd = prefix.length + content.length;

  return buildInsertionEdit(context, text, contentStart, contentEnd);
}

export function buildMathBlockEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const body = context.selectedText || "E = mc^2";
  const text = `$$\n${body}\n$$`;
  return buildInsertionEdit(context, text, 3, 3 + body.length);
}

export function buildDetailsEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const body = context.selectedText || "Hidden details";
  const text = `<details>\n<summary>Summary</summary>\n\n${body}\n</details>`;
  const summaryStart = "<details>\n<summary>".length;
  const summaryEnd = summaryStart + "Summary".length;

  return buildInsertionEdit(context, text, summaryStart, summaryEnd);
}

export function buildHtmlCommentEdit(context: EditorAutocompleteContext): EditorSelectionEdit {
  const text = "<!-- comment -->";
  return buildInsertionEdit(context, text, 5, 12);
}
