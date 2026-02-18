// ============================================================================
// Shared download/conversion utilities for Library page
// Used by both DownloadFormatPicker (in-modal) and LibraryView (card menu)
// ============================================================================

import { toast } from "sonner";

/**
 * Fetch file content and download in the specified format.
 * Handles all three formats: markdown (instant), pdf (print), docx (Word HTML).
 */
export async function fetchAndDownload(
  url: string,
  fileName: string,
  format: "markdown" | "pdf" | "docx"
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch file content");
  const content = await res.text();
  const baseName = fileName.replace(/\.[^.]+$/, "");

  if (format === "markdown") {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    triggerDownload(blob, `${baseName}.md`);
  } else if (format === "pdf") {
    await convertToPdf(content, baseName);
  } else {
    await convertToDocx(content, baseName);
  }
}

// ============================================================================
// Client-side conversion: Markdown → PDF
// Uses hidden iframe + window.print() for browser-native PDF
// ============================================================================

export async function convertToPdf(markdownContent: string, baseName: string): Promise<void> {
  const html = markdownToHtml(markdownContent);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "-9999px";
  iframe.style.width = "800px";
  iframe.style.height = "1100px";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${baseName}</title>
      <style>
        @page { margin: 1in; size: letter; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1a1a1a;
          max-width: 700px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 { font-size: 2em; font-weight: 600; margin: 1em 0 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; }
        h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
        p { margin: 0.5em 0; }
        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
        pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
        pre code { background: transparent; padding: 0; }
        blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1em; color: #666; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f4f4f4; font-weight: 600; }
        ul, ol { padding-left: 2em; }
        li { margin: 0.25em 0; }
        a { color: #0066cc; }
        img { max-width: 100%; }
        hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  doc.close();

  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow!.print();
        } catch {
          const w = window.open("", "_blank");
          if (w) {
            w.document.write(doc.documentElement.outerHTML);
            w.document.close();
            w.print();
          }
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 1000);
      }, 300);
    };
    if (doc.readyState === "complete") {
      iframe.onload?.(new Event("load") as unknown as Event);
    }
  });
}

// ============================================================================
// Client-side conversion: Markdown → DOCX
// Uses the HTML-in-DOCX technique (Word reads HTML inside .doc)
// ============================================================================

export async function convertToDocx(markdownContent: string, baseName: string): Promise<void> {
  const html = markdownToHtml(markdownContent);

  const docContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${baseName}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: Calibri, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1a1a1a;
        }
        h1 { font-size: 20pt; font-weight: bold; color: #1a1a1a; margin-top: 12pt; margin-bottom: 6pt; }
        h2 { font-size: 16pt; font-weight: bold; color: #1a1a1a; margin-top: 10pt; margin-bottom: 4pt; }
        h3 { font-size: 13pt; font-weight: bold; color: #1a1a1a; margin-top: 8pt; margin-bottom: 4pt; }
        p { margin: 4pt 0; }
        code { font-family: 'Courier New', monospace; background-color: #f4f4f4; padding: 1pt 3pt; }
        pre { font-family: 'Courier New', monospace; background-color: #f4f4f4; padding: 8pt; border: 1px solid #ddd; }
        pre code { background: transparent; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #bbb; padding: 4pt 8pt; }
        th { background: #e8e8e8; font-weight: bold; }
        blockquote { border-left: 3pt solid #ccc; margin-left: 0; padding-left: 10pt; color: #555; }
        ul, ol { padding-left: 20pt; }
        a { color: #0563C1; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + docContent], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  triggerDownload(blob, `${baseName}.docx`);
}

// ============================================================================
// Simple markdown → HTML converter (no external deps)
// ============================================================================

export function markdownToHtml(md: string): string {
  let html = md;

  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (fenced)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');
  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");
  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Paragraphs
  html = html.replace(/^(?!<[hpuolbdt]|<li|<pre|<hr|<img|<a|<blockquote)(.+)$/gm, "<p>$1</p>");
  // Clean up
  html = html.replace(/\n{3,}/g, "\n\n");

  return html;
}

// ============================================================================
// Utility
// ============================================================================

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
