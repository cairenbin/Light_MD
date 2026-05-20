export function normalizeFileName(fileName: string): string {
  const trimmed = fileName.trim();

  if (!trimmed) {
    return "Untitled.md";
  }

  return /\.(md|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

export function formatPathForDisplay(path: string): string {
  const normalized = path.replaceAll("\\", "/");

  if (normalized.length <= 54) {
    return normalized;
  }

  const head = normalized.slice(0, 24);
  const tail = normalized.slice(-22);
  return `${head} ... ${tail}`;
}

export function documentInitial(name: string): string {
  const trimmed = name.trim();
  const firstCharacter = trimmed.charAt(0).toUpperCase();

  return firstCharacter || "•";
}
