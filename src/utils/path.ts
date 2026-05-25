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

export function isRelativePath(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return false;
  }

  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
}

export function resolveDocumentRelativePath(documentPath: string, relativePath: string): string | null {
  if (!isRelativePath(relativePath)) {
    return null;
  }

  const normalizedDoc = documentPath.replaceAll("\\", "/");
  const normalizedRel = relativePath.trim().replaceAll("\\", "/");
  const slashIndex = normalizedDoc.lastIndexOf("/");

  if (slashIndex < 0) {
    return null;
  }

  const baseDir = normalizedDoc.slice(0, slashIndex);
  const parts = `${baseDir}/${normalizedRel}`.split("/");
  const resolved: string[] = [];
  let prefix = "";

  if (parts.length > 0 && /^[A-Za-z]:$/.test(parts[0])) {
    prefix = parts.shift() ?? "";
  } else if (parts.length > 0 && parts[0] === "") {
    prefix = "/";
    parts.shift();
  }

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (resolved.length > 0) {
        resolved.pop();
      }
      continue;
    }

    resolved.push(part);
  }

  const joined = resolved.join("/");

  if (!joined) {
    return prefix || null;
  }

  if (!prefix) {
    return joined;
  }

  if (prefix === "/") {
    return `/${joined}`;
  }

  return `${prefix}/${joined}`;
}
