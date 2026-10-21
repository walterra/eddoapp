import { describe, expect, it } from 'vitest';
import { formatTelegramText, telegramChunkEntities } from './telegram_format.js';

describe('Telegram Markdown rendering', () => {
  it('renders emphasis and descriptive links with UTF-16 offsets', () => {
    const result = formatTelegramText('😀 **Bold** and _italic_ [docs](https://example.com)');
    expect(result.text).toBe('😀 Bold and italic docs');
    expect(result.entities).toEqual([
      { type: 'bold', offset: 3, length: 4 },
      { type: 'italic', offset: 12, length: 6 },
      { type: 'text_link', offset: 19, length: 4, url: 'https://example.com' },
    ]);
  });

  it('renders fenced and inline code without parsing their Markdown contents', () => {
    const result = formatTelegramText(
      'Use `**literal**`.\n\n```typescript\nconst x = "<tag>";\n```',
    );
    expect(result.text).toBe('Use **literal**.\n\nconst x = "<tag>";');
    expect(result.entities).toEqual([
      { type: 'code', offset: 4, length: 11 },
      { type: 'pre', language: 'typescript', offset: 18, length: 18 },
    ]);
  });

  it('preserves significant trailing whitespace inside code blocks', () => {
    const result = formatTelegramText('```text\nx  \n```');
    expect(result.text).toBe('x  ');
    expect(result.entities).toEqual([{ type: 'pre', language: 'text', offset: 0, length: 3 }]);
  });

  it('renders headings, ordered lists, bullets, and block quotes', () => {
    const result = formatTelegramText('# Tasks\n\n1. **First**\n2. Second\n\n- Third\n\n> Quote');
    expect(result.text).toBe('Tasks\n\n1. First\n2. Second\n\n• Third\n\nQuote');
    expect(result.entities).toContainEqual({ type: 'bold', offset: 0, length: 5 });
    expect(result.entities).toContainEqual({ type: 'bold', offset: 10, length: 5 });
    expect(result.entities).toContainEqual({
      type: 'blockquote',
      offset: result.text.indexOf('Quote'),
      length: 5,
    });
  });

  it('keeps raw HTML literal and drops unsafe link formatting', () => {
    const result = formatTelegramText('<b>Literal</b> [unsafe](javascript:alert)');
    expect(result.text).toBe('<b>Literal</b> unsafe');
    expect(result.entities).toEqual([]);
  });

  it('resolves reference links and preserves unmatched Markdown as text', () => {
    expect(formatTelegramText('[Docs][ref]\n\n[ref]: https://example.com').entities).toEqual([
      { type: 'text_link', url: 'https://example.com', offset: 0, length: 4 },
    ]);
    expect(formatTelegramText('Unmatched **bold and `code').text).toBe(
      'Unmatched **bold and `code',
    );
  });

  it('excludes code spans from enclosing emphasis entities', () => {
    const result = formatTelegramText('**Before `code` after**');
    expect(result.entities).toEqual([
      { type: 'bold', offset: 0, length: 7 },
      { type: 'code', offset: 7, length: 4 },
      { type: 'bold', offset: 11, length: 6 },
    ]);
  });

  it('clips entities across chunk boundaries without dropping their links or language', () => {
    const entities = [
      { type: 'text_link' as const, offset: 3990, length: 20, url: 'https://example.com' },
      { type: 'pre' as const, offset: 4010, length: 5000, language: 'typescript' },
    ];
    expect(telegramChunkEntities(entities, 4000, 4000)).toEqual([
      { type: 'text_link', offset: 0, length: 10, url: 'https://example.com' },
      { type: 'pre', offset: 10, length: 3990, language: 'typescript' },
    ]);
    expect(telegramChunkEntities(entities, 0, 100)).toEqual([]);
  });

  it('does not turn empty output or unsupported markup into an empty reply', () => {
    expect(formatTelegramText('')).toEqual({ text: '', entities: [] });
    expect(formatTelegramText('---').text).toBe('—');
    expect(formatTelegramText('![Diagram](https://example.com/image.png)').text).toBe('Diagram');
  });
});
