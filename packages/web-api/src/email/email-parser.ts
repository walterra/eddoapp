/**
 * Email parsing utilities for extracting content from IMAP messages
 */
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Create a singleton turndown instance with GFM support
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// Add GitHub Flavored Markdown support (tables, strikethrough, task lists)
turndownService.use(gfm);

// Custom rule to skip images (they don't render in todo descriptions)
turndownService.addRule('skipImages', {
  filter: 'img',
  replacement: () => '',
});

// Custom rule to handle style/script tags (remove completely)
turndownService.addRule('skipStyleScript', {
  filter: ['style', 'script', 'noscript'],
  replacement: () => '',
});

// Custom rule to handle layout tables (common in HTML emails)
// These tables are used for layout, not data - extract content only
turndownService.addRule('layoutTables', {
  filter: (node) => {
    if (node.nodeName !== 'TABLE') return false;
    // Check if this looks like a layout table (has nested tables, inline styles, etc.)
    const hasNestedTable = node.querySelector('table') !== null;
    const hasLayoutAttrs =
      node.getAttribute('cellpadding') !== null ||
      node.getAttribute('cellspacing') !== null ||
      node.getAttribute('bgcolor') !== null;
    return hasNestedTable || hasLayoutAttrs;
  },
  replacement: (content) => {
    // Just return the content, stripping the table structure
    return content + '\n\n';
  },
});

// Remove table structural elements for layout tables
turndownService.addRule('tableStructure', {
  filter: ['thead', 'tbody', 'tfoot', 'tr'],
  replacement: (content) => content,
});

// Table cells - just extract content
turndownService.addRule('tableCells', {
  filter: ['td', 'th'],
  replacement: (content) => {
    const trimmed = content.trim();
    return trimmed ? trimmed + '\n' : '';
  },
});

/**
 * Converts HTML to Markdown preserving structure
 */
export function htmlToMarkdown(html: string): string {
  try {
    let markdown = turndownService.turndown(html);
    // Clean up whitespace first (lines with only whitespace become empty)
    markdown = markdown.replace(/[ \t]+$/gm, ''); // trailing whitespace
    markdown = markdown.replace(/^[ \t]+/gm, ''); // leading whitespace on lines
    // Now clean up excessive blank lines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    return markdown.trim();
  } catch {
    // Fallback to stripping HTML if turndown fails
    return stripHtmlBasic(html);
  }
}

/**
 * Basic HTML stripping fallback (used when turndown fails)
 */
function stripHtmlBasic(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips HTML tags and converts to plain text safely
 * @deprecated Use htmlToMarkdown() for better formatting preservation
 */
export function stripHtml(html: string): string {
  return stripHtmlBasic(html);
}

/**
 * Truncates text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Decodes quoted-printable encoded text with proper UTF-8 handling
 */
export function decodeQuotedPrintable(text: string): string {
  // First, remove soft line breaks
  const withoutSoftBreaks = text.replace(/=\r?\n/g, '');

  // Convert quoted-printable to bytes, then decode as UTF-8
  // This handles multi-byte UTF-8 characters correctly (e.g., é = C3 A9)
  const bytes: number[] = [];
  let i = 0;

  while (i < withoutSoftBreaks.length) {
    if (withoutSoftBreaks[i] === '=' && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    // Regular character - get its byte value
    bytes.push(withoutSoftBreaks.charCodeAt(i));
    i++;
  }

  // Decode bytes as UTF-8
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    // Fallback: try latin-1 if UTF-8 fails
    return new TextDecoder('iso-8859-1').decode(new Uint8Array(bytes));
  }
}

/**
 * Finds content part by content type using string search (avoids regex backtracking)
 */
function findContentPart(content: string, contentType: string): string | null {
  const lowerContent = content.toLowerCase();
  const marker = `content-type: ${contentType}`;

  let startIdx = lowerContent.indexOf(marker);
  if (startIdx === -1) {
    // Try without space after colon
    startIdx = lowerContent.indexOf(`content-type:${contentType}`);
  }
  if (startIdx === -1) return null;

  // Find the blank line that separates headers from body
  const headerEndPatterns = ['\r\n\r\n', '\n\n'];
  let bodyStart = -1;

  for (const pattern of headerEndPatterns) {
    const idx = content.indexOf(pattern, startIdx);
    if (idx !== -1 && (bodyStart === -1 || idx < bodyStart)) {
      bodyStart = idx + pattern.length;
    }
  }

  if (bodyStart === -1) return null;

  // Find the end boundary (-- followed by boundary string)
  let bodyEnd = content.length;
  const boundaryIdx = content.indexOf('\n--', bodyStart);
  if (boundaryIdx !== -1) {
    bodyEnd = boundaryIdx;
  }

  return content.substring(bodyStart, bodyEnd).trim();
}

/**
 * Extracts email body content, converting HTML to Markdown when present.
 *
 * Strategy:
 * - If HTML is available, convert it to Markdown (preserves links, lists, formatting)
 * - Only fall back to plain text if no HTML is available
 * - This is because many newsletters have minimal plain text versions (just a summary)
 *   while the HTML version contains the full content
 */
export function extractEmailBody(source: Buffer | string): string {
  const content = typeof source === 'string' ? source : source.toString('utf-8');

  // Prefer HTML and convert to Markdown (newsletters often have richer HTML content)
  const htmlPart = findContentPart(content, 'text/html');
  if (htmlPart) {
    const decoded = decodeQuotedPrintable(htmlPart);
    const markdown = htmlToMarkdown(decoded);
    // Only use HTML if it produced meaningful content
    if (markdown.length > 100) {
      return markdown;
    }
  }

  // Fall back to plain text if HTML not available or produced little content
  const plainPart = findContentPart(content, 'text/plain');
  if (plainPart) {
    return decodeQuotedPrintable(plainPart);
  }

  // Last resort: treat entire content as text after headers
  const bodyStart = content.indexOf('\r\n\r\n');
  if (bodyStart > 0) {
    const body = content.substring(bodyStart + 4).trim();
    // Check if it looks like HTML
    if (body.toLowerCase().includes('<html') || body.toLowerCase().includes('<body')) {
      return htmlToMarkdown(body);
    }
    return body;
  }

  return '';
}

/**
 * Extracts plain text body from email source
 * @deprecated Use extractEmailBody() for better Markdown support
 */
export function extractPlainText(source: Buffer | string): string {
  return extractEmailBody(source);
}

/**
 * Extracts sender information from envelope
 */
export function extractSender(envelope: { from?: Array<{ address?: string; name?: string }> }): {
  from: string;
  fromName?: string;
} {
  const sender = envelope.from?.[0];
  return {
    from: sender?.address || 'unknown@unknown.com',
    fromName: sender?.name || undefined,
  };
}
