// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./html-to-markdown";

describe("htmlToMarkdown", () => {
  it("converts headings to atx style", () => {
    expect(htmlToMarkdown("<h1>Title</h1>")).toBe("# Title");
    expect(htmlToMarkdown("<h2>Sub</h2>")).toBe("## Sub");
    expect(htmlToMarkdown("<h3>Deep</h3>")).toBe("### Deep");
  });

  it("converts strong and emphasis", () => {
    expect(htmlToMarkdown("<strong>bold</strong>")).toBe("**bold**");
    expect(htmlToMarkdown("<em>italic</em>")).toBe("*italic*");
  });

  it("converts links to inline markdown", () => {
    expect(htmlToMarkdown(`<a href="https://example.com">site</a>`)).toBe("[site](https://example.com)");
  });

  it("converts unordered lists with a dash marker", () => {
    expect(htmlToMarkdown("<ul><li>one</li><li>two</li></ul>")).toBe("-   one\n-   two");
  });

  it("converts ordered lists", () => {
    expect(htmlToMarkdown("<ol><li>one</li><li>two</li></ol>")).toBe("1.  one\n2.  two");
  });

  it("converts inline code", () => {
    expect(htmlToMarkdown("<p>use <code>npm</code> here</p>")).toBe("use `npm` here");
  });

  it("converts pre/code to a fenced block", () => {
    expect(htmlToMarkdown("<pre><code>let x = 1;</code></pre>")).toBe("```\nlet x = 1;\n```");
  });

  it("keeps the original image url", () => {
    expect(htmlToMarkdown(`<img src="https://cdn.test/a.png" alt="pic">`)).toBe("![pic](https://cdn.test/a.png)");
  });

  it("converts a gfm table", () => {
    const html = "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>";
    expect(htmlToMarkdown(html)).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |");
  });

  it("returns clean text for plain paragraph html", () => {
    expect(htmlToMarkdown("<p>just text</p>")).toBe("just text");
  });

  it("returns empty string for empty or whitespace html", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("   ")).toBe("");
  });
});
