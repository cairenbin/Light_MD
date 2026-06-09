import { describe, expect, it } from "vitest";
import type { EditorAutocompleteContext } from "../types";
import {
  buildCodeFenceEdit,
  buildHeadingEdit,
  buildInsertionEdit,
  buildLineSnippetEdit,
  buildLinkEdit,
  buildWrappedEdit
} from "./snippets";

function makeContext(overrides: Partial<EditorAutocompleteContext> = {}): EditorAutocompleteContext {
  return {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    selectedText: "",
    lineStart: 0,
    lineEnd: 0,
    currentLine: "",
    beforeLineCursor: "",
    afterLineCursor: "",
    trimmedLine: "",
    token: "",
    tokenStart: 0,
    tokenEnd: 0,
    ...overrides
  };
}

describe("buildInsertionEdit", () => {
  it("targets the current selection range", () => {
    const ctx = makeContext({ selectionStart: 4, selectionEnd: 7 });
    const edit = buildInsertionEdit(ctx, "abc", 1, 2);
    expect(edit).toEqual({
      start: 4,
      end: 7,
      text: "abc",
      selectionStart: 5,
      selectionEnd: 6
    });
  });
});

describe("buildHeadingEdit", () => {
  it("inserts a heading using selected text as the label", () => {
    const ctx = makeContext({ selectionStart: 0, selectionEnd: 5, selectedText: "Hello" });
    const edit = buildHeadingEdit(ctx, 2);
    expect(edit.text).toBe("## Hello");
    expect(edit.selectionStart).toBe(3);
    expect(edit.selectionEnd).toBe(8);
  });

  it("replaces an existing heading marker on the line", () => {
    const ctx = makeContext({
      selectionStart: 2,
      selectionEnd: 2,
      currentLine: "## ",
      lineStart: 0,
      lineEnd: 3
    });
    const edit = buildHeadingEdit(ctx, 3);
    expect(edit.start).toBe(0);
    expect(edit.end).toBe(3);
    expect(edit.text.startsWith("### ")).toBe(true);
  });
});

describe("buildLineSnippetEdit", () => {
  it("replaces the line when the trigger pattern matches", () => {
    const ctx = makeContext({
      currentLine: "- ",
      lineStart: 0,
      lineEnd: 2
    });
    const edit = buildLineSnippetEdit(ctx, "- List item", /^[-*+]\s*$/);
    expect(edit.start).toBe(0);
    expect(edit.end).toBe(2);
    expect(edit.text).toBe("- List item");
  });

  it("inserts at the cursor when the trigger does not match", () => {
    const ctx = makeContext({
      selectionStart: 5,
      selectionEnd: 5,
      currentLine: "hello",
      lineStart: 0,
      lineEnd: 5
    });
    const edit = buildLineSnippetEdit(ctx, "- List item", /^[-*+]\s*$/);
    expect(edit.start).toBe(5);
    expect(edit.end).toBe(5);
    expect(edit.text).toBe("- List item");
  });
});

describe("buildCodeFenceEdit", () => {
  it("wraps selected text in a fenced block with the requested language", () => {
    const ctx = makeContext({ selectedText: "let x = 1;" });
    const edit = buildCodeFenceEdit(ctx, "ts");
    expect(edit.text).toBe("```ts\nlet x = 1;\n```");
  });

  it("defaults to the md language and a placeholder body", () => {
    const edit = buildCodeFenceEdit(makeContext());
    expect(edit.text).toBe("```md\ncode\n```");
  });
});

describe("buildLinkEdit", () => {
  it("uses the selected text as the link label", () => {
    const ctx = makeContext({ selectedText: "see docs" });
    const edit = buildLinkEdit(ctx, false);
    expect(edit.text).toBe("[see docs](https://example.com)");
  });

  it("produces an image markup when image=true", () => {
    const edit = buildLinkEdit(makeContext(), true);
    expect(edit.text.startsWith("![alt text](")).toBe(true);
  });
});

describe("buildWrappedEdit", () => {
  it("wraps the placeholder when nothing is selected", () => {
    const edit = buildWrappedEdit(makeContext(), "**", "**", "bold text");
    expect(edit.text).toBe("**bold text**");
    expect(edit.selectionStart).toBe(2);
    expect(edit.selectionEnd).toBe(2 + "bold text".length);
  });

  it("wraps the existing selection", () => {
    const ctx = makeContext({ selectionStart: 0, selectionEnd: 5, selectedText: "Hello" });
    const edit = buildWrappedEdit(ctx, "_", "_", "italic");
    expect(edit.text).toBe("_Hello_");
  });

  it("supports strikethrough wrappers", () => {
    const ctx = makeContext({ selectionStart: 0, selectionEnd: 5, selectedText: "Hello" });
    const edit = buildWrappedEdit(ctx, "~~", "~~", "removed text");
    expect(edit.text).toBe("~~Hello~~");
    expect(edit.selectionStart).toBe(2);
    expect(edit.selectionEnd).toBe(7);
  });
});
