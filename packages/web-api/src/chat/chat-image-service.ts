/**
 * Chat image service for extracting and storing images from chat messages.
 * Uses content hashing for deduplication across sessions.
 */

import {
  buildChatImageDocId,
  createChatAttachmentDoc,
  extractAndHashImages,
  replaceImagesWithUrls,
  type ChatAttachmentDoc,
  type ContentBlock,
  type ExtractedImage,
} from '@eddo/core-shared';
import type { DocumentScope } from 'nano';

import { logger } from '../utils/logger';

/** Result of processing images in a session entry */
export interface ProcessImagesResult {
  /** Updated content with URLs instead of base64 */
  content: ContentBlock[];
  /** Number of images extracted */
  extractedCount: number;
  /** Number of images that were deduplicated (already existed) */
  deduplicatedCount: number;
  /** Hashes of all processed images */
  imageHashes: string[];
}

/** Store a single image as an attachment, with deduplication */
async function storeImageAttachment(
  db: DocumentScope<ChatAttachmentDoc>,
  image: ExtractedImage,
): Promise<{ stored: boolean; deduplicated: boolean }> {
  const docId = buildChatImageDocId(image.hash);

  try {
    // Check if document already exists (deduplication)
    await db.get(docId);
    logger.debug({ hash: image.hash }, 'Image already exists, skipping (deduplicated)');
    return { stored: false, deduplicated: true };
  } catch (error: unknown) {
    // Document doesn't exist, create it
    if ((error as { statusCode?: number }).statusCode !== 404) {
      throw error;
    }
  }

  // Create the attachment document
  const doc = createChatAttachmentDoc(image.hash, image.mimeType, image.size);

  try {
    const result = await db.insert(doc);

    // Add the binary attachment
    const buffer = Buffer.from(image.base64Data, 'base64');
    await db.attachment.insert(docId, 'file', buffer, image.mimeType, { rev: result.rev });

    logger.debug({ hash: image.hash, size: image.size }, 'Stored new image attachment');
    return { stored: true, deduplicated: false };
  } catch (error: unknown) {
    // Handle race condition - another request may have created the doc
    if ((error as { statusCode?: number }).statusCode === 409) {
      logger.debug({ hash: image.hash }, 'Image created by another request (race condition)');
      return { stored: false, deduplicated: true };
    }
    throw error;
  }
}

/**
 * Process all images in content blocks: extract, store, and replace with URLs.
 * @param content - Original content blocks
 * @param db - Attachments database
 * @returns Result with updated content and statistics
 */
export async function processContentImages(
  content: ContentBlock[],
  db: DocumentScope<ChatAttachmentDoc>,
): Promise<ProcessImagesResult> {
  // Extract and hash all base64 images
  const images = await extractAndHashImages(content);

  if (images.length === 0) {
    return {
      content,
      extractedCount: 0,
      deduplicatedCount: 0,
      imageHashes: [],
    };
  }

  let deduplicatedCount = 0;
  const imageHashes: string[] = [];

  // Store each image (with deduplication)
  for (const image of images) {
    const result = await storeImageAttachment(db, image);
    if (result.deduplicated) {
      deduplicatedCount++;
    }
    imageHashes.push(image.hash);
  }

  // Build hash map for URL replacement
  const hashMap = new Map(images.map((img) => [img.index, img.hash]));

  // Replace base64 with URLs
  const updatedContent = replaceImagesWithUrls(content, hashMap);

  logger.info(
    { extracted: images.length, deduplicated: deduplicatedCount },
    'Processed chat images',
  );

  return {
    content: updatedContent,
    extractedCount: images.length,
    deduplicatedCount,
    imageHashes,
  };
}

/**
 * Migrate base64 images to URL references in existing content.
 * Called on read to lazily migrate old entries.
 * @param content - Content blocks that may contain base64 images
 * @param db - Attachments database
 * @returns Updated content with URLs, or original if no migration needed
 */
export async function migrateContentImages(
  content: ContentBlock[],
  db: DocumentScope<ChatAttachmentDoc>,
): Promise<{ content: ContentBlock[]; migrated: boolean }> {
  const images = await extractAndHashImages(content);

  if (images.length === 0) {
    return { content, migrated: false };
  }

  logger.info({ count: images.length }, 'Migrating base64 images to attachments');

  // Store all images
  for (const image of images) {
    await storeImageAttachment(db, image);
  }

  // Replace with URLs
  const hashMap = new Map(images.map((img) => [img.index, img.hash]));
  const updatedContent = replaceImagesWithUrls(content, hashMap);

  return { content: updatedContent, migrated: true };
}

export type ChatImageService = {
  processContentImages: typeof processContentImages;
  migrateContentImages: typeof migrateContentImages;
};

/** Create a chat image service instance */
export function createChatImageService(): ChatImageService {
  return {
    processContentImages,
    migrateContentImages,
  };
}
