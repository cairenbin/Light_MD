import { describe, expect, it } from "vitest";
import { parseOutline } from "./outline";

describe("parseOutline", () => {
  it("returns an empty list for empty content", () => {
    expect(parseOutline("")).toEqual([]);
  });

  it("parses ATX headings of levels 1 through 6", () => {
    const content = ["# h1", "## h2", "### h3", "#### h4", "##### h5", "###### h6"].join("\n");
    expect(parseOutline(content)).toEqual([
      { level: 1, text: "h1", line: 0 },
      { level: 2, text: "h2", line: 1 },
      { level: 3, text: "h3", line: 2 },
      { level: 4, text: "h4", line: 3 },
      { level: 5, text: "h5", line: 4 },
      { level: 6, text: "h6", line: 5 }
    ]);
  });

  it("ignores seven or more leading hashes", () => {
    expect(parseOutline("####### still a paragraph")).toEqual([]);
  });

  it("allows zero to three leading spaces", () => {
    const content = ["# zero", " # one", "  # two", "   # three", "    # four"].join("\n");
    expect(parseOutline(content)).toEqual([
      { level: 1, text: "zero", line: 0 },
      { level: 1, text: "one", line: 1 },
      { level: 1, text: "two", line: 2 },
      { level: 1, text: "three", line: 3 }
    ]);
  });

  it("strips trailing closing hashes", () => {
    expect(parseOutline("## Title ###")).toEqual([{ level: 2, text: "Title", line: 0 }]);
  });

  it("keeps middle hashes inside the text", () => {
    expect(parseOutline("## C# Notes")).toEqual([{ level: 2, text: "C# Notes", line: 0 }]);
  });

  it("supports empty headings", () => {
    expect(parseOutline("##")).toEqual([{ level: 2, text: "", line: 0 }]);
  });

  it("preserves line numbers across blank and prose lines", () => {
    const content = ["", "intro", "", "# h1", "more", "", "## h2"].join("\n");
    expect(parseOutline(content)).toEqual([
      { level: 1, text: "h1", line: 3 },
      { level: 2, text: "h2", line: 6 }
    ]);
  });

  it("skips headings inside fenced code blocks", () => {
    const content = ["# real", "```", "# fake", "## also fake", "```", "## also real"].join("\n");
    expect(parseOutline(content)).toEqual([
      { level: 1, text: "real", line: 0 },
      { level: 2, text: "also real", line: 5 }
    ]);
  });

  it("supports tilde fences independently from backtick fences", () => {
    const content = ["~~~", "# fake", "~~~", "# real"].join("\n");
    expect(parseOutline(content)).toEqual([{ level: 1, text: "real", line: 3 }]);
  });

  it("does not treat the opposite fence character as closing", () => {
    const content = ["```", "# inside", "~~~", "## still inside", "```", "# outside"].join("\n");
    expect(parseOutline(content)).toEqual([{ level: 1, text: "outside", line: 5 }]);
  });

  it("does not recognise setext headings", () => {
    const content = ["Title", "====", "Sub", "----"].join("\n");
    expect(parseOutline(content)).toEqual([]);
  });

  it("handles Windows line endings", () => {
    expect(parseOutline("# h1\r\n## h2")).toEqual([
      { level: 1, text: "h1", line: 0 },
      { level: 2, text: "h2", line: 1 }
    ]);
  });

  it("requires whitespace after the hash sequence", () => {
    expect(parseOutline("#title")).toEqual([]);
    expect(parseOutline("##title")).toEqual([]);
  });
});
