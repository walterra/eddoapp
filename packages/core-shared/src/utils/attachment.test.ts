import { describe, expect, it } from 'vitest';

import {
  ALLOWED_ATTACHMENT_TYPES,
  buildAttachmentKey,
  filterAttachmentsByType,
  getAttachmentKeys,
  getAttachmentsForNote,
  isAllowedContentType,
  MAX_ATTACHMENT_SIZE,
  parseAttachmentKey,
  sanitizeFilename,
  validateAttachment,
} from './attachment';

describe('attachment utilities', () => {
  describe('buildAttachmentKey', () => {
    it('builds description attachment key', () => {
      expect(buildAttachmentKey('desc', 'screenshot.png')).toBe('desc/screenshot.png');
    });

    it('builds note attachment key with noteId', () => {
      expect(buildAttachmentKey('note', 'photo.jpg', 'abc-123')).toBe('note/abc-123/photo.jpg');
    });

    it('sanitizes filename with path separators', () => {
      expect(buildAttachmentKey('desc', '../evil/file.png')).toBe('desc/.._evil_file.png');
    });

    it('throws error for missing filename', () => {
      expect(() => buildAttachmentKey('desc', '')).toThrow('Filename is required');
    });

    it('throws error for note type without noteId', () => {
      expect(() => buildAttachmentKey('note', 'file.png')).toThrow(
        'Note ID is required for note attachments',
      );
    });

    it('throws error for invalid type', () => {
      expect(() => buildAttachmentKey('invalid' as 'desc', 'file.png')).toThrow(
        'Invalid attachment type',
      );
    });
  });

  describe('parseAttachmentKey', () => {
    it('parses description attachment key', () => {
      expect(parseAttachmentKey('desc/screenshot.png')).toEqual({
        type: 'desc',
        filename: 'screenshot.png',
      });
    });

    it('parses note attachment key', () => {
      expect(parseAttachmentKey('note/abc-123/photo.jpg')).toEqual({
        type: 'note',
        noteId: 'abc-123',
        filename: 'photo.jpg',
      });
    });

    it('returns null for invalid format', () => {
      expect(parseAttachmentKey('invalid')).toBeNull();
      expect(parseAttachmentKey('desc/')).toBeNull();
      expect(parseAttachmentKey('note/only-two')).toBeNull();
      expect(parseAttachmentKey('')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(parseAttachmentKey(null as unknown as string)).toBeNull();
      expect(parseAttachmentKey(undefined as unknown as string)).toBeNull();
      expect(parseAttachmentKey(123 as unknown as string)).toBeNull();
    });

    it('handles keys with multiple slashes in filename', () => {
      // Only first two/three parts are considered
      expect(parseAttachmentKey('desc/file/with/slashes.png')).toBeNull();
    });
  });

  describe('validateAttachment', () => {
    it('validates valid image attachment', () => {
      expect(validateAttachment(1024, 'image/png')).toEqual({ valid: true });
      expect(validateAttachment(1024, 'image/jpeg')).toEqual({ valid: true });
      expect(validateAttachment(1024, 'image/gif')).toEqual({ valid: true });
      expect(validateAttachment(1024, 'image/webp')).toEqual({ valid: true });
    });

    it('validates valid PDF attachment', () => {
      expect(validateAttachment(1024, 'application/pdf')).toEqual({ valid: true });
    });

    it('rejects files exceeding size limit', () => {
      const result = validateAttachment(MAX_ATTACHMENT_SIZE + 1, 'image/png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB limit');
    });

    it('accepts files at exactly the size limit', () => {
      expect(validateAttachment(MAX_ATTACHMENT_SIZE, 'image/png')).toEqual({ valid: true });
    });

    it('rejects disallowed content types', () => {
      const result = validateAttachment(1024, 'application/zip');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Content type not allowed');
    });

    it('rejects invalid size values', () => {
      expect(validateAttachment(0, 'image/png').valid).toBe(false);
      expect(validateAttachment(-1, 'image/png').valid).toBe(false);
      expect(validateAttachment(NaN, 'image/png').valid).toBe(false);
    });

    it('rejects missing content type', () => {
      expect(validateAttachment(1024, '').valid).toBe(false);
      expect(validateAttachment(1024, null as unknown as string).valid).toBe(false);
    });
  });

  describe('isAllowedContentType', () => {
    it('returns true for allowed types', () => {
      for (const type of ALLOWED_ATTACHMENT_TYPES) {
        expect(isAllowedContentType(type)).toBe(true);
      }
    });

    it('returns false for disallowed types', () => {
      expect(isAllowedContentType('application/zip')).toBe(false);
      expect(isAllowedContentType('text/html')).toBe(false);
      expect(isAllowedContentType('video/mp4')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('replaces forward slashes', () => {
      expect(sanitizeFilename('path/to/file.png')).toBe('path_to_file.png');
    });

    it('replaces backslashes', () => {
      expect(sanitizeFilename('path\\to\\file.png')).toBe('path_to_file.png');
    });

    it('removes null bytes', () => {
      expect(sanitizeFilename('file\0name.png')).toBe('filename.png');
    });

    it('trims whitespace', () => {
      expect(sanitizeFilename('  file.png  ')).toBe('file.png');
    });

    it('handles combined issues', () => {
      expect(sanitizeFilename('  ../\0evil\\file.png  ')).toBe('.._evil_file.png');
    });
  });

  describe('getAttachmentKeys', () => {
    it('returns keys from attachments object', () => {
      const attachments = {
        'desc/file1.png': { content_type: 'image/png' },
        'note/abc/file2.jpg': { content_type: 'image/jpeg' },
      };
      expect(getAttachmentKeys(attachments)).toEqual(['desc/file1.png', 'note/abc/file2.jpg']);
    });

    it('returns empty array for undefined', () => {
      expect(getAttachmentKeys(undefined)).toEqual([]);
    });

    it('returns empty array for null', () => {
      expect(getAttachmentKeys(null as unknown as undefined)).toEqual([]);
    });

    it('returns empty array for non-object', () => {
      expect(getAttachmentKeys('string' as unknown as undefined)).toEqual([]);
    });
  });

  describe('filterAttachmentsByType', () => {
    const keys = ['desc/file1.png', 'desc/file2.png', 'note/abc/file3.jpg', 'note/xyz/file4.gif'];

    it('filters description attachments', () => {
      expect(filterAttachmentsByType(keys, 'desc')).toEqual(['desc/file1.png', 'desc/file2.png']);
    });

    it('filters note attachments', () => {
      expect(filterAttachmentsByType(keys, 'note')).toEqual([
        'note/abc/file3.jpg',
        'note/xyz/file4.gif',
      ]);
    });

    it('returns empty array when no matches', () => {
      expect(filterAttachmentsByType(['invalid/key'], 'desc')).toEqual([]);
    });
  });

  describe('getAttachmentsForNote', () => {
    const keys = [
      'desc/file1.png',
      'note/abc/file2.jpg',
      'note/abc/file3.gif',
      'note/xyz/file4.png',
    ];

    it('returns attachments for specific note', () => {
      expect(getAttachmentsForNote(keys, 'abc')).toEqual([
        'note/abc/file2.jpg',
        'note/abc/file3.gif',
      ]);
    });

    it('returns empty array when no matches', () => {
      expect(getAttachmentsForNote(keys, 'nonexistent')).toEqual([]);
    });

    it('excludes description attachments', () => {
      expect(getAttachmentsForNote(keys, 'desc')).toEqual([]);
    });
  });

  describe('constants', () => {
    it('MAX_ATTACHMENT_SIZE is 5MB', () => {
      expect(MAX_ATTACHMENT_SIZE).toBe(5 * 1024 * 1024);
    });

    it('ALLOWED_ATTACHMENT_TYPES contains expected types', () => {
      expect(ALLOWED_ATTACHMENT_TYPES).toContain('image/jpeg');
      expect(ALLOWED_ATTACHMENT_TYPES).toContain('image/png');
      expect(ALLOWED_ATTACHMENT_TYPES).toContain('image/gif');
      expect(ALLOWED_ATTACHMENT_TYPES).toContain('image/webp');
      expect(ALLOWED_ATTACHMENT_TYPES).toContain('application/pdf');
    });
  });
});
