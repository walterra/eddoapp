import { validateEnv } from '@eddo/core-server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantService } from './assistant_service';

const registry = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('@eddo/core-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eddo/core-server')>()),
  createUserRegistry: () => ({ findByUsername: registry.find }),
}));
const env = validateEnv({ NODE_ENV: 'test', COUCHDB_URL: 'http://admin:password@localhost:5984' });

beforeEach(() => {
  registry.find.mockReset();
});

describe('assistant service authorization', () => {
  it('uses fresh registry state instead of trusting a still-valid JWT after revocation', async () => {
    const service = createAssistantService(env, {});
    registry.find.mockResolvedValueOnce({
      username: 'alice',
      status: 'active',
      preferences: { mcpApiKey: 'current' },
    });
    await expect(service.authorize('alice')).resolves.toBeUndefined();
    registry.find.mockResolvedValueOnce({
      username: 'alice',
      status: 'suspended',
      preferences: { mcpApiKey: 'current' },
    });
    await expect(service.authorize('alice')).rejects.toMatchObject({ status: 403 });
    expect(registry.find).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    { username: 'bob', status: 'active', preferences: { mcpApiKey: 'current' } },
    { username: 'alice', status: 'active', preferences: {} },
  ])('rejects missing credentials and mismatched accounts', async (user) => {
    registry.find.mockResolvedValue(user);
    await expect(createAssistantService(env, {}).authorize('alice')).rejects.toMatchObject({
      status: 403,
    });
  });
});
