import {
  buildAlignedTableEdit,
  buildCodeFenceEdit,
  buildDetailsEdit,
  buildFootnoteDefinitionEdit,
  buildFootnoteReferenceEdit,
  buildHeadingEdit,
  buildHtmlCommentEdit,
  buildLineSnippetEdit,
  buildLinkEdit,
  buildMathBlockEdit,
  buildReferenceLinkEdit,
  buildTableEdit,
  buildWrappedEdit
} from "./snippets";
import type { EditorAutocompleteItem, InsertMenuItem } from "../types";

export const editorAutocompleteItems: EditorAutocompleteItem[] = [
  {
    id: "heading-1",
    label: "Heading 1",
    detail: "# Main heading",
    keywords: ["heading", "title", "h1", "#"],
    autoPrefixes: ["#"],
    buildEdit: (context) => buildHeadingEdit(context, 1)
  },
  {
    id: "heading-2",
    label: "Heading 2",
    detail: "## Section heading",
    keywords: ["heading", "section", "h2", "##"],
    autoPrefixes: ["##"],
    buildEdit: (context) => buildHeadingEdit(context, 2)
  },
  {
    id: "heading-3",
    label: "Heading 3",
    detail: "### Subsection heading",
    keywords: ["heading", "subsection", "h3", "###"],
    autoPrefixes: ["###"],
    buildEdit: (context) => buildHeadingEdit(context, 3)
  },
  {
    id: "bullet-list",
    label: "Bullet List",
    detail: "- List item",
    keywords: ["list", "bullet", "unordered", "-"],
    autoPrefixes: ["-", "*", "+"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- List item", /^[-*+]\s*$/)
  },
  {
    id: "task-list",
    label: "Task List",
    detail: "- [ ] Task",
    keywords: ["task", "checkbox", "todo", "- [ ]"],
    autoPrefixes: ["-", "- [", "- []"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- [ ] Task", /^-\s*(\[\]|\[ \])?\s*$/)
  },
  {
    id: "task-list-done",
    label: "Completed Task",
    detail: "- [x] Completed task",
    keywords: ["task", "checkbox", "done", "completed", "- [x]"],
    autoPrefixes: ["- [x]", "- [X]"],
    buildEdit: (context) => buildLineSnippetEdit(context, "- [x] Completed task", /^-\s*\[(x|X)\]\s*$/)
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    detail: "1. List item",
    keywords: ["list", "ordered", "numbered", "1."],
    autoPrefixes: ["1", "1."],
    buildEdit: (context) => buildLineSnippetEdit(context, "1. List item", /^\d+\.?\s*$/)
  },
  {
    id: "blockquote",
    label: "Blockquote",
    detail: "> Quote",
    keywords: ["quote", "blockquote", ">"],
    autoPrefixes: [">"],
    buildEdit: (context) => buildLineSnippetEdit(context, "> Quote", /^>\s*$/)
  },
  {
    id: "horizontal-rule",
    label: "Horizontal Rule",
    detail: "---",
    keywords: ["rule", "separator", "divider", "---"],
    autoPrefixes: ["---", "***", "___"],
    buildEdit: (context) => buildLineSnippetEdit(context, "---", /^(-{3,}|\*{3,}|_{3,})\s*$/)
  },
  {
    id: "code-fence",
    label: "Code Fence",
    detail: "```md fenced code block",
    keywords: ["code", "fence", "snippet", "```"],
    autoPrefixes: ["```", "~~~"],
    buildEdit: (context) => buildCodeFenceEdit(context)
  },
  {
    id: "code-fence-ts",
    label: "Code Fence: TypeScript",
    detail: "```ts",
    keywords: ["code", "fence", "typescript", "ts"],
    autoPrefixes: ["```ts", "~~~ts"],
    buildEdit: (context) => buildCodeFenceEdit(context, "ts")
  },
  {
    id: "code-fence-js",
    label: "Code Fence: JavaScript",
    detail: "```js",
    keywords: ["code", "fence", "javascript", "js"],
    autoPrefixes: ["```js", "~~~js"],
    buildEdit: (context) => buildCodeFenceEdit(context, "js")
  },
  {
    id: "code-fence-bash",
    label: "Code Fence: Bash",
    detail: "```bash",
    keywords: ["code", "fence", "bash", "shell", "sh"],
    autoPrefixes: ["```bash", "~~~bash", "```sh", "~~~sh"],
    buildEdit: (context) => buildCodeFenceEdit(context, "bash")
  },
  {
    id: "code-fence-json",
    label: "Code Fence: JSON",
    detail: "```json",
    keywords: ["code", "fence", "json"],
    autoPrefixes: ["```json", "~~~json"],
    buildEdit: (context) => buildCodeFenceEdit(context, "json")
  },
  {
    id: "code-fence-rust",
    label: "Code Fence: Rust",
    detail: "```rust",
    keywords: ["code", "fence", "rust", "rs"],
    autoPrefixes: ["```rust", "~~~rust", "```rs", "~~~rs"],
    buildEdit: (context) => buildCodeFenceEdit(context, "rust")
  },
  {
    id: "code-fence-python",
    label: "Code Fence: Python",
    detail: "```python",
    keywords: ["code", "fence", "python", "py"],
    autoPrefixes: ["```python", "~~~python", "```py", "~~~py"],
    buildEdit: (context) => buildCodeFenceEdit(context, "python")
  },
  {
    id: "link",
    label: "Link",
    detail: "[label](https://example.com)",
    keywords: ["link", "url", "reference", "["],
    autoPrefixes: ["["],
    buildEdit: (context) => buildLinkEdit(context, false)
  },
  {
    id: "image",
    label: "Image",
    detail: "![alt text](https://example.com/image.png)",
    keywords: ["image", "media", "alt", "!["],
    autoPrefixes: ["!["],
    buildEdit: (context) => buildLinkEdit(context, true)
  },
  {
    id: "reference-link",
    label: "Reference Link",
    detail: "[label][ref] + [ref]: https://example.com",
    keywords: ["reference", "link", "ref", "citation"],
    autoPrefixes: ["[ref]", "[]"],
    buildEdit: (context) => buildReferenceLinkEdit(context)
  },
  {
    id: "footnote-ref",
    label: "Footnote Reference",
    detail: "[^1]",
    keywords: ["footnote", "reference", "[^1]"],
    autoPrefixes: ["[^"],
    buildEdit: (context) => buildFootnoteReferenceEdit(context)
  },
  {
    id: "footnote-def",
    label: "Footnote Definition",
    detail: "[^1]: Footnote text",
    keywords: ["footnote", "definition", "note"],
    autoPrefixes: ["[^1]:", "[^"],
    buildEdit: (context) => buildFootnoteDefinitionEdit(context)
  },
  {
    id: "table",
    label: "Table",
    detail: "| Column | Column |",
    keywords: ["table", "columns", "|"],
    autoPrefixes: ["|"],
    buildEdit: (context) => buildTableEdit(context)
  },
  {
    id: "table-alignment",
    label: "Aligned Table",
    detail: "| :--- | :---: | ---: |",
    keywords: ["table", "align", "columns"],
    autoPrefixes: ["|:"],
    buildEdit: (context) => buildAlignedTableEdit(context)
  },
  {
    id: "bold",
    label: "Bold",
    detail: "**strong text**",
    keywords: ["bold", "strong", "**"],
    autoPrefixes: ["**"],
    buildEdit: (context) => buildWrappedEdit(context, "**", "**", "bold text")
  },
  {
    id: "italic",
    label: "Italic",
    detail: "_emphasis_",
    keywords: ["italic", "emphasis", "_"],
    autoPrefixes: ["_"],
    buildEdit: (context) => buildWrappedEdit(context, "_", "_", "emphasis")
  },
  {
    id: "strikethrough",
    label: "Strikethrough",
    detail: "~~removed text~~",
    keywords: ["strikethrough", "delete", "removed", "~~"],
    autoPrefixes: ["~~"],
    buildEdit: (context) => buildWrappedEdit(context, "~~", "~~", "removed text")
  },
  {
    id: "highlight",
    label: "Highlight",
    detail: "==highlight==",
    keywords: ["highlight", "mark", "=="],
    autoPrefixes: ["=="],
    buildEdit: (context) => buildWrappedEdit(context, "==", "==", "highlight")
  },
  {
    id: "inline-code",
    label: "Inline Code",
    detail: "`inline code`",
    keywords: ["code", "inline", "`"],
    autoPrefixes: ["`"],
    buildEdit: (context) => buildWrappedEdit(context, "`", "`", "code")
  },
  {
    id: "math-inline",
    label: "Inline Math",
    detail: "$E = mc^2$",
    keywords: ["math", "latex", "inline", "$"],
    autoPrefixes: ["$"],
    buildEdit: (context) => buildWrappedEdit(context, "$", "$", "E = mc^2")
  },
  {
    id: "math-block",
    label: "Math Block",
    detail: "$$",
    keywords: ["math", "latex", "block", "$$"],
    autoPrefixes: ["$$"],
    buildEdit: (context) => buildMathBlockEdit(context)
  },
  {
    id: "details",
    label: "Details Block",
    detail: "<details><summary>Summary</summary></details>",
    keywords: ["details", "summary", "fold", "collapse", "html"],
    autoPrefixes: ["<det", "<sum"],
    buildEdit: (context) => buildDetailsEdit(context)
  },
  {
    id: "html-comment",
    label: "HTML Comment",
    detail: "<!-- comment -->",
    keywords: ["comment", "html", "<!--"],
    autoPrefixes: ["<!--"],
    buildEdit: (context) => buildHtmlCommentEdit(context)
  }
];

export const autocompleteItemIds: ReadonlySet<string> = new Set([
  "heading-1",
  "heading-2",
  "heading-3",
  "bullet-list",
  "task-list",
  "task-list-done",
  "numbered-list",
  "blockquote",
  "link",
  "image",
  "bold",
  "italic",
  "strikethrough",
  "inline-code"
]);

export function pickInsertMenuItem(id: string): InsertMenuItem {
  const item = editorAutocompleteItems.find((entry) => entry.id === id);

  if (!item) {
    throw new Error(`Insert menu item was not found: ${id}`);
  }

  return {
    id: item.id,
    label: item.label,
    detail: item.detail,
    buildEdit: item.buildEdit
  };
}

export const insertMenuItems: InsertMenuItem[] = [
  pickInsertMenuItem("horizontal-rule"),
  pickInsertMenuItem("code-fence"),
  pickInsertMenuItem("code-fence-ts"),
  pickInsertMenuItem("code-fence-js"),
  pickInsertMenuItem("code-fence-bash"),
  pickInsertMenuItem("code-fence-json"),
  pickInsertMenuItem("code-fence-rust"),
  pickInsertMenuItem("code-fence-python"),
  pickInsertMenuItem("table"),
  pickInsertMenuItem("table-alignment"),
  pickInsertMenuItem("reference-link"),
  pickInsertMenuItem("details")
];
