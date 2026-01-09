/**
 * Tests for email-parser utilities
 */
import { describe, expect, it } from 'vitest';

import {
  decodeQuotedPrintable,
  extractEmailBody,
  extractSender,
  htmlToMarkdown,
  truncate,
} from './email-parser.js';

describe('htmlToMarkdown', () => {
  it('converts simple HTML to markdown', () => {
    const html = '<p>Hello <strong>world</strong>!</p>';
    const result = htmlToMarkdown(html);
    expect(result).toBe('Hello **world**!');
  });

  it('preserves links with href', () => {
    const html = '<p>Check out <a href="https://example.com">this link</a>.</p>';
    const result = htmlToMarkdown(html);
    expect(result).toBe('Check out [this link](https://example.com).');
  });

  it('converts unordered lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
    const result = htmlToMarkdown(html);
    // Turndown uses 3 spaces after bullet marker
    expect(result).toContain('-   Item 1');
    expect(result).toContain('-   Item 2');
    expect(result).toContain('-   Item 3');
  });

  it('converts ordered lists', () => {
    const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
    const result = htmlToMarkdown(html);
    // Turndown uses 2 spaces after number marker
    expect(result).toContain('1.  First');
    expect(result).toContain('2.  Second');
    expect(result).toContain('3.  Third');
  });

  it('converts headers', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><p>Content</p>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
    expect(result).toContain('Content');
  });

  it('converts italic text', () => {
    const html = '<p>This is <em>emphasized</em> text.</p>';
    const result = htmlToMarkdown(html);
    expect(result).toBe('This is _emphasized_ text.');
  });

  it('skips images', () => {
    const html = '<p>Text before <img src="image.jpg" alt="test"> text after</p>';
    const result = htmlToMarkdown(html);
    // Image is removed, leaving a double space (acceptable)
    expect(result).toContain('Text before');
    expect(result).toContain('text after');
    expect(result).not.toContain('img');
    expect(result).not.toContain('image.jpg');
  });

  it('removes style tags', () => {
    const html = '<style>.class { color: red; }</style><p>Content</p>';
    const result = htmlToMarkdown(html);
    expect(result).toBe('Content');
    expect(result).not.toContain('color');
  });

  it('removes script tags', () => {
    const html = '<script>alert("hello")</script><p>Content</p>';
    const result = htmlToMarkdown(html);
    expect(result).toBe('Content');
    expect(result).not.toContain('alert');
  });

  it('handles complex email HTML', () => {
    const html = `
      <html>
        <body>
          <p>Hi there,</p>
          <p>Please review the following:</p>
          <ul>
            <li>Task 1 - <a href="https://example.com/1">Link</a></li>
            <li>Task 2 - <strong>Important</strong></li>
          </ul>
          <p>Thanks!</p>
        </body>
      </html>
    `;
    const result = htmlToMarkdown(html);
    expect(result).toContain('Hi there');
    expect(result).toContain('Please review the following');
    expect(result).toContain('[Link](https://example.com/1)');
    expect(result).toContain('**Important**');
    expect(result).toContain('Thanks!');
  });

  it('cleans up excessive blank lines', () => {
    const html = '<p>Line 1</p><br><br><br><br><p>Line 2</p>';
    const result = htmlToMarkdown(html);
    // Should not have more than 2 consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('handles tables by extracting content', () => {
    // Layout tables (common in HTML emails) are converted to plain content
    // This is intentional - email tables are used for layout, not data
    const html = `
      <table>
        <thead>
          <tr><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>A</td><td>1</td></tr>
          <tr><td>B</td><td>2</td></tr>
        </tbody>
      </table>
    `;
    const result = htmlToMarkdown(html);
    expect(result).toContain('Name');
    expect(result).toContain('Value');
    expect(result).toContain('A');
    expect(result).toContain('1');
  });

  it('handles strikethrough (GFM)', () => {
    const html = '<p>This is <del>deleted</del> text.</p>';
    const result = htmlToMarkdown(html);
    // GFM plugin uses single ~ for strikethrough (valid GFM)
    expect(result).toContain('~deleted~');
  });
});

