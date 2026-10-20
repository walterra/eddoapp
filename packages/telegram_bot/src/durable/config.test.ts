import { describe, expect, it } from 'vitest';
import { parseDurableConfig } from './config.js';
import { createCouchEndpoint, getDurableDatabaseName } from './couch.js';
import { telegramChunk } from './request_task.js';

describe('durable pilot configuration', () => {
  it('defaults to no enrolled users', () => {
    expect(parseDurableConfig({}).users).toEqual([]);
  });

  it('normalizes enrollment without changing case-sensitive identities', () => {
    expect(parseDurableConfig({ TELEGRAM_DURABLE_USERS: 'alice, Bob,alice, ' }).users).toEqual([
      'alice',
      'Bob',
    ]);
  });

  it('parses provider-qualified model IDs with additional slashes', () => {
    expect(
      parseDurableConfig({ TELEGRAM_DURABLE_MODEL: 'openrouter/anthropic/claude-sonnet-4.5' })
        .model,
    ).toEqual({ provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4.5' });
    expect(() => parseDurableConfig({ TELEGRAM_DURABLE_MODEL: 'no-provider' })).toThrow();
  });

  it('removes and decodes CouchDB URL credentials', () => {
    const endpoint = createCouchEndpoint('https://admin:p%40ss@example.com:6984', 'private_db');
    expect(endpoint.url).toBe('https://example.com:6984/private_db');
    expect(endpoint.headers.Authorization).toBe(
      `Basic ${Buffer.from('admin:p@ss').toString('base64')}`,
    );
  });

  it('avoids collisions from case folding and username sanitization', () => {
    const names = ['alice', 'Alice', 'a.b', 'a_b'].map((user) =>
      getDurableDatabaseName('eddo', user),
    );
    expect(new Set(names).size).toBe(4);
    expect(names.every((name) => /^eddo_pi_durable_[a-f0-9]{64}$/.test(name))).toBe(true);
  });

  it('preserves surrogate pairs at Telegram chunk boundaries', () => {
    const answer = `${'a'.repeat(3999)}😀${'b'.repeat(4000)}`;
    const first = telegramChunk(answer, 0);
    const second = telegramChunk(answer, first.length);
    const third = telegramChunk(answer, first.length + second.length);
    expect(first.length).toBe(3999);
    expect(first + second + third).toBe(answer);
    expect(telegramChunk('', 0)).toBe('');
  });
});
