#!/usr/bin/env node

/**
 * Eddo Worktree - Multi-agent orchestration via git worktrees
 *
 * Creates isolated development environments with:
 * - Git worktree (separate working directory on feature branch)
 * - Eddo todo with metadata linking to the worktree
 * - .env.local with port offsets for dev servers
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EDDO_SCRIPT = path.join(__dirname, 'eddo.js');

// Port configuration
const BASE_PORTS = {
  api: 3000,
  mcp: 3002,
  web: 5173,
};

/**
 * Validates the directory structure for multi-agent orchestration.
 * @returns {{ valid: boolean, error?: string, mainDir?: string, treesDir?: string }}
 */
function validateStructure() {
  const cwd = process.cwd();
  const dirName = path.basename(cwd);
  const parentDir = path.dirname(cwd);
  const treesDir = path.join(parentDir, '.trees');
  const gitPath = path.join(cwd, '.git');

  // Check if we're in 'main' directory
  if (dirName !== 'main') {
    return {
      valid: false,
      error: `Must run from the 'main' directory.\n\nCurrent: ${cwd}\nExpected: <project>/main\n\nIf you haven't set up the structure yet:\n  mkdir -p main .trees\n  ls -A | grep -v '^main$' | grep -v '^\\.trees$' | xargs -I {} mv {} main/`,
    };
  }

  // Check if .trees exists
  if (!fs.existsSync(treesDir)) {
    return {
      valid: false,
      error: `Missing .trees directory.\n\nExpected structure:\n  ${parentDir}/\n  ├── .trees/       ← missing\n  └── main/         ← you are here\n\nTo create: mkdir -p ../.trees`,
    };
  }

  // Check if .git is a directory (primary checkout, not a worktree)
  if (!fs.existsSync(gitPath)) {
    return {
      valid: false,
      error: `No .git found in current directory.\n\nAre you in the primary checkout?`,
    };
  }

  const gitStat = fs.statSync(gitPath);
  if (!gitStat.isDirectory()) {
    return {
      valid: false,
      error: `This appears to be a worktree (not the primary checkout).\n\nRun worktree commands from the 'main' directory, not from inside a worktree.`,
    };
  }

  return { valid: true, mainDir: cwd, treesDir };
}

/**
 * Slugifies a string for use as branch/directory name.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Calculates ports based on offset.
 * @param {number} offset
 * @returns {{ api: number, mcp: number, web: number }}
 */
function calculatePorts(offset) {
  return {
    api: BASE_PORTS.api + offset * 100,
    mcp: BASE_PORTS.mcp + offset * 100,
    web: BASE_PORTS.web + offset * 100,
  };
}

/**
 * Gets context from git remote (owner/repo format).
 * @returns {string}
 */
function getContextFromGit() {
  try {
    const remoteUrl = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    // Extract owner/repo from various URL formats
    const match = remoteUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : 'inbox';
  } catch {
    return 'inbox';
  }
}

/**
 * Finds the next available port offset by checking existing worktrees.
 * @param {string} treesDir
 * @returns {number}
 */
function findNextOffset(treesDir) {
  const usedOffsets = new Set([0]); // 0 is reserved for main

  try {
    const entries = fs.readdirSync(treesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const envPath = path.join(treesDir, entry.name, '.env.local');
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          // Match PORT= (the actual variable name used by the server)
          const match = content.match(/^PORT=(\d+)/m);
          if (match) {
            const port = parseInt(match[1], 10);
            const offset = (port - BASE_PORTS.api) / 100;
            if (offset > 0) usedOffsets.add(offset);
          }
        }
      }
    }
  } catch {
    // Ignore errors, start from 1
  }

  // Find first unused offset
  let offset = 1;
  while (usedOffsets.has(offset)) offset++;
  return offset;
}

/**
 * Creates a worktree with linked todo.
 * @param {string} title
 * @param {object} options
 */
