import type { McpServer } from '@modelcontextprotocol/server';
import type { z } from 'zod';

import { toolAnnotations, toolFailure, toolOutputSchema, toolResult } from './tool_contract.js';
import type { ToolContext } from './tools/types.js';

interface ToolDefinition<TSchema extends z.ZodType> {
  name: string;
  description: string;
  parameters: TSchema;
  execute: (args: z.output<TSchema>, context: ToolContext) => Promise<string>;
}

/** Registers domain handlers without coupling them to the HTTP transport. */
export interface ToolRegistry {
  addTool: <TSchema extends z.ZodType>(definition: ToolDefinition<TSchema>) => void;
}

/** Publishes validated output envelopes and safety hints for domain handlers. */
export function createToolRegistry(server: McpServer, context: ToolContext): ToolRegistry {
  return {
    addTool: (definition) => {
      const inputSchema: z.ZodType = definition.parameters;
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema,
          outputSchema: toolOutputSchema,
          annotations: toolAnnotations(definition.name),
        },
        async (args) => {
          try {
            const text = await definition.execute(definition.parameters.parse(args), context);
            return toolResult(definition.name, text);
          } catch {
            return toolFailure(definition.name);
          }
        },
      );
    },
  };
}
