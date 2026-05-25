export function extractMarkdownImageSources(markdown: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const markdownImagePattern = /!\[[^\]]*]\(([^)\n]+)\)/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = markdownImagePattern.exec(markdown);
    if (!match) {
      break;
    }

    const rawTarget = match[1] ?? "";
    const source = normalizeImageTarget(rawTarget);
    if (!source || seen.has(source)) {
      continue;
    }
    seen.add(source);
    results.push(source);
  }

  return results;
}

function normalizeImageTarget(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const titleSplitIndex = trimmed.search(/\s(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const pathPart = titleSplitIndex >= 0 ? trimmed.slice(0, titleSplitIndex).trim() : trimmed;
  const unwrapped = unwrapAngleBrackets(pathPart);
  const withoutFragment = unwrapped.split("#", 1)[0] ?? "";
  const withoutQuery = withoutFragment.split("?", 1)[0] ?? "";
  const normalized = withoutQuery.replaceAll("\\", "/").replaceAll(/\/+/g, "/").trim();

  return normalized || null;
}

function unwrapAngleBrackets(value: string): string {
  if (value.startsWith("<") && value.endsWith(">") && value.length >= 2) {
    return value.slice(1, -1).trim();
  }
  return value;
}
