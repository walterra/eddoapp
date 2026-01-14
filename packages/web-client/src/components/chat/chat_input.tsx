/**
 * Chat input component with send/stop buttons.
 */

import { useState } from 'react';

/** Props for ChatInput */
export interface ChatInputProps {
  isStreaming: boolean;
  onAbort: () => void;
  onSend: (message: string) => void;
}

/** Chat input component */
export function ChatInput({ isStreaming, onAbort, onSend }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 dark:border-gray-700">
      <div className="mx-auto flex max-w-3xl gap-2">
        <textarea
          className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          value={input}
        />
        {isStreaming ? (
          <button
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            onClick={onAbort}
          >
            Stop
          </button>
        ) : (
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!input.trim()}
            onClick={handleSend}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
