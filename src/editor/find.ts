import { MAX_FIND_MATCHES } from "../constants";

export type FindMatch = { start: number; end: number };

export type FindOptions = {
  query: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  matchRegex: boolean;
};

export function isWholeWordMatch(source: string, start: number, length: number): boolean {
  const before = start > 0 ? source[start - 1] : "";
  const after = start + length < source.length ? source[start + length] : "";
  const wordPattern = /[\p{L}\p{N}_]/u;

  if (before && wordPattern.test(before)) {
    return false;
  }

  if (after && wordPattern.test(after)) {
    return false;
  }

  return true;
}

function compileFindPattern(options: FindOptions): RegExp | null {
  const source = options.matchRegex
    ? options.query
    : options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = options.matchCase ? "g" : "gi";

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

export function isValidFindQuery(options: FindOptions): boolean {
  if (!options.query) {
    return true;
  }
  return compileFindPattern(options) !== null;
}

export function getFindMatches(source: string, options: FindOptions): FindMatch[] {
  if (!options.query) {
    return [];
  }

  const pattern = compileFindPattern(options);

  if (!pattern) {
    return [];
  }

  const matches: FindMatch[] = [];
  let result: RegExpExecArray | null;

  while ((result = pattern.exec(source)) !== null) {
    const start = result.index;
    const end = start + result[0].length;

    if (result[0].length === 0) {
      pattern.lastIndex = start + 1;
      continue;
    }

    if (options.matchWholeWord && !isWholeWordMatch(source, start, result[0].length)) {
      continue;
    }

    matches.push({ start, end });

    if (matches.length >= MAX_FIND_MATCHES) {
      break;
    }
  }

  return matches;
}
