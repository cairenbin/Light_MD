import { describe, expect, it } from "vitest";
import { applyTabIndentation } from "./indent";

describe("applyTabIndentation", () => {
  it("indents at cursor for single line tab", () => {
    const result = applyTabIndentation({
      value: "hello",
      selectionStart: 0,
      selectionEnd: 0,
      outdent: false
    });

    expect(result.value).toBe("  hello");
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(2);
    expect(result.changed).toBe(true);
  });

  it("outdents current line for single cursor shift+tab", () => {
    const result = applyTabIndentation({
      value: "  hello",
      selectionStart: 4,
      selectionEnd: 4,
      outdent: true
    });

    expect(result.value).toBe("hello");
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(2);
    expect(result.changed).toBe(true);
  });

  it("indents all selected lines for multi-line selection", () => {
    const value = "a\nb\nc";
    const result = applyTabIndentation({
      value,
      selectionStart: 0,
      selectionEnd: value.length,
      outdent: false
    });

    expect(result.value).toBe("  a\n  b\n  c");
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(value.length + 6);
    expect(result.changed).toBe(true);
  });

  it("outdents all selected lines when indentation exists", () => {
    const value = "  a\n  b\n  c";
    const result = applyTabIndentation({
      value,
      selectionStart: 0,
      selectionEnd: value.length,
      outdent: true
    });

    expect(result.value).toBe("a\nb\nc");
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(value.length - 6);
    expect(result.changed).toBe(true);
  });

  it("keeps content unchanged when outdenting unindented selection", () => {
    const value = "a\nb\nc";
    const result = applyTabIndentation({
      value,
      selectionStart: 0,
      selectionEnd: value.length,
      outdent: true
    });

    expect(result.value).toBe(value);
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(value.length);
    expect(result.changed).toBe(false);
  });
});
