import { describe, expect, it } from 'vitest';
import { createSessionSchema, promptSchema } from './chat_request_schemas';

describe('chat request schema compatibility', () => {
  it('does not create a repository when it was omitted', () => {
    expect(createSessionSchema.parse({ name: 'session', ignored: true })).toEqual({
      name: 'session',
    });
  });

  it('supplies nested branch defaults and projects repository fields', () => {
    expect(
      createSessionSchema.parse({
        repository: { slug: 'repo', gitUrl: 'https://example.com/repo.git', ignored: true },
      }),
    ).toEqual({
      repository: { slug: 'repo', gitUrl: 'https://example.com/repo.git', defaultBranch: 'main' },
    });
  });

  it('preserves explicit branches and undefined optional repositories', () => {
    expect(createSessionSchema.parse({ repository: undefined })).toEqual({ repository: undefined });
    expect(
      createSessionSchema.parse({
        repository: { slug: 'repo', gitUrl: 'ssh://example.com/repo', defaultBranch: '' },
      }).repository?.defaultBranch,
    ).toBe('');
  });

  it.each([
    { repository: null },
    { repository: { slug: 'repo', gitUrl: 'invalid' } },
    { repository: { slug: 'repo', gitUrl: 'https://example.com', defaultBranch: null } },
  ])('rejects malformed repository requests', (value) => {
    expect(createSessionSchema.safeParse(value).success).toBe(false);
  });

  it('preserves prompt strings without trimming their contents', () => {
    expect(promptSchema.parse({ message: ' ', ignored: true })).toEqual({ message: ' ' });
    expect(promptSchema.safeParse({ message: '' }).success).toBe(false);
  });
});
