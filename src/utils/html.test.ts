import { describe, expect, it } from "vitest";
import { escapeAttribute, escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("escapes the five XSS-sensitive characters", () => {
    expect(escapeHtml(`<script>alert("xss")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands first to avoid double escaping", () => {
    expect(escapeHtml("Tom & Jerry < 5")).toBe("Tom &amp; Jerry &lt; 5");
  });

  it("escapes single quotes for HTML attribute safety", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("escapeAttribute", () => {
  it("escapes double quotes inside attribute values", () => {
    expect(escapeAttribute('title="bold"')).toBe("title=&quot;bold&quot;");
  });

  it("matches escapeHtml output for shared inputs", () => {
    const input = "<a href='x'>&</a>";
    expect(escapeAttribute(input)).toBe(escapeHtml(input));
  });
});
