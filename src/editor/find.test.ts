import { describe, expect, it } from "vitest";
import { MAX_FIND_MATCHES } from "../constants";
import { getFindMatches, isWholeWordMatch } from "./find";

describe("isWholeWordMatch", () => {
  it("returns true at the start of the source", () => {
    expect(isWholeWordMatch("foo bar", 0, 3)).toBe(true);
  });

  it("returns false when adjacent to other word characters", () => {
    expect(isWholeWordMatch("foobar", 0, 3)).toBe(false);
    expect(isWholeWordMatch("snafoo", 3, 3)).toBe(false);
  });

  it("treats unicode letters as word characters", () => {
    expect(isWholeWordMatch("中文测试", 1, 2)).toBe(false);
  });
});

describe("getFindMatches", () => {
  const baseOptions = { query: "", matchCase: false, matchWholeWord: false };

  it("returns no matches when the query is empty", () => {
    expect(getFindMatches("hello", { ...baseOptions, query: "" })).toEqual([]);
  });

  it("performs case-insensitive matching by default", () => {
    const matches = getFindMatches("Hello hello HELLO", { ...baseOptions, query: "hello" });
    expect(matches).toHaveLength(3);
    expect(matches[0]).toEqual({ start: 0, end: 5 });
  });

  it("respects matchCase", () => {
    const matches = getFindMatches("Hello hello HELLO", {
      ...baseOptions,
      query: "hello",
      matchCase: true
    });
    expect(matches).toEqual([{ start: 6, end: 11 }]);
  });

  it("escapes regex metacharacters in the query", () => {
    const matches = getFindMatches("a.b a.b a/b", { ...baseOptions, query: "a.b" });
    expect(matches).toHaveLength(2);
  });

  it("filters by whole word when requested", () => {
    const matches = getFindMatches("foo foobar foo", {
      ...baseOptions,
      query: "foo",
      matchWholeWord: true
    });
    expect(matches).toEqual([
      { start: 0, end: 3 },
      { start: 11, end: 14 }
    ]);
  });

  it("caps the result list at MAX_FIND_MATCHES", () => {
    const haystack = "x".repeat(MAX_FIND_MATCHES + 50);
    const matches = getFindMatches(haystack, { ...baseOptions, query: "x" });
    expect(matches).toHaveLength(MAX_FIND_MATCHES);
  });
});
