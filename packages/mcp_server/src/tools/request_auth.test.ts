import { beforeEach, describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() => ({ findByMcpApiKey: vi.fn() }));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ NODE_ENV: 'production' }),
  createUserRegistry: () => registry,
  createTestUserRegistry: async () => registry,
}));

import { validateUserContext } from '../auth/user-auth.js';

function user(status = 'active') {
  return {
    _id: 'alice',
    username: 'alice',
    database_name: 'eddo_user_alice',
    status,
    preferences: { mcpApiKey: 'key' },
  };
}

describe('request authentication', () => {
  beforeEach(() => registry.findByMcpApiKey.mockReset());

  it('rejects a revoked key on the next request', async () => {
    registry.findByMcpApiKey.mockResolvedValueOnce(user()).mockResolvedValueOnce(null);
    await expect(validateUserContext({ authorization: 'Bearer key' })).resolves.toMatchObject({
      userId: 'alice',
    });
    await expect(validateUserContext({ authorization: 'Bearer key' })).rejects.toMatchObject({
      status: 401,
    });
    expect(registry.findByMcpApiKey).toHaveBeenCalledTimes(2);
  });

  it('rejects a disabled user on the next request', async () => {
    registry.findByMcpApiKey.mockResolvedValueOnce(user()).mockResolvedValueOnce(user('inactive'));
    await validateUserContext({ authorization: 'Bearer key' });
    await expect(validateUserContext({ authorization: 'Bearer key' })).rejects.toMatchObject({
      status: 403,
    });
  });
});
