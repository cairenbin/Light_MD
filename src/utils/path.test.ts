import { describe, expect, it } from "vitest";
import { documentInitial, formatPathForDisplay, normalizeFileName } from "./path";

describe("normalizeFileName", () => {
  it("falls back to Untitled.md when input is empty or whitespace", () => {
    expect(normalizeFileName("")).toBe("Untitled.md");
    expect(normalizeFileName("   ")).toBe("Untitled.md");
  });

  it("keeps markdown extensions intact", () => {
    expect(normalizeFileName("notes.md")).toBe("notes.md");
    expect(normalizeFileName("notes.markdown")).toBe("notes.markdown");
    expect(normalizeFileName("notes.txt")).toBe("notes.txt");
  });

  it("appends .md to bare names", () => {
    expect(normalizeFileName("notes")).toBe("notes.md");
    expect(normalizeFileName("  notes  ")).toBe("notes.md");
  });

  it("treats the extension match case-insensitively", () => {
    expect(normalizeFileName("notes.MD")).toBe("notes.MD");
    expect(normalizeFileName("notes.TXT")).toBe("notes.TXT");
  });
});

describe("formatPathForDisplay", () => {
  it("normalises Windows-style separators", () => {
    expect(formatPathForDisplay("C:\\\\Users\\\\me\\\\file.md")).toBe("C://Users//me//file.md");
  });

  it("returns short paths unchanged", () => {
    const short = "/Users/me/notes.md";
    expect(formatPathForDisplay(short)).toBe(short);
  });

  it("collapses long paths around an ellipsis", () => {
    const long = "/very/long/path/segments/that/definitely/exceed/the/threshold/of/fifty/characters.md";
    const formatted = formatPathForDisplay(long);
    expect(formatted).toContain(" ... ");
    expect(formatted.startsWith("/very/long/path/segments")).toBe(true);
    expect(formatted.endsWith("fifty/characters.md")).toBe(true);
  });
});

describe("documentInitial", () => {
  it("uppercases the first character", () => {
    expect(documentInitial("notes")).toBe("N");
  });

  it("falls back to a bullet when the name is blank", () => {
    expect(documentInitial("")).toBe("•");
    expect(documentInitial("   ")).toBe("•");
  });
});
