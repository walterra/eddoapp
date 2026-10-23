import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import nano from 'nano';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestAgentServer } from '../setup/test-agent-server.js';

/** Exercises real MCP/database effects with temporary scripted recordings, not fabricated real-model cassettes. */
describe('Durable VCR MCP smoke', () => {
  it('records native tool behavior and replays it against a fresh user database without model calls', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'durable-vcr-mcp-'));
    try {
      for (const mode of ['record', 'playback'] as const) {
        const provider = fauxProvider({ provider: 'vcr-smoke', models: [{ id: 'native-smoke' }] });
        provider.setResponses([
          fauxAssistantMessage(
            fauxToolCall('createTodo', {
              title: 'VCR integration shopping',
              context: 'work',
              due: '2026-10-23',
              tags: ['gtd:next'],
            }),
            { stopReason: 'toolUse' },
          ),
          fauxAssistantMessage('Created VCR integration shopping.'),
        ]);
        const models = createModels();
        models.setProvider(provider.provider);
        const server = createTestAgentServer({
          sourceModels: models,
          cassettesDir: directory,
          llmModel: 'vcr-smoke/native-smoke',
          vcrMode: mode,
        });
        try {
          await server.start();
          server.loadCassette('real-mcp-round-trip');
          const result = await server.executeAgent('Create a work shopping todo for Friday.');
          expect(result.success, result.message).toBe(true);
          expect(result.context.toolResults?.map((tool) => tool.toolName)).toContain('createTodo');
          const database = nano(process.env.COUCHDB_URL!).db.use(server.getUserDatabaseName());
          const docs = await database.find({ selector: { title: 'VCR integration shopping' } });
          expect(docs.docs).toHaveLength(1);
          expect(provider.state.callCount).toBe(mode === 'record' ? 2 : 0);
        } finally {
          await server.stop();
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
