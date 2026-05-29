import hljs from "highlight.js/lib/common";
import { marked } from "marked";
import { escapeAttribute, escapeHtml } from "../utils/html";

let markedConfigured = false;

function parseCodeFenceLanguage(lang: string | undefined): string {
  const raw = (lang ?? "").trim().toLowerCase();

  if (!raw) {
    return "";
  }

  const firstToken = raw.split(/\s+/u)[0];
  return firstToken.replace(/[{}]/gu, "");
}

function ensureMarkedConfigured() {
  if (markedConfigured) {
    return;
  }

  marked.use({
    gfm: true,
    breaks: false
  });

  marked.use({
    renderer: {
      code({ text, lang }) {
        const trimmedLang = parseCodeFenceLanguage(lang);

        if (trimmedLang && hljs.getLanguage(trimmedLang)) {
          const highlighted = hljs.highlight(text, { language: trimmedLang, ignoreIllegals: true }).value;
          return `<pre><code class="hljs language-${escapeAttribute(trimmedLang)}">${highlighted}</code></pre>\n`;
        }

        if (trimmedLang) {
          const autoHighlighted = hljs.highlightAuto(text);
          const detectedClass = autoHighlighted.language ? ` language-${escapeAttribute(autoHighlighted.language)}` : "";
          return `<pre><code class="hljs${detectedClass}">${autoHighlighted.value}</code></pre>\n`;
        }

        return `<pre><code>${escapeHtml(text)}</code></pre>\n`;
      }
    }
  });

  markedConfigured = true;
}

export function renderMarkdownToHtml(markdown: string): string {
  ensureMarkedConfigured();
  return marked.parse(markdown, { async: false }) as string;
}
