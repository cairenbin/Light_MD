import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown-renderer";

describe("renderMarkdownToHtml", () => {
  it("renders inline KaTeX formulas", () => {
    const output = renderMarkdownToHtml("Energy: $E = mc^2$.");

    expect(output).toContain("katex");
    expect(output).toContain("E");
    expect(output).toContain("mc");
  });

  it("renders block KaTeX formulas", () => {
    const output = renderMarkdownToHtml("$$\n\\int_0^1 x^2 dx\n$$");

    expect(output).toContain("katex-display");
    expect(output).toContain("∫");
  });

  it("renders display formulas directly after paragraph text", () => {
    const output = renderMarkdownToHtml("4\n$$\n\\int_0^1 x^2 dx\n$$");

    expect(output).toContain("katex-display");
    expect(output).toContain("∫");
    expect(output).not.toContain("$$");
  });

  it("renders non-standard inline formulas without surrounding spaces", () => {
    const output = renderMarkdownToHtml("Use f(x)=$x^2$today.");

    expect(output).toContain("katex");
    expect(output).toContain("x");
  });

  it("does not render KaTeX inside fenced code blocks", () => {
    const output = renderMarkdownToHtml("```ts\nconst price = '$x^2$';\n```");

    expect(output).toContain("<pre><code");
    expect(output).toContain("$x^2$");
    expect(output).not.toContain("katex-display");
  });
});
