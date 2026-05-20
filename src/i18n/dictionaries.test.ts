import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE } from "../constants";
import { formatMessage, isSupportedLocale, translate } from "./dictionaries";

describe("isSupportedLocale", () => {
  it("accepts known locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("zh")).toBe(true);
    expect(isSupportedLocale("ja")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale("klingon")).toBe(false);
  });
});

describe("translate", () => {
  it("returns localised text", () => {
    const en = translate("en", "app.title");
    const zh = translate("zh", "app.title");
    expect(en.length).toBeGreaterThan(0);
    expect(zh.length).toBeGreaterThan(0);
  });

  it("falls back to the default locale for unknown locales", () => {
    // @ts-expect-error -- intentionally pass an invalid locale
    const fallback = translate("klingon", "app.title");
    expect(fallback).toBe(translate(DEFAULT_LOCALE, "app.title"));
  });
});

describe("formatMessage", () => {
  it("substitutes named placeholders", () => {
    expect(formatMessage("Hello {name}", { name: "world" })).toBe("Hello world");
  });

  it("leaves placeholders untouched when the variable is missing", () => {
    expect(formatMessage("Hello {name}", {})).toBe("Hello {name}");
  });

  it("supports multiple substitutions", () => {
    expect(formatMessage("{a} and {b}", { a: "x", b: "y" })).toBe("x and y");
  });
});
