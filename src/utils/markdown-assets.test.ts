import { describe, expect, it } from "vitest";
import { extractMarkdownImageSources } from "./markdown-assets";

describe("extractMarkdownImageSources", () => {
  it("collects markdown image targets in order without duplicates", () => {
    const markdown = [
      "![a](assets/doc/a.png)",
      "![b](assets/doc/b.png)",
      "![a-again](assets/doc/a.png)"
    ].join("\n");

    expect(extractMarkdownImageSources(markdown)).toEqual([
      "assets/doc/a.png",
      "assets/doc/b.png"
    ]);
  });

  it("strips query, fragment, and optional title", () => {
    const markdown = [
      '![a](assets/doc/a.png "title")',
      "![b](assets/doc/b.png?x=1#hash)"
    ].join("\n");

    expect(extractMarkdownImageSources(markdown)).toEqual([
      "assets/doc/a.png",
      "assets/doc/b.png"
    ]);
  });

  it("supports angle-bracket targets and backslash normalization", () => {
    const markdown = "![a](<assets\\\\doc\\\\a.png>)";
    expect(extractMarkdownImageSources(markdown)).toEqual(["assets/doc/a.png"]);
  });
});
