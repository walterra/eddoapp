// @vitest-environment node
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const directory = new URL('.', import.meta.url);
let httpServer;
let handler;
let url;
let fail;
const calls = [];

function createFixtureServer() {
  const server = new McpServer({ name: 'skill-cli-test', version: '1.0.0' });
  for (const name of ['createTodo', 'listTodos', 'getTodo']) {
    server.registerTool(name, {}, async () => {
      calls.push(name);
      const output = {
        summary: fail ? 'Failed' : 'Success',
        data: name === 'listTodos' ? [] : { id: 'todo-1', _id: 'todo-1', title: 'Example' },
        metadata: { operation: name, timestamp: new Date().toISOString() },
        ...(fail ? { error: 'Operation failed' } : {}),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
        isError: fail,
      };
    });
  }
  return server;
}

async function handleHttp(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const result = await handler.fetch(
    new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
    }),
  );
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(await result.text());
}

beforeEach(async () => {
  fail = false;
  calls.length = 0;
  handler = createMcpHandler(createFixtureServer, { legacy: 'reject' });
  httpServer = createServer((request, response) => {
    handleHttp(request, response).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${httpServer.address().port}/mcp`;
});

afterEach(async () => {
  await handler.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

function cli(script, args) {
  return run(process.execPath, [new URL(script, directory).pathname, ...args], {
    env: { ...process.env, EDDO_MCP_URL: url, EDDO_MCP_API_KEY: 'test-key' },
    timeout: 5000,
  });
}

describe('shipped skill CLI entry points', () => {
  it.each(['eddo-todo.js', 'eddo.js'])('%s creates a todo through SDK v2', async (script) => {
    const { stdout } = await cli(script, ['create', 'Example']);
    expect(stdout).toContain('Todo created');
    expect(stdout).toContain('todo-1');
    expect(calls).toEqual(['createTodo']);
  });

  it.each(['eddo-todo.js', 'eddo.js'])(
    '%s exits nonzero without false success on failure',
    async (script) => {
      fail = true;
      await expect(cli(script, ['create', 'Example'])).rejects.toMatchObject({
        code: 1,
        stdout: '',
        stderr: expect.stringContaining('MCP tool failed: createTodo'),
      });
      expect(calls).toEqual(['createTodo']);
    },
  );

  it('resolves SDK dependencies through an installed skill symlink', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'eddo-skill-link-'));
    const linked = join(temporary, 'eddo-todo');
    try {
      await symlink(directory, linked, 'dir');
      const { stdout } = await cli(join(linked, 'eddo-todo.js'), ['create', 'Example']);
      expect(stdout).toContain('todo-1');
      expect(calls).toEqual(['createTodo']);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it('preserves the delegated children command', async () => {
    const { stdout } = await cli('eddo.js', ['children', 'parent-id']);
    expect(stdout).toContain('No subtasks');
    expect(calls).toEqual(['listTodos']);
  });
});
