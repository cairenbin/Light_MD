import katexStyle from "katex/dist/katex.min.css?raw";
import { escapeHtml } from "./html";

export const EXPORT_KATEX_STYLE = katexStyle.replace(/@font-face\{[^}]+\}/gu, "");

export const EXPORT_MARKDOWN_STYLE = `
  ${EXPORT_KATEX_STYLE}

  .markdown-body {
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
  }

  .markdown-body > *:first-child {
    margin-top: 0;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {
    color: #000;
    line-height: 1.25;
    margin-top: 1.6em;
    margin-bottom: 0.7em;
  }

  .markdown-body h1 {
    font-size: 2.05em;
  }

  .markdown-body h2 {
    font-size: 1.45em;
  }

  .markdown-body h3 {
    font-size: 1.25em;
  }

  .markdown-body p,
  .markdown-body ul,
  .markdown-body ol,
  .markdown-body blockquote,
  .markdown-body pre,
  .markdown-body table {
    margin-top: 0;
    margin-bottom: 1em;
  }

  .markdown-body a {
    color: #000;
    text-decoration: none;
    border-bottom: 1px solid #000;
  }

  .markdown-body a:hover {
    opacity: 0.8;
  }

  .markdown-body blockquote {
    padding-left: 1em;
    border-left: 3px solid #000;
    color: #111;
  }

  .markdown-body code {
    font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
    font-size: 0.93em;
  }

  .markdown-body :not(pre) > code {
    padding: 0.08em 0.33em;
    border: 1px solid #cfcfcf;
    border-radius: 4px;
    background: #f6f6f6;
  }

  .markdown-body pre {
    overflow: hidden;
    padding: 14px;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    background: #f8f8f8;
  }

  .markdown-body pre code {
    background: transparent;
    padding: 0;
  }

  .markdown-body .hljs {
    display: block;
    color: #111;
    background: transparent;
  }

  .markdown-body .hljs-comment,
  .markdown-body .hljs-quote { color: #555; font-style: italic; }
  .markdown-body .hljs-keyword,
  .markdown-body .hljs-selector-tag,
  .markdown-body .hljs-meta,
  .markdown-body .hljs-string,
  .markdown-body .hljs-regexp,
  .markdown-body .hljs-attr,
  .markdown-body .hljs-number,
  .markdown-body .hljs-literal,
  .markdown-body .hljs-built_in,
  .markdown-body .hljs-title,
  .markdown-body .hljs-name,
  .markdown-body .hljs-section,
  .markdown-body .hljs-selector-id,
  .markdown-body .hljs-type,
  .markdown-body .hljs-class .hljs-title,
  .markdown-body .hljs-variable,
  .markdown-body .hljs-params,
  .markdown-body .hljs-template-variable,
  .markdown-body .hljs-tag,
  .markdown-body .hljs-symbol,
  .markdown-body .hljs-bullet { color: #111; }
  .markdown-body .hljs-emphasis { font-style: italic; }
  .markdown-body .hljs-strong { font-weight: 700; }
  .markdown-body .hljs-deletion,
  .markdown-body .hljs-addition { color: #111; }

  .markdown-body table {
    border-collapse: collapse;
    width: 100%;
  }

  .markdown-body th,
  .markdown-body td {
    padding: 0.45em 0.65em;
    border: 1px solid #c8c8c8;
    text-align: left;
  }

  .markdown-body img {
    max-width: 100%;
    height: auto;
  }

  .markdown-body .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.2em 0;
  }

  .markdown-body .katex-error {
    color: #9f1d1d;
  }
`;

const EXPORT_STYLE = `
  :root {
    color-scheme: light;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
  }

  main {
    max-width: 920px;
    margin: 0 auto;
    padding: 48px 36px 72px;
  }

  ${EXPORT_MARKDOWN_STYLE}
`;

export function toHtmlExportFileName(fileName: string): string {
  const normalized = fileName.trim() || "Untitled";
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${normalized}.html`;
  }

  return `${normalized.slice(0, dotIndex)}.html`;
}

export function buildExportHtmlDocument(input: { title: string; bodyHtml: string }): string {
  const title = escapeHtml(input.title.trim() || "Untitled");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${EXPORT_STYLE}</style>
  </head>
  <body>
    <main>
      <article class="markdown-body">
${input.bodyHtml}
      </article>
    </main>
  </body>
</html>
`;
}
