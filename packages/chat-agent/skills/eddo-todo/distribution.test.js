// @vitest-environment node
import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
}

describe('standalone todo skill distribution', () => {
  it('keeps standalone and workspace SDK requirements aligned', async () => {
    const skill = await json('./package.json');
    const workspace = await json('../../package.json');
    const lock = await json('./package-lock.json');
    expect(skill.dependencies['@modelcontextprotocol/client']).toBe(
      workspace.dependencies['@modelcontextprotocol/client'],
    );
    expect(lock.packages[''].dependencies).toEqual(skill.dependencies);
    expect(lock.packages[''].engines).toEqual(skill.engines);
    expect(lock.packages['node_modules/@modelcontextprotocol/client'].version).toMatch(/^2\./);
    expect(JSON.stringify(lock)).not.toContain('@modelcontextprotocol/sdk');
  });

  it('includes every runtime entry point without shipping tests', async () => {
    const skill = await json('./package.json');
    expect(skill.files).toEqual(
      expect.arrayContaining([
        'SKILL.md',
        'eddo-todo.js',
        'eddo.js',
        'eddo-worktree.js',
        'mcp_client.js',
      ]),
    );
    for (const file of skill.files) {
      expect((await stat(new URL(file, import.meta.url))).isFile()).toBe(true);
      expect(file).not.toContain('.test.');
    }
  });
});
