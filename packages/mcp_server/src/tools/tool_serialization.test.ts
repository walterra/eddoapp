import { describe, expect, it } from 'vitest';

import { toolResult } from '../tool_contract.js';
import { deleteTodoParameters } from './delete-todo.js';
import { getTodoParameters } from './get-todo.js';

const schemaOptions = { target: 'draft-2020-12' };

describe('native transcript serialization compatibility', () => {
  it('preserves published getTodo input bytes', () => {
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the todo (ISO timestamp of creation)',
        },
      },
      required: ['id'],
    };
    expect(JSON.stringify(getTodoParameters['~standard'].jsonSchema.input(schemaOptions))).toBe(
      JSON.stringify(expected),
    );
  });

  it('preserves optional-field annotation order in published schemas', () => {
    const schema = deleteTodoParameters['~standard'].jsonSchema.input(schemaOptions);
    expect(JSON.stringify(schema)).toBe(
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique identifier of the todo to delete (ISO timestamp of creation)',
          },
          message: {
            description:
              'Optional human-readable audit message describing why this todo was deleted (short, like a git commit message).',
            type: 'string',
          },
        },
        required: ['id'],
      }),
    );
  });

  it('strips unknown arguments even when the published input permits them', () => {
    expect(getTodoParameters.parse({ id: 'todo', extra: 'ignored' })).toEqual({ id: 'todo' });
  });

  it('preserves declared envelope and open metadata order in text and structured results', () => {
    const result = toolResult(
      'getTodo',
      JSON.stringify({
        metadata: {
          execution_time: '1.00ms',
          operation: 'get',
          timestamp: 'time',
          extra: 'retained',
        },
        data: { id: 'todo' },
        summary: 'Result',
        private: 'removed',
      }),
    );
    const expected = JSON.stringify({
      summary: 'Result',
      data: { id: 'todo' },
      metadata: {
        operation: 'get',
        timestamp: 'time',
        execution_time: '1.00ms',
        extra: 'retained',
      },
    });
    expect(JSON.stringify(result.structuredContent)).toBe(expected);
    expect(result.content).toEqual([{ type: 'text', text: expected }]);
  });
});
