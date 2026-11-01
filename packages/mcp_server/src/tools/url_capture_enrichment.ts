import type { CreateTodoArgs } from './create-todo.js';
import type { ToolContext } from './types.js';
import { resolveCapture } from './url_capture_store.js';

/** Appends captured Markdown verbatim and preserves user notes and unrelated metadata. */
export function enrichTodoArgs(args: CreateTodoArgs, context: ToolContext): CreateTodoArgs {
  if (!args.urlCaptureRef) return args;
  if (!context.session?.dbName) throw new Error('Authenticated account required');
  const capture = resolveCapture(context.session.dbName, args.urlCaptureRef);
  return {
    ...args,
    link: capture.sourceUrl,
    description: args.description
      ? args.description + '\n\n---\n\n' + capture.markdown
      : capture.markdown,
    metadata: { ...args.metadata, ...capture.metadata },
  };
}
