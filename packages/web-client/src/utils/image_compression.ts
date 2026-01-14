/**
 * Image compression utilities using browser-image-compression
 */
import imageCompression from 'browser-image-compression';

import { MAX_ATTACHMENT_SIZE } from '@eddo/core-shared';

/** Compression options */
export interface CompressionOptions {
  /** Maximum file size in bytes (default: MAX_ATTACHMENT_SIZE) */
  maxSizeMB?: number;
  /** Maximum width/height in pixels (default: 1920) */
  maxWidthOrHeight?: number;
  /** Use web worker for compression (default: true) */
  useWebWorker?: boolean;
}

/** Compression result */
export interface CompressionResult {
  /** Compressed file */
  file: File;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Whether compression was applied */
  wasCompressed: boolean;
}

/** Default compression options */
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeMB: MAX_ATTACHMENT_SIZE / (1024 * 1024),
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

/** Checks if file is a compressible image type */
function isCompressibleImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

/**
 * Compresses an image file if it exceeds the size limit.
 * Only compresses JPEG, PNG, and WebP images.
 * GIFs and PDFs are returned as-is.
 *
 * @param file - File to compress
 * @param options - Compression options
 * @returns Compression result with file and metadata
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxSizeBytes = opts.maxSizeMB * 1024 * 1024;

  // Skip compression for non-image or non-compressible types
  if (!isCompressibleImage(file)) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }

  // Skip if already under size limit
  if (file.size <= maxSizeBytes) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }

  // Compress the image
  const compressedBlob = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB,
    maxWidthOrHeight: opts.maxWidthOrHeight,
    useWebWorker: opts.useWebWorker,
    fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
  });

  // Convert blob back to File with original name
  const compressedFile = new File([compressedBlob], file.name, {
    type: compressedBlob.type,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    wasCompressed: true,
  };
}

/**
 * Compresses multiple image files.
 *
 * @param files - Files to compress
 * @param options - Compression options
 * @returns Array of compression results
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
): Promise<CompressionResult[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}
