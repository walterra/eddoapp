/**
 * Fallback tool renderer for unknown tools.
 */

import type { FC } from 'react';

/** Tool fallback props from assistant-ui */
interface ToolFallbackProps {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/** Fallback component for tools without custom renderers */
export const ToolFallback: FC<ToolFallbackProps> = ({ toolName, args, result }) => {
  return (
    <div className="my-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🔧</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{toolName}</span>
      </div>

      {Object.keys(args).length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-gray-500">Arguments</div>
          <pre className="overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-100">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}

      {result !== undefined && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Result</div>
          <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-100">
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
