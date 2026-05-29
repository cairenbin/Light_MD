import { describe, expect, it } from "vitest";
import { buildExportHtmlDocument, toHtmlExportFileName } from "./export-html";

describe("toHtmlExportFileName", () => {
  it("replaces markdown extension with html", () => {
    expect(toHtmlExportFileName("notes.md")).toBe("notes.html");
    expect(toHtmlExportFileName("notes.markdown")).toBe("notes.html");
  });

  it("adds html extension when there is no extension", () => {
    expect(toHtmlExportFileName("notes")).toBe("notes.html");
  });

  it("falls back to Untitled for blank names", () => {
    expect(toHtmlExportFileName("   ")).toBe("Untitled.html");
  });
});

describe("buildExportHtmlDocument", () => {
  it("wraps rendered body content into a full HTML document", () => {
    const output = buildExportHtmlDocument({
      title: "My Doc",
      bodyHtml: "<h1>Hello</h1>\n<p>World</p>"
    });

    expect(output).toContain("<!doctype html>");
    expect(output).toContain("<title>My Doc</title>");
    expect(output).toContain("<main>");
    expect(output).toContain("<h1>Hello</h1>");
    expect(output).toContain("<p>World</p>");
  });
});
