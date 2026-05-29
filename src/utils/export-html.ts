import { escapeHtml } from "./html";

const EXPORT_STYLE = `
  :root {
    color-scheme: light;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #fdf6e3;
    color: #073642;
    font-family: "Avenir Next", "Gill Sans", "Segoe UI", sans-serif;
    line-height: 1.6;
  }

  main {
    max-width: 920px;
    margin: 0 auto;
    padding: 48px 36px 72px;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: #002b36;
    line-height: 1.25;
    margin-top: 1.6em;
    margin-bottom: 0.7em;
  }

  p,
  ul,
  ol,
  blockquote,
  pre,
  table {
    margin-top: 0;
    margin-bottom: 1em;
  }

  pre {
    overflow: auto;
    padding: 14px;
    border-radius: 8px;
    background: #eee8d5;
  }

  code {
    font-family: "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
    font-size: 0.93em;
  }

  :not(pre) > code {
    padding: 0.08em 0.33em;
    border-radius: 5px;
    background: rgba(42, 161, 152, 0.16);
  }

  blockquote {
    padding-left: 1em;
    border-left: 4px solid #b58900;
    color: #586e75;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    padding: 0.45em 0.65em;
    border: 1px solid rgba(101, 123, 131, 0.28);
    text-align: left;
  }
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
${input.bodyHtml}
    </main>
  </body>
</html>
`;
}