describe('truncate', () => {
  it('returns original text if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('decodeQuotedPrintable', () => {
  it('decodes hex-encoded characters', () => {
    expect(decodeQuotedPrintable('Hello=20World')).toBe('Hello World');
  });

  it('removes soft line breaks', () => {
    expect(decodeQuotedPrintable('Hello=\r\nWorld')).toBe('HelloWorld');
    expect(decodeQuotedPrintable('Hello=\nWorld')).toBe('HelloWorld');
  });

  it('handles UTF-8 encoded characters', () => {
    // UTF-8 é is C3 A9 (two bytes) - should decode correctly
    expect(decodeQuotedPrintable('=C3=A9')).toBe('é');
    // UTF-8 → (arrow) is E2 86 92
    expect(decodeQuotedPrintable('=E2=86=92')).toBe('→');
    // Mixed content
    expect(decodeQuotedPrintable('caf=C3=A9')).toBe('café');
  });
});

describe('extractEmailBody', () => {
  it('extracts plain text from multipart email', () => {
    const email = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is plain text content.
--boundary123
Content-Type: text/html

<p>This is <strong>HTML</strong> content.</p>
--boundary123--`;

    const result = extractEmailBody(email);
    expect(result).toBe('This is plain text content.');
  });

  it('converts HTML to markdown when no plain text and content is substantial', () => {
    // Note: extractEmailBody requires >100 chars of markdown output to use HTML
    // This is because newsletters often have minimal HTML for short content
    const email = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/html

<html><body>
<h1>Welcome to our newsletter</h1>
<p>Hello <strong>world</strong>! This is a longer email with more content.</p>
<p>Here are some <a href="https://example.com">useful links</a> for you.</p>
<ul>
  <li>Item one with details</li>
  <li>Item two with more info</li>
  <li>Item three for completeness</li>
</ul>
</body></html>
--boundary123--`;

    const result = extractEmailBody(email);
    expect(result).toContain('**world**');
    expect(result).toContain('[useful links](https://example.com)');
  });

  it('handles HTML-only email with substantial content', () => {
    const email = `Content-Type: text/html

<html>
<body>
<h1>Important Update</h1>
<p>Check this <a href="https://example.com">link</a> for more information.</p>
<p>We have several updates to share with you today about our services.</p>
<p>Please review the following items carefully before proceeding.</p>
</body>
</html>`;

    const result = extractEmailBody(email);
    expect(result).toContain('[link](https://example.com)');
  });

  it('handles quoted-printable encoded HTML with substantial content', () => {
    const email = `Content-Type: text/html
Content-Transfer-Encoding: quoted-printable

<html><body>
<h1>Newsletter Update</h1>
<p>Hello=20<strong>World</strong>! Welcome to this week's newsletter.</p>
<p>We have lots of exciting news to share with you today.</p>
<p>Read on for all the details about our latest announcements.</p>
</body></html>`;

    const result = extractEmailBody(email);
    expect(result).toContain('**World**');
  });

  it('falls back to plain text for short HTML content', () => {
    const email = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the plain text version with more content.
--boundary123
Content-Type: text/html

<p>Short</p>
--boundary123--`;

    const result = extractEmailBody(email);
    // Should use plain text since HTML is too short
    expect(result).toContain('plain text version');
  });

  it('returns empty string for empty email', () => {
    expect(extractEmailBody('')).toBe('');
  });
});

describe('extractSender', () => {
  it('extracts sender address and name', () => {
    const envelope = {
      from: [{ address: 'test@example.com', name: 'Test User' }],
    };
    const result = extractSender(envelope);
    expect(result).toEqual({
      from: 'test@example.com',
      fromName: 'Test User',
    });
  });

  it('handles missing name', () => {
    const envelope = {
      from: [{ address: 'test@example.com' }],
    };
    const result = extractSender(envelope);
    expect(result).toEqual({
      from: 'test@example.com',
      fromName: undefined,
    });
  });

  it('handles empty from array', () => {
    const envelope = { from: [] };
    const result = extractSender(envelope);
    expect(result).toEqual({
      from: 'unknown@unknown.com',
      fromName: undefined,
    });
  });

  it('handles missing from', () => {
    const envelope = {};
    const result = extractSender(envelope);
    expect(result).toEqual({
      from: 'unknown@unknown.com',
      fromName: undefined,
    });
  });
});
