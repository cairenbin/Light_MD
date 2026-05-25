import { normalizeFileName } from "./path";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/avif": "avif"
};

export interface ImageSavePlan {
  fileName: string;
  markdownPath: string;
}

function sanitizeSegment(value: string): string {
  const collapsed = value
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, "-")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return collapsed || "image";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function extFromMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }

  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? null;
}

function extFromPath(path: string): string | null {
  const normalized = path.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? normalized;
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }

  const ext = fileName.slice(dotIndex + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : null;
}

export function isImagePath(path: string): boolean {
  return extFromPath(path) !== null;
}

export function buildImageSavePlan(input: {
  markdownPath: string;
  sourceName?: string | null;
  mimeType?: string | null;
  date?: Date;
}): ImageSavePlan {
  const markdownPath = input.markdownPath.trim();
  const extFromSource = input.sourceName ? extFromPath(input.sourceName) : null;
  const ext = extFromSource ?? extFromMime(input.mimeType) ?? "png";
  const date = input.date ?? new Date();
  const normalizedDocName = normalizeFileName(markdownPath.replaceAll("\\", "/").split("/").pop() ?? "Untitled.md");
  const docBase = normalizedDocName.replace(/\.(md|markdown|txt)$/i, "");
  const fileName = `${sanitizeSegment(docBase)}-${formatTimestamp(date)}.${ext}`;

  return {
    fileName,
    markdownPath
  };
}

export function buildMarkdownImageLink(relativeAssetPath: string, altText = "image"): string {
  const normalizedPath = relativeAssetPath.replaceAll("\\", "/");
  const safeAlt = sanitizeSegment(altText).replaceAll("-", " ");
  return `![${safeAlt}](${normalizedPath})`;
}
