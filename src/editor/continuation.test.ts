import { describe, expect, it } from "vitest";
import { buildMarkdownContinuation } from "./continuation";

describe("buildMarkdownContinuation", () => {
  it("returns null for plain lines", () => {
    expect(buildMarkdownContinuation("just text")).toBeNull();
  });

  it("continues unordered bullets", () => {
    expect(buildMarkdownContinuation("- item one")).toBe("- ");
    expect(buildMarkdownContinuation("  * nested")).toBe("  * ");
  });

  it("breaks out of an empty bullet", () => {
    expect(buildMarkdownContinuation("- ")).toBe("");
  });

  it("increments ordered list numbers", () => {
    expect(buildMarkdownContinuation("1. first")).toBe("2. ");
    expect(buildMarkdownContinuation("  9. nested")).toBe("  10. ");
  });

  it("continues task list items as unchecked", () => {
    expect(buildMarkdownContinuation("- [x] done")).toBe("- [ ] ");
    expect(buildMarkdownContinuation("- [ ] todo")).toBe("- [ ] ");
  });

  it("breaks out of empty task lists", () => {
    expect(buildMarkdownContinuation("- [ ] ")).toBe("");
  });

  it("continues block quotes", () => {
    expect(buildMarkdownContinuation("> quoted")).toBe("> ");
  });

  it("breaks out of empty block quotes", () => {
    expect(buildMarkdownContinuation("> ")).toBe("");
  });
});
