/**
 * Email parsing utilities for extracting content from IMAP messages
 */
import { convert } from 'html-to-text';

/**
 * Strips HTML tags and converts to plain text safely
 */
export function stripHtml(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
    ],
  })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Decodes quoted-printable encoded text
 */
export function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
 * Extracts plain text body from email source
 */
export function extractPlainText(source: Buffer | string): string {
  const content = typeof source === 'string' ? source : source.toString('utf-8');

  // Try to find plain text part in multipart message
  const plainPart = findContentPart(content, 'text/plain');
  if (plainPart) {
    return decodeQuotedPrintable(plainPart);
  }

  // Try to find HTML part and convert
  const htmlPart = findContentPart(content, 'text/html');
  if (htmlPart) {
    return stripHtml(decodeQuotedPrintable(htmlPart));
  }

  // Fallback: treat entire content as text after headers
  const bodyStart = content.indexOf('\r\n\r\n');
  if (bodyStart > 0) {
    return stripHtml(content.substring(bodyStart + 4).trim());
  }

  return '';
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
