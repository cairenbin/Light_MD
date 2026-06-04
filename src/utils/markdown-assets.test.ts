import { describe, expect, it } from "vitest";
import {
  extractMarkdownImagePaths,
  extractMarkdownImageSources,
  replaceMarkdownImageSources
} from "./markdown-assets";

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

describe("extractMarkdownImagePaths", () => {
  it("preserves query string and fragment, unlike extractMarkdownImageSources", () => {
    const markdown = [
      "![a](https://cdn.example.com/a?size=large&token=abc)",
      '![b](https://cdn.example.com/b.png "remote")'
    ].join("\n");

    expect(extractMarkdownImagePaths(markdown)).toEqual([
      "https://cdn.example.com/a?size=large&token=abc",
      "https://cdn.example.com/b.png"
    ]);
  });

  it("deduplicates identical raw paths", () => {
    const markdown = [
      "![one](https://x.com/i?v=1)",
      "![two](https://x.com/i?v=1)"
    ].join("\n");

    expect(extractMarkdownImagePaths(markdown)).toEqual(["https://x.com/i?v=1"]);
  });
});

describe("replaceMarkdownImageSources", () => {
  it("rewrites matched raw paths while preserving alt text and title", () => {
    const markdown = [
      "![weibo pic](https://wx.example.com/p?w=1)",
      '![logo](https://x.com/logo.png "Brand")',
      "![local](assets/doc/keep.png)"
    ].join("\n");

    const mapping = new Map([
      ["https://wx.example.com/p?w=1", "assets/doc/p-1.jpg"],
      ["https://x.com/logo.png", "assets/doc/logo-2.png"]
    ]);

    expect(replaceMarkdownImageSources(markdown, mapping)).toBe(
      [
        "![weibo pic](assets/doc/p-1.jpg)",
        '![logo](assets/doc/logo-2.png "Brand")',
        "![local](assets/doc/keep.png)"
      ].join("\n")
    );
  });

  it("rewrites every occurrence of a repeated source", () => {
    const markdown = "![a](https://x.com/i?v=1) and ![b](https://x.com/i?v=1)";
    const mapping = { "https://x.com/i?v=1": "assets/doc/i-1.png" };

    expect(replaceMarkdownImageSources(markdown, mapping)).toBe(
      "![a](assets/doc/i-1.png) and ![b](assets/doc/i-1.png)"
    );
  });

  it("wraps replacement paths containing whitespace in angle brackets", () => {
    const markdown = "![a](https://x.com/i)";
    const mapping = { "https://x.com/i": "assets/my doc/i.png" };

    expect(replaceMarkdownImageSources(markdown, mapping)).toBe(
      "![a](<assets/my doc/i.png>)"
    );
  });

  it("returns the input unchanged when the mapping is empty", () => {
    const markdown = "![a](https://x.com/i)";
    expect(replaceMarkdownImageSources(markdown, new Map())).toBe(markdown);
  });
});
