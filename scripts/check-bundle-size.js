import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = 'packages/web-api/public';
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const DEFAULT_LIMIT_KB = 500;
const TOTAL_LIMIT_KB = 3500;

const limits = {
  index: 1100,
  'vendor-react': 50,
  'vendor-pouchdb': 200,
  'vendor-ui': 100,
  'vendor-flowbite': 500,
  'vendor-floating': 500,
  'vendor-icons': 500,
  'vendor-graph': 250,
  'vendor-markdown': 200,
  'vendor-query': 100,
  'vendor-utils': 100,
  dynamic: 300,
  nodes: 500,
  todo_graph: 100,
  todo_board: 50,
  todo_board_state: 50,
  todo_table: 60,
  chat_page: 200,
  chat_view: 10,
  subtasks_popover: 20,
};

/**
 * Calculate recursive directory size.
 *
 * @param {string} directoryPath - Directory path.
 * @return {number} Directory size in bytes.
 */
function getDirectorySizeBytes(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return total + getDirectorySizeBytes(entryPath);
    }

    if (entry.isFile()) {
      return total + fs.statSync(entryPath).size;
    }

    return total;
  }, 0);
}

/**
 * Resolve configured chunk name from a hashed filename.
 *
 * @param {string} filename - JavaScript asset filename.
 * @return {string} Chunk name.
 */
function getChunkName(filename) {
  const baseName = filename.replace(/\.js$/, '');
  const knownName = Object.keys(limits)
    .sort((a, b) => b.length - a.length)
    .find((chunkName) => baseName === chunkName || baseName.startsWith(`${chunkName}-`));

  if (knownName) {
    return knownName;
  }

  if (/^[A-Z0-9]{6,}/.test(baseName)) {
    return 'dynamic';
  }

  return baseName;
}

/**
 * Build chunk size data.
 *
 * @return {{ name: string, size: number, limit: number }[]} Chunk reports.
 */
function getChunks() {
  return fs
    .readdirSync(ASSETS_DIR)
    .filter((filename) => filename.endsWith('.js'))
    .map((filename) => {
      const name = getChunkName(filename);
      const filePath = path.join(ASSETS_DIR, filename);
      const size = Math.round(fs.statSync(filePath).size / 1024);
      const limit = limits[name] || DEFAULT_LIMIT_KB;

      return { name, size, limit };
    });
}

/**
 * Write bundle data for later workflow steps.
 *
 * @param {{ total: number, totalLimit: number, chunks: object[] }} bundleData - Bundle report.
 */
function writeGithubEnv(bundleData) {
  if (!process.env.GITHUB_ENV) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_ENV, `CLIENT_SIZE=${bundleData.total}\n`);
  fs.appendFileSync(process.env.GITHUB_ENV, `BUNDLE_JSON=${JSON.stringify(bundleData)}\n`);
}

/**
 * Print the bundle size report.
 *
 * @param {{ total: number, totalLimit: number, chunks: object[] }} bundleData - Bundle report.
 * @return {boolean} True when a limit is exceeded.
 */
function printReport(bundleData) {
  let hasViolation = bundleData.total > bundleData.totalLimit;

  console.log('');
  console.log('📦 Bundle Size Report');
  console.log('=====================');
  console.log('');

  bundleData.chunks
    .sort((a, b) => b.size - a.size)
    .forEach((chunk) => {
      const exceedsLimit = chunk.size > chunk.limit;
      const status = exceedsLimit ? '❌' : '✅';
      hasViolation = hasViolation || exceedsLimit;
      console.log(`${status} ${chunk.name}: ${chunk.size}KB (limit: ${chunk.limit}KB)`);
    });

  console.log('');
  console.log(`Total: ${bundleData.total}KB (limit: ${bundleData.totalLimit}KB)`);
  console.log('');

  return hasViolation;
}

if (!fs.existsSync(PUBLIC_DIR)) {
  const bundleData = { total: 0, totalLimit: TOTAL_LIMIT_KB, chunks: [] };
  writeGithubEnv(bundleData);
  console.log('❌ Client build directory not found');
  process.exit(1);
}

const bundleData = {
  total: Math.round(getDirectorySizeBytes(PUBLIC_DIR) / 1024),
  totalLimit: TOTAL_LIMIT_KB,
  chunks: getChunks(),
};

writeGithubEnv(bundleData);

if (printReport(bundleData)) {
  console.log('❌ One or more bundle size limits were exceeded');
  process.exit(1);
}

console.log('✅ All bundle sizes are within limits');
