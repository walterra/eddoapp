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
 * Extracts plain text from content type match
 */
function extractFromContentMatch(content: string, regex: RegExp, isHtml: boolean): string | null {
  const match = content.match(regex);
  if (!match) return null;
  const decoded = decodeQuotedPrintable(match[1].trim());
  return isHtml ? stripHtml(decoded) : decoded;
}

/**
 * Extracts plain text body from email source
 */
export function extractPlainText(source: Buffer | string): string {
  const content = typeof source === 'string' ? source : source.toString('utf-8');

  // Try to find plain text part in multipart message
  const plainTextRegex =
    /Content-Type:\s*text\/plain[^]*?(?:\r?\n\r?\n)([\s\S]*?)(?=--[^\r\n]+|$)/i;
  const plainResult = extractFromContentMatch(content, plainTextRegex, false);
  if (plainResult) return plainResult;

  // Try to find HTML part and convert
  const htmlRegex = /Content-Type:\s*text\/html[^]*?(?:\r?\n\r?\n)([\s\S]*?)(?=--[^\r\n]+|$)/i;
  const htmlResult = extractFromContentMatch(content, htmlRegex, true);
  if (htmlResult) return htmlResult;

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
