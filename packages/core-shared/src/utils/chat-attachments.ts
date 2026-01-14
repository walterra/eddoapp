/**
 * Chat attachment utilities for extracting and managing images from chat messages.
 * Uses content hashing for deduplication across sessions.
 */

import type { ContentBlock, ImageContent } from '../types/chat-messages';

/** Hash algorithm for image deduplication */
const HASH_ALGORITHM = 'SHA-256';

/**
 * Compute SHA-256 hash of base64 image data.
 * Works in both Node.js and browser environments.
 * @param base64Data - Base64 encoded image data
 * @returns Hex string hash
 */
export async function hashImageContent(base64Data: string): Promise<string> {
  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Use SubtleCrypto (available in both browser and Node.js 18+)
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build attachment document ID for a chat image.
 * Uses content hash for deduplication - same image = same doc ID.
 * @param contentHash - SHA-256 hash of image content
 * @returns Document ID in format `chat/{hash}`
 */
export function buildChatImageDocId(contentHash: string): string {
  return `chat/${contentHash}`;
}

/**
 * Build URL for accessing a chat image attachment.
 * @param contentHash - SHA-256 hash of image content
 * @returns URL path for the attachment
 */
export function buildChatImageUrl(contentHash: string): string {
  return `/api/attachments-db/chat/${contentHash}/file`;
}

/**
 * Check if an ImageContent block has base64 data that needs extraction.
 * @param content - Image content block
 * @returns True if image has inline base64 data
 */
export function isBase64Image(content: ImageContent): boolean {
  return content.source.type === 'base64' && typeof content.source.data === 'string';
}

/**
 * Check if an ImageContent block uses URL reference.
 * @param content - Image content block
 * @returns True if image uses URL reference
 */
export function isUrlImage(content: ImageContent): boolean {
  return content.source.type === 'url' && typeof content.source.url === 'string';
}

/**
 * Extract all ImageContent blocks with base64 data from message content.
 * @param content - Array of content blocks
 * @returns Array of ImageContent blocks with base64 data
 */
export function extractBase64Images(content: ContentBlock[]): ImageContent[] {
  return content.filter(
    (block): block is ImageContent =>
      block.type === 'image' && isBase64Image(block as ImageContent),
  );
}

/** Image extraction result with hash for deduplication */
export interface ExtractedImage {
  /** Index in original content array */
  index: number;
  /** SHA-256 hash of image content */
  hash: string;
  /** MIME type of the image */
  mimeType: string;
  /** Base64 encoded image data */
  base64Data: string;
  /** Size in bytes */
  size: number;
}

/**
 * Extract and hash all base64 images from content blocks.
 * @param content - Array of content blocks
 * @returns Array of extracted images with hashes
 */
export async function extractAndHashImages(content: ContentBlock[]): Promise<ExtractedImage[]> {
  const results: ExtractedImage[] = [];

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === 'image' && isBase64Image(block)) {
      const source = block.source as { type: 'base64'; mediaType: string; data: string };
      const hash = await hashImageContent(source.data);
      results.push({
        index: i,
        hash,
        mimeType: source.mediaType,
        base64Data: source.data,
        size: Math.ceil((source.data.length * 3) / 4), // Approximate decoded size
      });
    }
  }

  return results;
}

/**
 * Replace base64 images with URL references in content blocks.
 * @param content - Original content blocks
 * @param imageHashes - Map of content index to hash
 * @returns New content array with URLs instead of base64
 */
export function replaceImagesWithUrls(
  content: ContentBlock[],
  imageHashes: Map<number, string>,
): ContentBlock[] {
  return content.map((block, index) => {
    const hash = imageHashes.get(index);
    if (hash && block.type === 'image') {
      return {
        type: 'image',
        source: {
          type: 'url',
          url: buildChatImageUrl(hash),
        },
      } as ImageContent;
    }
    return block;
  });
}

/** Chat attachment document stored in attachments database */
export interface ChatAttachmentDoc {
  _id: string;
  _rev?: string;
  /** Content hash (SHA-256) */
  contentHash: string;
  /** MIME type */
  contentType: string;
  /** Size in bytes */
  size: number;
  /** Creation timestamp */
  createdAt: string;
  /** Type identifier for chat attachments */
  attachmentType: 'chat-image';
}

/**
 * Create a chat attachment document for storage.
 * @param hash - Content hash
 * @param mimeType - MIME type
 * @param size - Size in bytes
 * @returns Attachment document
 */
export function createChatAttachmentDoc(
  hash: string,
  mimeType: string,
  size: number,
): ChatAttachmentDoc {
  return {
    _id: buildChatImageDocId(hash),
    contentHash: hash,
    contentType: mimeType,
    size,
    createdAt: new Date().toISOString(),
    attachmentType: 'chat-image',
  };
}
