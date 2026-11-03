import type { StandardBoundarySchema } from '@eddo/core-shared/validation/standard_schema';
import type { McpServer } from '@modelcontextprotocol/server';

import { toolAnnotations, toolFailure, toolOutputSchema, toolResult } from './tool_contract.js';
import type { ToolContext } from './tools/types.js';

interface ToolDefinition<T> {
  name: string;
  description: string;
  parameters: StandardBoundarySchema<T>;
  execute: (args: T, context: ToolContext) => Promise<string>;
}

/** Registers domain handlers without coupling them to the HTTP transport. */
export interface ToolRegistry {
  addTool: <T>(definition: ToolDefinition<T>) => void;
}

/** Publishes validated output envelopes and safety hints for domain handlers. */
export function createToolRegistry(server: McpServer, context: ToolContext): ToolRegistry {
  return {
    addTool: (definition) => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.parameters,
          outputSchema: toolOutputSchema,
          annotations: toolAnnotations(definition.name),
        },
        async (args) => {
          try {
            const text = await definition.execute(args, context);
            return toolResult(definition.name, text);
          } catch {
            return toolFailure(definition.name);
          }
        },
      );
    },
  };
}
