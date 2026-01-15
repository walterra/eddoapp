/**
 * Minimal Thread component for assistant-ui rendering.
 * Based on assistant-ui primitives but simplified for our use case.
 * Styled to match Eddo's activity sidebar and table view.
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
      <ThreadPrimitive.Root className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-800">
        <ThreadPrimitive.Viewport className="flex flex-1 flex-col overflow-y-auto">
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

        <div className="border-t border-neutral-200 p-3 dark:border-neutral-700">
          <Composer />
        </div>
      </ThreadPrimitive.Root>
    </ImageLightboxProvider>
  );
};

/** Welcome message when thread is empty */
const ThreadWelcome: FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
          Start a conversation
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
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
        className="focus:border-primary-500 focus:ring-primary-500 flex-1 resize-none rounded-lg border border-neutral-300 bg-white p-3 text-sm outline-none focus:ring-1 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        placeholder="Type a message..."
        rows={1}
      />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <button
            className="bg-primary-600 hover:bg-primary-700 flex h-10 w-10 items-center justify-center rounded-lg text-white disabled:opacity-50"
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
    <MessagePrimitive.Root className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-700">
      <div className="text-sm text-neutral-900 dark:text-neutral-100">
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

/** Assistant message component - full width */
const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="w-full border-b border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="w-full overflow-hidden text-sm text-neutral-900 dark:text-neutral-100">
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
    <ActionBarPrimitive.Root className="mt-2 flex gap-1 text-xs text-neutral-500 dark:text-neutral-400">
      <ActionBarPrimitive.Copy asChild>
        <button className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Copy
        </button>
      </ActionBarPrimitive.Copy>
    </ActionBarPrimitive.Root>
  );
};
