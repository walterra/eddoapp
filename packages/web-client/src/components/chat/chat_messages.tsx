/**
 * Chat messages list component.
 */

import type { SessionMessageEntry } from '@eddo/core-shared';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { MessageBubble } from './message_bubble';

/** Props for ChatMessages */
export interface ChatMessagesProps {
  entries: SessionMessageEntry[];
  streamingText: string;
}

/** Chat messages component */
export function ChatMessages({ entries, streamingText }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, streamingText]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {entries.map((entry) => (
          <MessageBubble entry={entry} key={entry.id} />
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-700">
              <div className="prose prose-sm dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
