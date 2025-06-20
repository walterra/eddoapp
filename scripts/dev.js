#!/usr/bin/env node

import { spawn } from 'child_process';
import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'no-mcp': {
      type: 'boolean',
      short: 'n',
      default: false,
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
    },
  },
  allowPositionals: true,
});

// Show help if requested
if (values.help) {
  console.log(`
Usage: pnpm dev [options]

Options:
  --no-mcp, -n    Disable MCP server (default: MCP server enabled)
  --help, -h      Show this help message

Examples:
  pnpm dev                 # Start dev server with MCP server
  pnpm dev --no-mcp        # Start dev server without MCP server
  pnpm dev -n              # Start dev server without MCP server (shorthand)
`);
  process.exit(0);
}

// Set environment variable based on the flag
const env = {
  ...process.env,
  VITE_LOAD_MCP: values['no-mcp'] ? 'false' : 'true',
};

// Start Vite dev server
const vite = spawn('vite', ['dev'], {
  env,
  stdio: 'inherit',
  shell: true,
});

vite.on('error', (error) => {
  console.error('Failed to start dev server:', error);
  process.exit(1);
});

vite.on('exit', (code) => {
  process.exit(code || 0);
});
