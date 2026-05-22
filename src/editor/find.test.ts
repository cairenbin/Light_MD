import { describe, expect, it } from "vitest";
import { MAX_FIND_MATCHES } from "../constants";
import { getFindMatches, isValidFindQuery, isWholeWordMatch } from "./find";

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
  const baseOptions = { query: "", matchCase: false, matchWholeWord: false, matchRegex: false };

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

  it("escapes regex metacharacters in the query when regex mode is off", () => {
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

  it("treats the query as a regex when matchRegex is on", () => {
    const matches = getFindMatches("a.b a.b a/b", {
      ...baseOptions,
      query: "a.b",
      matchRegex: true
    });
    expect(matches).toHaveLength(3);
  });

  it("supports regex character classes and quantifiers", () => {
    const matches = getFindMatches("aaa bbb ccc", {
      ...baseOptions,
      query: "[abc]{3}",
      matchRegex: true
    });
    expect(matches).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 11 }
    ]);
  });

  it("returns empty matches for an invalid regex", () => {
    const matches = getFindMatches("abc", {
      ...baseOptions,
      query: "[abc",
      matchRegex: true
    });
    expect(matches).toEqual([]);
  });

  it("still applies whole-word filtering in regex mode", () => {
    const matches = getFindMatches("foo foobar foo", {
      ...baseOptions,
      query: "fo+",
      matchRegex: true,
      matchWholeWord: true
    });
    expect(matches).toEqual([
      { start: 0, end: 3 },
      { start: 11, end: 14 }
    ]);
  });
});

describe("isValidFindQuery", () => {
  const baseOptions = { query: "", matchCase: false, matchWholeWord: false, matchRegex: false };

  it("treats empty queries as valid", () => {
    expect(isValidFindQuery({ ...baseOptions, query: "", matchRegex: true })).toBe(true);
  });

  it("treats arbitrary literal queries as valid when regex is off", () => {
    expect(isValidFindQuery({ ...baseOptions, query: "[abc" })).toBe(true);
  });

  it("returns false for malformed regex patterns", () => {
    expect(isValidFindQuery({ ...baseOptions, query: "[abc", matchRegex: true })).toBe(false);
  });

  it("returns true for well-formed regex patterns", () => {
    expect(isValidFindQuery({ ...baseOptions, query: "fo+", matchRegex: true })).toBe(true);
  });
});
