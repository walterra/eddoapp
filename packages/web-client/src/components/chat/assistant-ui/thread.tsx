/**
 * Minimal Thread component for assistant-ui rendering.
 * Based on assistant-ui primitives but simplified for our use case.
 */

import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { ArrowUpIcon, Square } from 'lucide-react';
import type { FC } from 'react';

import { ImageLightboxProvider, useImageLightbox } from './image-lightbox-context';
import { MarkdownText } from './markdown-text';

/** Main Thread component */
export const Thread: FC = () => {
  return (
    <ImageLightboxProvider>
      <ThreadPrimitive.Root className="flex h-full flex-col bg-white dark:bg-gray-900">
        <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-auto p-4">
          <ThreadPrimitive.Empty>
            <ThreadWelcome />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <Composer />
        </div>
      </ThreadPrimitive.Root>
    </ImageLightboxProvider>
  );
};

/** Welcome message when thread is empty */
const ThreadWelcome: FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Start a conversation
        </h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Type a message to begin chatting with the AI assistant.
        </p>
      </div>
    </div>
  );
};

/** Message composer */
const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2">
      <ComposerPrimitive.Input
        autoFocus
        className="flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        placeholder="Type a message..."
        rows={1}
      />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            type="submit"
          >
            <ArrowUpIcon className="h-5 w-5" />
          </button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700"
            type="button"
          >
            <Square className="h-4 w-4" />
          </button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </ComposerPrimitive.Root>
  );
};

/** User message component */
const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-blue-600 px-4 py-2 text-white">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
};

/** Image component for message content with lightbox support */
const ImageBlock: FC<{ image: string }> = ({ image }) => {
  const { openLightbox } = useImageLightbox();

  return (
    <div className="my-2">
      <img
        alt="Generated content"
        className="max-w-full cursor-pointer rounded-lg shadow-md transition-opacity hover:opacity-90"
        onClick={() => openLightbox(image)}
        src={image}
      />
    </div>
  );
};

/** Assistant message component */
const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="mb-4 w-full">
      <div className="max-w-[80%] overflow-hidden rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-700">
        <MessagePrimitive.Content
          components={{
            Text: MarkdownText,
            Reasoning: ReasoningBlock,
            Image: ImageBlock,
          }}
        />
      </div>
      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
};

/** Reasoning/thinking block */
const ReasoningBlock: FC = () => {
  return (
    <div className="my-2 rounded border-l-4 border-purple-500 bg-purple-50 p-3 text-sm dark:bg-purple-900/20">
      <div className="mb-1 font-medium text-purple-700 dark:text-purple-300">Thinking...</div>
      <MessagePrimitive.Content />
    </div>
  );
};

/** Action bar for assistant messages */
const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root className="mt-1 flex gap-1 text-xs text-gray-500">
      <ActionBarPrimitive.Copy asChild>
        <button className="rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700">Copy</button>
      </ActionBarPrimitive.Copy>
    </ActionBarPrimitive.Root>
  );
};