async function createWorktree(title, options = {}) {
  const validation = validateStructure();
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    process.exit(1);
  }

  const { treesDir } = validation;
  const slug = slugify(title);
  const branchName = options.branch || `feature/${slug}`;
  const offset = options.offset || findNextOffset(treesDir);
  const context = options.context || getContextFromGit();
  const ports = calculatePorts(offset);
  const worktreePath = path.join(treesDir, slug);

  // Check if worktree already exists
  if (fs.existsSync(worktreePath)) {
    console.error(`Error: Worktree already exists at ${worktreePath}`);
    process.exit(1);
  }

  console.log(`Creating worktree for: "${title}"\n`);

  // 1. Create git worktree
  console.log(`1. Creating git worktree...`);
  try {
    execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(`Failed to create worktree: ${error.message}`);
    process.exit(1);
  }

  // 2. Create .env.local with ports and inherited config from main/.env
  console.log(`2. Creating .env.local with port configuration...`);

  // Read main .env and extract essential variables
  const mainEnvPath = path.join(validation.mainDir, '.env');
  let inheritedEnv = '';
  if (fs.existsSync(mainEnvPath)) {
    const mainEnvContent = fs.readFileSync(mainEnvPath, 'utf-8');
    // Extract lines that are essential and don't conflict with our port overrides
    const essentialVars = [
      'COUCHDB_URL',
      'NODE_ENV',
      'LOG_LEVEL',
      'TELEGRAM_BOT_TOKEN',
      'ANTHROPIC_API_KEY',
      'BOT_PERSONA_ID',
      'LLM_MODEL',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'JWT_SECRET',
    ];
    const lines = mainEnvContent.split('\n');
    const extractedLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Check if line starts with an essential variable
      for (const varName of essentialVars) {
        if (trimmed.startsWith(`${varName}=`)) {
          extractedLines.push(line);
          break;
        }
      }
    }
    if (extractedLines.length > 0) {
      inheritedEnv = '\n# Inherited from main/.env\n' + extractedLines.join('\n') + '\n';
    }
  }

  const envContent = `# Generated by eddo-worktree.js
# Offset: ${offset}

# Port configuration (offset from main)
PORT=${ports.api}
MCP_SERVER_PORT=${ports.mcp}
VITE_PORT=${ports.web}

# Isolated database for this worktree (prevents PouchDB sync conflicts)
COUCHDB_DB_NAME=todos-dev-${slug}

# Service URLs (for inter-service communication)
MCP_SERVER_URL=http://localhost:${ports.mcp}
VITE_API_URL=http://localhost:${ports.api}
CORS_ORIGIN=http://localhost:${ports.web}
GOOGLE_REDIRECT_URI=http://localhost:${ports.api}/api/email/oauth/callback
${inheritedEnv}`;
  fs.writeFileSync(path.join(worktreePath, '.env.local'), envContent);

  // 3. Create todo with metadata
  console.log(`3. Creating linked todo...`);
  const metadata = JSON.stringify({
    'agent:name': slug,
    'agent:worktree': path.relative(process.cwd(), worktreePath),
    'agent:branch': branchName,
    'agent:api_port': String(ports.api),
    'agent:mcp_port': String(ports.mcp),
    'agent:web_port': String(ports.web),
    'agent:created_at': new Date().toISOString(),
  });

  try {
    const result = execSync(
      `"${EDDO_SCRIPT}" create "${title}" --context "${context}" --tag gtd:project --metadata '${metadata}'`,
      { encoding: 'utf-8' },
    );
    console.log(result);
  } catch (error) {
    console.error(`Warning: Failed to create todo: ${error.message}`);
    console.log('You can create it manually later.');
  }

  // 4. Print summary
  console.log(`
✓ Worktree created successfully!

Worktree: ${worktreePath}
Branch:   ${branchName}

Dev Server URLs:
  API: http://localhost:${ports.api}
  MCP: http://localhost:${ports.mcp}
  Web: http://localhost:${ports.web}

To start working:
  cd ${path.relative(process.cwd(), worktreePath)}
  pnpm dev

To remove when done:
  ${EDDO_SCRIPT.replace(__dirname, '{baseDir}')} remove ${slug}
`);
}

