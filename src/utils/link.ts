export type LinkAction =
  | { kind: "external"; url: string }
  | { kind: "ignored" };

const EXTERNAL_SCHEMES = ["http:", "https:", "mailto:"] as const;

export function resolveLinkAction(href: string | null | undefined): LinkAction {
  if (!href) {
    return { kind: "ignored" };
  }

  const trimmed = href.trim();
  if (!trimmed) {
    return { kind: "ignored" };
  }

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex <= 0) {
    return { kind: "ignored" };
  }

  const scheme = trimmed.slice(0, colonIndex + 1).toLowerCase();
  if (!EXTERNAL_SCHEMES.includes(scheme as (typeof EXTERNAL_SCHEMES)[number])) {
    return { kind: "ignored" };
  }

  return { kind: "external", url: trimmed };
}
