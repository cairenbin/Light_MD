import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let service: TurndownService | null = null;

function getService(): TurndownService {
  if (service) {
    return service;
  }

  const instance = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**"
  });
  instance.use(gfm);
  service = instance;
  return instance;
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) {
    return "";
  }

  return getService().turndown(html).trim();
}
