import { describe, expect, it } from "vitest";
import { resolveLinkAction } from "./link";

describe("resolveLinkAction", () => {
  it("returns ignored for nullish and empty input", () => {
    expect(resolveLinkAction(null)).toEqual({ kind: "ignored" });
    expect(resolveLinkAction(undefined)).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("")).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("   ")).toEqual({ kind: "ignored" });
  });

  it("opens http and https URLs externally", () => {
    expect(resolveLinkAction("http://example.com")).toEqual({
      kind: "external",
      url: "http://example.com"
    });
    expect(resolveLinkAction("https://example.com/path?q=1")).toEqual({
      kind: "external",
      url: "https://example.com/path?q=1"
    });
  });

  it("treats the scheme case-insensitively", () => {
    expect(resolveLinkAction("HTTPS://Example.com")).toEqual({
      kind: "external",
      url: "HTTPS://Example.com"
    });
  });

  it("opens mailto URLs externally", () => {
    expect(resolveLinkAction("mailto:foo@bar.com")).toEqual({
      kind: "external",
      url: "mailto:foo@bar.com"
    });
  });

  it("ignores anchor fragments", () => {
    expect(resolveLinkAction("#section")).toEqual({ kind: "ignored" });
  });

  it("ignores relative paths", () => {
    expect(resolveLinkAction("./other.md")).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("../foo.md")).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("notes/index.md")).toEqual({ kind: "ignored" });
  });

  it("ignores unsupported and dangerous schemes", () => {
    expect(resolveLinkAction("javascript:alert(1)")).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("data:text/html,<script>alert(1)</script>")).toEqual({
      kind: "ignored"
    });
    expect(resolveLinkAction("file:///etc/passwd")).toEqual({ kind: "ignored" });
    expect(resolveLinkAction("ftp://example.com")).toEqual({ kind: "ignored" });
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(resolveLinkAction("  https://example.com  ")).toEqual({
      kind: "external",
      url: "https://example.com"
    });
  });
});
