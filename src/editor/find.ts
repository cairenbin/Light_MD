import { MAX_FIND_MATCHES } from "../constants";

export type FindMatch = { start: number; end: number };

export type FindOptions = {
  query: string;
  matchCase: boolean;
  matchWholeWord: boolean;
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

export function getFindMatches(source: string, options: FindOptions): FindMatch[] {
  if (!options.query) {
    return [];
  }

  const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = options.matchCase ? "g" : "gi";
  const pattern = new RegExp(escaped, flags);
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
