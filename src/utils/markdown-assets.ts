const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\n]+)\)/g;

interface ParsedImageTarget {
  /** Path portion with angle brackets unwrapped. Query/fragment preserved. */
  path: string;
  /** Title portion as written (e.g. `"alt"`), or empty when absent. */
  title: string;
}

/**
 * Splits a Markdown image target — the text inside `(...)` — into its path and
 * optional title. Handles `<...>`-wrapped paths (which may contain spaces) and
 * preserves any query string or fragment on the path so the value stays usable
 * as a real URL.
 */
function parseImageTarget(raw: string): ParsedImageTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<")) {
    const closeIndex = trimmed.indexOf(">");
    if (closeIndex < 0) {
      return null;
    }
    const path = trimmed.slice(1, closeIndex).trim();
    const title = trimmed.slice(closeIndex + 1).trim();
    return path ? { path, title } : null;
  }

  const whitespaceIndex = trimmed.search(/\s/u);
  if (whitespaceIndex < 0) {
    return { path: trimmed, title: "" };
  }

  return {
    path: trimmed.slice(0, whitespaceIndex).trim(),
    title: trimmed.slice(whitespaceIndex).trim()
  };
}

/**
 * Returns the unique image source paths referenced by a Markdown document, with
 * any query string and fragment stripped. Suitable for matching against files
 * already on disk (asset cleanup), where query/fragment are noise.
 */
export function extractMarkdownImageSources(markdown: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const target of iterateImageTargets(markdown)) {
    const source = stripQueryAndFragment(target.path);
    if (!source || seen.has(source)) {
      continue;
    }
    seen.add(source);
    results.push(source);
  }

  return results;
}

/**
 * Returns the unique raw image source paths referenced by a Markdown document,
 * preserving query string and fragment. Suitable for fetching remote URLs,
 * where the query is often required.
 */
export function extractMarkdownImagePaths(markdown: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const target of iterateImageTargets(markdown)) {
    if (seen.has(target.path)) {
      continue;
    }
    seen.add(target.path);
    results.push(target.path);
  }

  return results;
}

/**
 * Rewrites Markdown image targets whose raw path matches a key in `mapping` to
 * the mapped replacement path, preserving alt text and any title. Paths absent
 * from the mapping are left untouched. The replacement is wrapped in `<...>`
 * only when it contains whitespace.
 */
export function replaceMarkdownImageSources(
  markdown: string,
  mapping: Map<string, string> | Record<string, string>
): string {
  const lookup = mapping instanceof Map ? mapping : new Map(Object.entries(mapping));
  if (lookup.size === 0) {
    return markdown;
  }

  return markdown.replaceAll(MARKDOWN_IMAGE_PATTERN, (fullMatch, rawTarget) => {
    const target = parseImageTarget(String(rawTarget ?? ""));
    if (!target) {
      return fullMatch;
    }

    const replacement = lookup.get(target.path);
    if (replacement === undefined) {
      return fullMatch;
    }

    const altText = fullMatch.slice(2, fullMatch.indexOf("]"));
    const safePath = /\s/u.test(replacement) ? `<${replacement}>` : replacement;
    const targetText = target.title ? `${safePath} ${target.title}` : safePath;
    return `![${altText}](${targetText})`;
  });
}

function* iterateImageTargets(markdown: string): Generator<ParsedImageTarget> {
  const pattern = new RegExp(MARKDOWN_IMAGE_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const target = parseImageTarget(match[1] ?? "");
    if (target) {
      yield target;
    }
  }
}

function stripQueryAndFragment(path: string): string {
  const withoutFragment = path.split("#", 1)[0] ?? "";
  const withoutQuery = withoutFragment.split("?", 1)[0] ?? "";
  return withoutQuery.replaceAll("\\", "/").replaceAll(/\/+/g, "/").trim();
}
