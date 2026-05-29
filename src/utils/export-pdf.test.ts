import { describe, expect, it } from "vitest";
import { toPdfExportFileName } from "./export-pdf";

describe("toPdfExportFileName", () => {
  it("replaces known extension with pdf", () => {
    expect(toPdfExportFileName("notes.md")).toBe("notes.pdf");
    expect(toPdfExportFileName("notes.html")).toBe("notes.pdf");
  });

  it("appends pdf extension when there is no extension", () => {
    expect(toPdfExportFileName("notes")).toBe("notes.pdf");
  });

  it("falls back to Untitled for blank names", () => {
    expect(toPdfExportFileName("   ")).toBe("Untitled.pdf");
  });
});
