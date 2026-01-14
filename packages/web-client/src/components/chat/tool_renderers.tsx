/**
 * Custom tool UI renderers for pi-coding-agent tools.
 */

import { makeAssistantToolUI } from '@assistant-ui/react';

/** Common tool status indicator */
function ToolStatus({ status }: { status: { type: string } }) {
  if (status.type === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        Running...
      </span>
    );
  }
  return null;
}

/** Tool header with icon, name, and optional path - all inline */
function ToolHeader({
  icon,
  name,
  path,
  status,
}: {
  icon: string;
  name: string;
  path?: string;
  status: { type: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <span>{icon}</span>
        <span className="font-medium">{name}</span>
        {path && <span className="truncate text-gray-500">· {path}</span>}
      </div>
      <ToolStatus status={status} />
    </div>
  );
}

/** Truncate text to first N lines */
function truncateLines(text: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }
  return { text: lines.slice(0, maxLines).join('\n'), truncated: true };
}

/** Code block component with preview mode */
function CodeBlock({
  code,
  maxLines = 5,
  showFull = false,
}: {
  code: string;
  maxLines?: number;
  showFull?: boolean;
}) {
  const { text, truncated } = showFull
    ? { text: code, truncated: false }
    : truncateLines(code, maxLines);

  return (
    <div className="relative">
      <pre
        className="overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-100"
        style={{
          maxHeight: showFull ? '400px' : '100px',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        <code>{text}</code>
      </pre>
      {truncated && (
        <div className="mt-1 text-xs text-gray-500">
          ... ({code.split('\n').length - maxLines} more lines)
        </div>
      )}
    </div>
  );
}

/** Bash tool renderer */
export const BashToolUI = makeAssistantToolUI<{ command: string }, string>({
  toolName: 'bash',
  render: ({ args, result, status }) => {
    return (
      <div className="my-2 w-full min-w-0 space-y-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <ToolHeader icon="$" name="bash" status={status} />
        <CodeBlock code={`$ ${args.command}`} maxLines={2} />
        {result && (
          <CodeBlock
            code={typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            maxLines={5}
          />
        )}
      </div>
    );
  },
});

/** Read file tool renderer */
export const ReadToolUI = makeAssistantToolUI<
  { path: string; offset?: number; limit?: number },
  string
>({
  toolName: 'read',
  render: ({ args, result, status }) => {
    const fileName = args.path.split('/').pop() || args.path;
    const rangeInfo =
      args.offset || args.limit
        ? `:${args.offset || 1}-${(args.offset || 1) + (args.limit || 100)}`
        : '';

    return (
      <div className="my-2 w-full min-w-0 space-y-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <ToolHeader icon="📄" name="read" path={`${fileName}${rangeInfo}`} status={status} />
        {result && <CodeBlock code={result} maxLines={5} />}
      </div>
    );
  },
});

/** Write file tool renderer */
export const WriteToolUI = makeAssistantToolUI<{ path: string; content: string }, string>({
  toolName: 'write',
  render: ({ args, status }) => {
    const fileName = args.path.split('/').pop() || args.path;
    const lines = args.content.split('\n').length;

    return (
      <div className="my-2 w-full min-w-0 space-y-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <ToolHeader icon="✏️" name="write" path={`${fileName} (${lines} lines)`} status={status} />
        {status.type === 'running' ? (
          <CodeBlock code={args.content} maxLines={3} />
        ) : (
          <div className="text-xs text-green-600 dark:text-green-400">✓ written</div>
        )}
      </div>
    );
  },
});

/** Edit file tool renderer */
export const EditToolUI = makeAssistantToolUI<
  { path: string; oldText: string; newText: string },
  string
>({
  toolName: 'edit',
  render: ({ args, result, status }) => {
    const fileName = args.path.split('/').pop() || args.path;

    return (
      <div className="my-2 w-full min-w-0 space-y-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <ToolHeader icon="🔧" name="edit" path={fileName} status={status} />
        <div className="grid grid-cols-2 gap-1">
          <div className="min-w-0">
            <div className="mb-0.5 text-xs text-red-500 dark:text-red-400">−</div>
            <CodeBlock code={args.oldText} maxLines={3} />
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-xs text-green-500 dark:text-green-400">+</div>
            <CodeBlock code={args.newText} maxLines={3} />
          </div>
        </div>
        {result && status.type !== 'running' && (
          <div className="text-xs text-green-600 dark:text-green-400">✓ edited</div>
        )}
      </div>
    );
  },
});

/** Generic tool fallback renderer */
export const GenericToolUI = makeAssistantToolUI<Record<string, unknown>, unknown>({
  toolName: '*',
  render: ({ args, result, status, toolName }) => {
    // Create a compact summary of args for the header
    const argsSummary =
      Object.keys(args).length > 0
        ? Object.entries(args)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 20) : '...'}`)
            .join(', ')
            .slice(0, 40)
        : undefined;

    return (
      <div className="my-2 w-full min-w-0 space-y-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <ToolHeader icon="🔨" name={toolName} path={argsSummary} status={status} />
        {result !== undefined && (
          <CodeBlock
            code={typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            maxLines={5}
          />
        )}
      </div>
    );
  },
});

/** All tool UI components to register */
export const ToolUIComponents = [BashToolUI, ReadToolUI, WriteToolUI, EditToolUI];
