/**
 * Message bubble component for chat messages.
 */

import type { ContentBlock, SessionMessageEntry } from '@eddo/core-shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Props for MessageBubble */
export interface MessageBubbleProps {
  entry: SessionMessageEntry;
}

/** Extract text content from a message */
function extractContent(message: SessionMessageEntry['message']): string {
  if (message.role === 'bashExecution') {
    return `\`\`\`\n${message.output}\n\`\`\``;
  }

  const rawContent = message.content;
  if (typeof rawContent === 'string') {
    return rawContent;
  }

  return (rawContent as ContentBlock[])
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

/** Message bubble component */
export function MessageBubble({ entry }: MessageBubbleProps) {
  const { message } = entry;
  const isUser = message.role === 'user';
  const content = extractContent(message);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