/**
 * Lists all active worktrees.
 */
function listWorktrees() {
  const validation = validateStructure();
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    process.exit(1);
  }

  const { treesDir } = validation;

  try {
    const entries = fs.readdirSync(treesDir, { withFileTypes: true });
    const worktrees = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const worktreePath = path.join(treesDir, entry.name);
      const envPath = path.join(worktreePath, '.env.local');
      const gitPath = path.join(worktreePath, '.git');

      // Check if it's a valid worktree
      if (!fs.existsSync(gitPath)) continue;

      let ports = { api: '?', mcp: '?', web: '?' };
      let branch = '?';

      // Read ports from .env.local
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        // Match the actual variable names used by the server
        const apiMatch = content.match(/^PORT=(\d+)/m);
        const mcpMatch = content.match(/^MCP_SERVER_PORT=(\d+)/m);
        // Web port is derived from CORS_ORIGIN or calculated from offset
        const corsMatch = content.match(/^CORS_ORIGIN=http:\/\/localhost:(\d+)/m);
        if (apiMatch) ports.api = apiMatch[1];
        if (mcpMatch) ports.mcp = mcpMatch[1];
        if (corsMatch) ports.web = corsMatch[1];
      }

      // Get branch name
      try {
        branch = execSync(`git -C "${worktreePath}" branch --show-current`, {
          encoding: 'utf-8',
        }).trim();
      } catch {
        // Ignore
      }

      worktrees.push({
        name: entry.name,
        branch,
        ports,
      });
    }

    if (worktrees.length === 0) {
      console.log('No active worktrees.\n');
      console.log(
        `Create one with: ${EDDO_SCRIPT.replace(__dirname, '{baseDir}')} create "Feature name"`,
      );
      return;
    }

    console.log('Active Worktrees:\n');
    console.log(
      '┌' + '─'.repeat(18) + '┬' + '─'.repeat(30) + '┬' + '─'.repeat(7) + '┬' + '─'.repeat(7) + '┐',
    );
    console.log('│ Worktree         │ Branch                       │ API   │ Web   │');
    console.log(
      '├' + '─'.repeat(18) + '┼' + '─'.repeat(30) + '┼' + '─'.repeat(7) + '┼' + '─'.repeat(7) + '┤',
    );

    for (const wt of worktrees) {
      const name = wt.name.padEnd(16).substring(0, 16);
      const branch = wt.branch.padEnd(28).substring(0, 28);
      const api = `:${wt.ports.api}`.padEnd(5);
      const web = `:${wt.ports.web}`.padEnd(5);
      console.log(`│ ${name} │ ${branch} │ ${api} │ ${web} │`);
    }

    console.log(
      '└' + '─'.repeat(18) + '┴' + '─'.repeat(30) + '┴' + '─'.repeat(7) + '┴' + '─'.repeat(7) + '┘',
    );
  } catch (error) {
    console.error(`Error listing worktrees: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Shows status of current worktree.
 */
function showStatus() {
  const cwd = process.cwd();
  const gitPath = path.join(cwd, '.git');

  // Check if we're in a worktree
  if (!fs.existsSync(gitPath)) {
    console.error('Not in a git repository.');
    process.exit(1);
  }

  const gitStat = fs.statSync(gitPath);

  if (gitStat.isDirectory()) {
    // We're in the main checkout
    console.log('You are in the main checkout, not a worktree.\n');
    console.log('Use `list` to see active worktrees.');
    return;
  }

  // We're in a worktree - .git is a file pointing to the main repo
  const worktreeName = path.basename(cwd);
  const envPath = path.join(cwd, '.env.local');

  let ports = { api: '?', mcp: '?', web: '?' };
  let branch = '?';

  // Read ports
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    // Match the actual variable names used by the server
    const apiMatch = content.match(/^PORT=(\d+)/m);
    const mcpMatch = content.match(/^MCP_SERVER_PORT=(\d+)/m);
    const corsMatch = content.match(/^CORS_ORIGIN=http:\/\/localhost:(\d+)/m);
    if (apiMatch) ports.api = apiMatch[1];
    if (mcpMatch) ports.mcp = mcpMatch[1];
    if (corsMatch) ports.web = corsMatch[1];
  }

  // Get branch
  try {
    branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Ignore
  }

  console.log(`Current Worktree: ${worktreeName}`);
  console.log(`Branch: ${branch}`);
  console.log(`Path: ${cwd}`);
  console.log('');
  console.log('Ports:');
  console.log(`  API: http://localhost:${ports.api}`);
  console.log(`  MCP: http://localhost:${ports.mcp}`);
  console.log(`  Web: http://localhost:${ports.web}`);
}

/**
 * Removes a worktree.
 * @param {string} name
 * @param {object} options
 */
function removeWorktree(name, options = {}) {
  const validation = validateStructure();
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    process.exit(1);
  }

  const { treesDir } = validation;
  const worktreePath = path.join(treesDir, name);

  if (!fs.existsSync(worktreePath)) {
    console.error(`Error: Worktree '${name}' not found at ${worktreePath}`);
    process.exit(1);
  }

  console.log(`Removing worktree: ${name}\n`);

  // Get branch name before removal
  let branch;
  try {
    branch = execSync(`git -C "${worktreePath}" branch --show-current`, {
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Ignore
  }

  // Remove worktree
  const forceFlag = options.force ? '--force' : '';
  try {
    execSync(`git worktree remove "${worktreePath}" ${forceFlag}`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(`Failed to remove worktree. Use --force to remove with uncommitted changes.`);
    process.exit(1);
  }

  // Optionally delete the branch
  if (branch && branch !== 'main' && branch !== 'master') {
    console.log(`\nBranch '${branch}' still exists. Delete it with:`);
    console.log(`  git branch -d ${branch}`);
  }

  if (options.complete) {
    console.log(`\nNote: Use eddo.js to complete the linked todo manually.`);
  }

  console.log(`\n✓ Worktree '${name}' removed.`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--offset' && args[i + 1]) {
      options.offset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--context' && args[i + 1]) {
      options.context = args[i + 1];
      i++;
    } else if (args[i] === '--branch' && args[i + 1]) {
      options.branch = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      options.force = true;
    } else if (args[i] === '--complete') {
      options.complete = true;
    }
  }
  return options;
}

switch (command) {
  case 'create': {
    const title = args[1];
    if (!title) {
      console.error(
        'Usage: eddo-worktree.js create "Task title" [--offset N] [--context CTX] [--branch NAME]',
      );
      process.exit(1);
    }
    const options = parseOptions(args.slice(2));
    createWorktree(title, options);
    break;
  }

  case 'list':
    listWorktrees();
    break;

  case 'status':
    showStatus();
    break;

  case 'remove': {
    const name = args[1];
    if (!name) {
      console.error('Usage: eddo-worktree.js remove <worktree-name> [--force] [--complete]');
      process.exit(1);
    }
    const options = parseOptions(args.slice(2));
    removeWorktree(name, options);
    break;
  }

  default:
    console.log(`Eddo Worktree - Multi-agent orchestration via git worktrees

Usage:
  eddo-worktree.js create "Task title" [--offset N] [--context CTX] [--branch NAME]
  eddo-worktree.js list
  eddo-worktree.js status
  eddo-worktree.js remove <name> [--force] [--complete]

Commands:
  create    Create a new worktree with linked todo and port config
  list      List all active worktrees
  status    Show info for current worktree (when inside one)
  remove    Remove a worktree

Options:
  --offset N       Port offset multiplier (1=+100, 2=+200, etc.)
  --context CTX    Todo context (default: derived from git remote)
  --branch NAME    Custom branch name (default: feature/<slugified-title>)
  --force          Remove worktree even with uncommitted changes
  --complete       Mark linked todo as complete when removing

Examples:
  eddo-worktree.js create "Implement GitHub sync"
  eddo-worktree.js create "Fix auth bug" --offset 2 --branch hotfix/auth
  eddo-worktree.js list
  eddo-worktree.js remove github-sync --complete
`);
}
