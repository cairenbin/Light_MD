import { describe, expect, it } from "vitest";
import { buildImageSavePlan, buildMarkdownImageLink, isImagePath } from "./image";

describe("isImagePath", () => {
  it("accepts common image extensions case-insensitively", () => {
    expect(isImagePath("/tmp/a.png")).toBe(true);
    expect(isImagePath("/tmp/a.JPG")).toBe(true);
    expect(isImagePath("C:\\tmp\\a.WebP")).toBe(true);
  });

  it("rejects non-image paths", () => {
    expect(isImagePath("/tmp/a.md")).toBe(false);
    expect(isImagePath("/tmp/a")).toBe(false);
  });
});

describe("buildImageSavePlan", () => {
  it("builds a deterministic image file name with source extension", () => {
    const plan = buildImageSavePlan({
      markdownPath: "/docs/README.md",
      sourceName: "cat photo.JPEG",
      date: new Date("2026-05-25T12:34:56")
    });

    expect(plan.markdownPath).toBe("/docs/README.md");
    expect(plan.fileName).toBe("README-20260525-123456.jpeg");
  });

  it("falls back to mime type extension and default png", () => {
    const fromMime = buildImageSavePlan({
      markdownPath: "/docs/note.md",
      mimeType: "image/gif",
      date: new Date("2026-05-25T12:34:56")
    });
    const fallback = buildImageSavePlan({
      markdownPath: "/docs/note.md",
      mimeType: "application/octet-stream",
      date: new Date("2026-05-25T12:34:56")
    });

    expect(fromMime.fileName).toBe("note-20260525-123456.gif");
    expect(fallback.fileName).toBe("note-20260525-123456.png");
  });
});

describe("buildMarkdownImageLink", () => {
  it("generates markdown image syntax and normalizes separators", () => {
    expect(buildMarkdownImageLink("assets\\img.png", "hello world")).toBe("![hello world](assets/img.png)");
  });
});
