import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { EXPORT_MARKDOWN_STYLE } from "./export-html";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CONTENT_WIDTH_PX = 794;
const PDF_MARGIN_MM = 10;
const MIN_PAGE_FILL_RATIO = 0.55;
const MIN_SLICE_PX = 120;
const PDF_BLOCK_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "table",
  "figure",
  "img",
  "hr",
  "li"
].join(",");

export function toPdfExportFileName(fileName: string): string {
  const normalized = fileName.trim() || "Untitled";
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${normalized}.pdf`;
  }

  return `${normalized.slice(0, dotIndex)}.pdf`;
}

export async function renderHtmlToPdfBytes(input: { title: string; bodyHtml: string }): Promise<Uint8Array> {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-export-pdf-root", "true");
  wrapper.style.position = "absolute";
  wrapper.style.left = "0";
  wrapper.style.top = `${window.innerHeight + 120}px`;
  wrapper.style.width = `${CONTENT_WIDTH_PX}px`;
  wrapper.style.background = "#fff";
  wrapper.style.color = "#111";
  wrapper.style.padding = "24px 28px 40px";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.fontFamily = '"Avenir Next", "Gill Sans", "Segoe UI", sans-serif';
  wrapper.style.lineHeight = "1.62";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "1";
  wrapper.style.zIndex = "-1";

  wrapper.innerHTML = `
    <style>
      ${EXPORT_MARKDOWN_STYLE}

      [data-export-pdf-root] .markdown-body {
        font-size: 17px;
      }

      [data-export-pdf-root] img {
        display: block;
        max-width: 100%;
        max-height: 1080px;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      [data-export-pdf-root] pre,
      [data-export-pdf-root] table {
        overflow: hidden;
      }
    </style>
    <article class="markdown-body">
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">${escapeForText(input.title)}</h1>
      ${input.bodyHtml}
    </article>
  `;
  document.body.appendChild(wrapper);

  try {
    const images = Array.from(wrapper.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(images.map(waitImageLoaded));
    await nextFrame();
    await nextFrame();

    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const availableWidthMm = A4_WIDTH_MM - PDF_MARGIN_MM * 2;
    const availableHeightMm = A4_HEIGHT_MM - PDF_MARGIN_MM * 2;
    const pixelsPerMm = canvas.width / availableWidthMm;
    const pageHeightPx = Math.floor(availableHeightMm * pixelsPerMm);
    const blockBreakpoints = collectBreakpoints(wrapper, canvas.width / Math.max(1, wrapper.getBoundingClientRect().width));

    const pageCanvas = document.createElement("canvas");
    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) {
      throw new Error("Could not create canvas context.");
    }

    let currentY = 0;
    let pageIndex = 0;

    while (currentY < canvas.height) {
      const nextY = chooseNextPageBreak({
        currentY,
        pageHeightPx,
        canvasHeight: canvas.height,
        breakpoints: blockBreakpoints
      });

      const sliceHeight = Math.max(1, nextY - currentY);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        currentY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imageData = pageCanvas.toDataURL("image/png");
      const imageHeightMm = sliceHeight / pixelsPerMm;

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imageData, "PNG", PDF_MARGIN_MM, PDF_MARGIN_MM, availableWidthMm, imageHeightMm, undefined, "FAST");
      currentY = nextY;
      pageIndex += 1;
    }

    return new Uint8Array(pdf.output("arraybuffer"));
  } finally {
    wrapper.remove();
  }
}

function collectBreakpoints(root: HTMLElement, canvasScale: number): number[] {
  const rootRect = root.getBoundingClientRect();
  const points = new Set<number>();
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(PDF_BLOCK_SELECTOR))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const top = Math.max(0, rect.top - rootRect.top);
      const bottom = Math.max(top, rect.bottom - rootRect.top);
      return {
        tagName: element.tagName.toLowerCase(),
        top,
        bottom
      };
    })
    .filter((block) => block.bottom - block.top >= 2)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const previous = index > 0 ? blocks[index - 1] : null;
    const isHeading = /^h[1-6]$/u.test(block.tagName);
    const followsHeading = previous ? /^h[1-6]$/u.test(previous.tagName) : false;

    // Keep-With-Next: do not break between heading and the next block.
    if (!followsHeading) {
      points.add(Math.round(block.top * canvasScale));
    }

    // Avoid breaking right after headings.
    if (!isHeading) {
      points.add(Math.round(block.bottom * canvasScale));
    }
  }

  return Array.from(points).sort((a, b) => a - b);
}

function chooseNextPageBreak(input: {
  currentY: number;
  pageHeightPx: number;
  canvasHeight: number;
  breakpoints: number[];
}): number {
  const { currentY, pageHeightPx, canvasHeight, breakpoints } = input;
  const target = Math.min(canvasHeight, currentY + pageHeightPx);
  const remaining = canvasHeight - currentY;

  if (remaining <= pageHeightPx) {
    return canvasHeight;
  }

  const minBreak = currentY + Math.max(MIN_SLICE_PX, Math.floor(pageHeightPx * MIN_PAGE_FILL_RATIO));
  let selected = -1;

  for (const point of breakpoints) {
    if (point < minBreak) {
      continue;
    }
    if (point > target) {
      break;
    }
    selected = point;
  }

  if (selected > currentY) {
    return selected;
  }

  return target;
}

function waitImageLoaded(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => {
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
      resolve();
    };
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function escapeForText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
