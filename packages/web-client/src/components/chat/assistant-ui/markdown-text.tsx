/**
 * Markdown text renderer for assistant-ui messages.
 */

import { useMessagePartText } from '@assistant-ui/react';
import type { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Markdown text component for message content */
export const MarkdownText: FC = () => {
  const textPart = useMessagePartText();
  const text = typeof textPart === 'string' ? textPart : (textPart?.text ?? '');

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
};
