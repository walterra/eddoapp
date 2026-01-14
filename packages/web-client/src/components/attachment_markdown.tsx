/**
 * Markdown renderer with support for attachment images from the attachments database.
 */
import { type FC, useMemo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AttachmentImage } from './attachment_image';

/** Prefix for attachment URLs in markdown */
const ATTACHMENT_PREFIX = 'attachment:';

/**
 * Custom URL transform that allows attachment: protocol.
 * By default, react-markdown strips non-standard protocols for security.
 */
function urlTransform(url: string): string | null {
  // Allow attachment: protocol
  if (url.startsWith(ATTACHMENT_PREFIX)) {
    return url;
  }
  // Allow standard protocols
  const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  try {
    const parsed = new URL(url, 'http://example.com');
    if (safeProtocols.some((p) => parsed.protocol === p)) {
      return url;
    }
  } catch {
    // Relative URLs are fine
    if (!url.includes(':')) {
      return url;
    }
  }
  return null;
}

/** Props for AttachmentMarkdown component */
export interface AttachmentMarkdownProps {
  /** Markdown content to render */
  children: string;
  /** Todo ID for resolving attachment URLs */
  todoId: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Callback when an image is clicked (for lightbox) */
  onImageClick?: (docId: string) => void;
}

/** Checks if a URL is an attachment reference */
function isAttachmentUrl(url: string | undefined): boolean {
  return url?.startsWith(ATTACHMENT_PREFIX) ?? false;
}

/**
 * Extracts attachment document ID from markdown URL.
 * Input: attachment:desc/filename.png
 * Output: {todoId}/desc/filename.png (full docId)
 */
function getAttachmentDocId(url: string, todoId: string): string {
  const path = url.slice(ATTACHMENT_PREFIX.length);
  return `${todoId}/${path}`;
}

/** Creates markdown components with attachment support */
function createAttachmentComponents(
  todoId: string,
  onImageClick?: (docId: string) => void,
): Partial<Components> {
  return {
    img: ({ src, alt, node }) => {
      // react-markdown may pass src in node.properties for some cases
      const imgSrc = src || (node?.properties?.src as string | undefined);

      if (!isAttachmentUrl(imgSrc)) {
        // Regular external image - only render if we have a valid src
        if (!imgSrc) {
          return <span className="text-red-500">[Invalid image: {alt}]</span>;
        }
        return <img alt={alt ?? ''} className="max-w-full" src={imgSrc} />;
      }

      const docId = getAttachmentDocId(imgSrc!, todoId);
      return (
        <AttachmentImage
          alt={alt ?? docId}
          className="my-2 max-w-full"
          docId={docId}
          onClick={onImageClick ? () => onImageClick(docId) : undefined}
        />
      );
    },
  };
}

/**
 * Renders markdown content with support for attachment images.
 * Attachment URLs use the format: `![alt](attachment:desc/filename.png)`
 * Which resolves to docId: `{todoId}/desc/filename.png`
 *
 * @example
 * <AttachmentMarkdown todoId="2024-01-01T00:00:00.000Z">
 *   ## Description
 *   Here's a screenshot:
 *   ![Screenshot](attachment:desc/screenshot.png)
 * </AttachmentMarkdown>
 */
export const AttachmentMarkdown: FC<AttachmentMarkdownProps> = ({
  children,
  todoId,
  className = '',
  onImageClick,
}) => {
  const components = useMemo(
    () => createAttachmentComponents(todoId, onImageClick),
    [todoId, onImageClick],
  );

  return (
    <div className={className}>
      <Markdown components={components} remarkPlugins={[remarkGfm]} urlTransform={urlTransform}>
        {children}
      </Markdown>
    </div>
  );
};

/**
 * Standard markdown prose classes for consistent styling
 */
export const MARKDOWN_PROSE_CLASSES =
  'prose prose-sm dark:prose-invert prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none';
