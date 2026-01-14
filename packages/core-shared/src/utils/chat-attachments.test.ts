import { describe, expect, it } from 'vitest';

import type { ContentBlock, ImageContent } from '../types/chat-messages';
import {
  buildChatImageDocId,
  buildChatImageUrl,
  createChatAttachmentDoc,
  extractAndHashImages,
  extractBase64Images,
  hashImageContent,
  isBase64Image,
  isUrlImage,
  replaceImagesWithUrls,
} from './chat-attachments';

// Small test image (1x1 red pixel PNG)
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

describe('chat-attachments', () => {
  describe('hashImageContent', () => {
    it('generates consistent hash for same content', async () => {
      const hash1 = await hashImageContent(TEST_IMAGE_BASE64);
      const hash2 = await hashImageContent(TEST_IMAGE_BASE64);
      expect(hash1).toBe(hash2);
    });

    it('generates different hash for different content', async () => {
      const hash1 = await hashImageContent(TEST_IMAGE_BASE64);
      const hash2 = await hashImageContent('YWJjZGVm'); // "abcdef" in base64
      expect(hash1).not.toBe(hash2);
    });

    it('returns hex string', async () => {
      const hash = await hashImageContent(TEST_IMAGE_BASE64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex chars
    });
  });

  describe('buildChatImageDocId', () => {
    it('builds doc ID from hash', () => {
      const docId = buildChatImageDocId('abc123');
      expect(docId).toBe('chat/abc123');
    });
  });

  describe('buildChatImageUrl', () => {
    it('builds URL from hash', () => {
      const url = buildChatImageUrl('abc123');
      expect(url).toBe('/api/attachments-db/chat/abc123/file');
    });
  });

  describe('isBase64Image', () => {
    it('returns true for base64 image', () => {
      const image: ImageContent = {
        type: 'image',
        source: { type: 'base64', mediaType: 'image/png', data: TEST_IMAGE_BASE64 },
      };
      expect(isBase64Image(image)).toBe(true);
    });

    it('returns false for URL image', () => {
      const image: ImageContent = {
        type: 'image',
        source: { type: 'url', url: 'http://example.com/img.png' },
      };
      expect(isBase64Image(image)).toBe(false);
    });
  });

  describe('isUrlImage', () => {
    it('returns true for URL image', () => {
      const image: ImageContent = {
        type: 'image',
        source: { type: 'url', url: 'http://example.com/img.png' },
      };
      expect(isUrlImage(image)).toBe(true);
    });

    it('returns false for base64 image', () => {
      const image: ImageContent = {
        type: 'image',
        source: { type: 'base64', mediaType: 'image/png', data: TEST_IMAGE_BASE64 },
      };
      expect(isUrlImage(image)).toBe(false);
    });
  });

  describe('extractBase64Images', () => {
    it('extracts base64 images from content', () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        {
          type: 'image',
          source: { type: 'base64', mediaType: 'image/png', data: TEST_IMAGE_BASE64 },
        },
        { type: 'text', text: 'World' },
      ];
      const images = extractBase64Images(content);
      expect(images).toHaveLength(1);
      expect(images[0].type).toBe('image');
    });

    it('excludes URL images', () => {
      const content: ContentBlock[] = [
        { type: 'image', source: { type: 'url', url: 'http://example.com/img.png' } },
      ];
      const images = extractBase64Images(content);
      expect(images).toHaveLength(0);
    });
  });

  describe('extractAndHashImages', () => {
    it('extracts and hashes base64 images', async () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        {
          type: 'image',
          source: { type: 'base64', mediaType: 'image/png', data: TEST_IMAGE_BASE64 },
        },
      ];
      const extracted = await extractAndHashImages(content);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].index).toBe(1);
      expect(extracted[0].mimeType).toBe('image/png');
      expect(extracted[0].base64Data).toBe(TEST_IMAGE_BASE64);
      expect(extracted[0].hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('replaceImagesWithUrls', () => {
    it('replaces base64 images with URL references', () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        {
          type: 'image',
          source: { type: 'base64', mediaType: 'image/png', data: TEST_IMAGE_BASE64 },
        },
      ];
      const hashMap = new Map([[1, 'abc123']]);
      const result = replaceImagesWithUrls(content, hashMap);

      expect(result[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(result[1]).toEqual({
        type: 'image',
        source: { type: 'url', url: '/api/attachments-db/chat/abc123/file' },
      });
    });

    it('preserves non-image content', () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'thinking', thinking: 'Let me think...' },
      ];
      const hashMap = new Map<number, string>();
      const result = replaceImagesWithUrls(content, hashMap);

      expect(result).toEqual(content);
    });
  });

  describe('createChatAttachmentDoc', () => {
    it('creates valid attachment document', () => {
      const doc = createChatAttachmentDoc('abc123', 'image/png', 1024);

      expect(doc._id).toBe('chat/abc123');
      expect(doc.contentHash).toBe('abc123');
      expect(doc.contentType).toBe('image/png');
      expect(doc.size).toBe(1024);
      expect(doc.attachmentType).toBe('chat-image');
      expect(doc.createdAt).toBeDefined();
    });
  });
});
