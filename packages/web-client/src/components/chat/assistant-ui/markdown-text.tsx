/**
 * Markdown text renderer for assistant-ui messages.
 */

import { useMessagePartText } from '@assistant-ui/react';
import type { AnchorHTMLAttributes, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Custom link component that opens in new tab */
function ExternalLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" {...props}>
      {children}
    </a>
  );
}

/** Markdown text component for message content */
export const MarkdownText: FC = () => {
  const textPart = useMessagePartText();
  const text = typeof textPart === 'string' ? textPart : (textPart?.text ?? '');

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown components={{ a: ExternalLink }} remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
};
