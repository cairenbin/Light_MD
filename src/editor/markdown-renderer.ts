import hljs from "highlight.js/lib/common";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
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

function isFenceLine(line: string): { marker: "`" | "~"; length: number } | null {
  const match = line.trimStart().match(/^(`{3,}|~{3,})/u);

  if (!match) {
    return null;
  }

  const fence = match[1] ?? "";
  return {
    marker: fence[0] === "~" ? "~" : "`",
    length: fence.length
  };
}

function normalizeDisplayMathBlocks(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let codeFence: { marker: "`" | "~"; length: number } | null = null;
  let inDisplayMath = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const fence = isFenceLine(line);

    if (fence) {
      if (!codeFence) {
        codeFence = fence;
      } else if (fence.marker === codeFence.marker && fence.length >= codeFence.length) {
        codeFence = null;
      }

      output.push(line);
      continue;
    }

    if (!codeFence && trimmed === "$$") {
      if (!inDisplayMath && output.length > 0 && output[output.length - 1]?.trim() !== "") {
        output.push("");
      }

      output.push(line);

      if (inDisplayMath) {
        const nextLine = lines[index + 1];
        if (nextLine !== undefined && nextLine.trim() !== "") {
          output.push("");
        }
      }

      inDisplayMath = !inDisplayMath;
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function ensureMarkedConfigured() {
  if (markedConfigured) {
    return;
  }

  marked.use({
    gfm: true,
    breaks: false
  });

  marked.use(
    markedKatex({
      nonStandard: true,
      throwOnError: false
    })
  );

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
  return marked.parse(normalizeDisplayMathBlocks(markdown), { async: false }) as string;
}
